import hashlib
import json
import time
from datetime import datetime, timezone
from sqlalchemy import select, func
from app.errors import fail
from app.models import Contract, Participant, Offer, Version, SignatureTask, Question, Company, AuditEvent


def now():
    return datetime.now(timezone.utc)


def event(db, contract_id, kind, company_id=None, **detail):
    db.add(AuditEvent(contract_id=contract_id, kind=kind, company_id=company_id, detail=detail))


def accessible_contract(db, contract_id, user, lock=False):
    statement = (
        select(Contract)
        .join(Participant, Participant.contract_id == Contract.id)
        .where(Contract.id == contract_id, Participant.company_id == user.company_id)
    )
    if lock:
        statement = statement.with_for_update(of=Contract)
    contract = db.scalar(statement)
    if not contract:
        fail(404, "NOT_FOUND", "Контракт не найден")
    return contract


def version_view(version):
    if not version:
        return None
    return {
        "id": version.id,
        "number": version.number,
        "status": version.status,
        "document_hash": version.document_hash,
        "supplier_confirmed": version.supplier_confirmed,
        "expires_at": version.expires_at,
        "payload": version.payload,
        "signature_mode": "demo",
        "legally_binding": False,
    }


def contract_view(db, contract):
    offer = db.get(Offer, contract.offer_id)
    return {
        "id": contract.id,
        "title": contract.title,
        "status": contract.status,
        "active_version_id": contract.active_version_id,
        "proposed_version_id": contract.proposed_version_id,
        "signature_mode": "demo",
        "legally_binding": False,
        "offer": {
            "id": offer.id,
            "supplier": offer.supplier,
            "product": offer.product,
            "sku": offer.sku,
            "min_quantity": offer.min_quantity,
            "pack_size": offer.pack_size,
            "retail_price_minor": offer.retail_minor,
            "wholesale_price_minor": offer.wholesale_minor,
        },
        "active_version": version_view(db.get(Version, contract.active_version_id))
        if contract.active_version_id
        else None,
        "proposed_version": version_view(db.get(Version, contract.proposed_version_id))
        if contract.proposed_version_id
        else None,
    }


def calculate(offer, purchases):
    shares = []
    for purchase in sorted(purchases, key=lambda p: p["company_id"]):
        quantity = purchase["quantity"]
        if quantity % offer.pack_size:
            fail(422, "INVALID_QUANTITY", f"Количество должно быть кратно {offer.pack_size}")
        retail, wholesale = quantity * offer.retail_minor, quantity * offer.wholesale_minor
        saving = max(0, retail - wholesale)
        fee = (saving * 3 + 50) // 100  # ROUND_HALF_UP to a kopeck, separately per buyer.
        shares.append(
            {
                **purchase,
                "retail_minor": retail,
                "wholesale_minor": wholesale,
                "gross_savings_minor": saving,
                "fee_minor": fee,
                "net_savings_minor": saving - fee,
            }
        )
    totals = {
        field: sum(p[field] for p in shares)
        for field in (
            "quantity",
            "retail_minor",
            "wholesale_minor",
            "gross_savings_minor",
            "fee_minor",
            "net_savings_minor",
        )
    }
    return {
        "currency": "RUB",
        "fee_rate_percent": 3,
        "shares": shares,
        "totals": totals,
        "tax_note": "Демонстрационные цены; режим НДС не согласован",
        "delivery_included": True,
        "payment_mode": "direct_to_supplier",
        "fee_collection": "calculation_only",
    }


def render_document(contract, offer, number, payload):
    text = (
        f"# ДЕМО: соглашение о закупке — редакция {number}\n\n"
        "Демонстрационный проект. Не подписан электронной подписью. Не является юридически проверенной формой.\n\n"
        f"Контракт: {contract.id}\n\nПоставщик: {offer.supplier} (вымышленный).\n\n"
        f"Товар: {offer.product}, артикул {offer.sku}.\n\n"
        "Покупатели оплачивают свои доли непосредственно поставщику. Комиссия — 3% положительной "
        "экономии каждого покупателя, округление до копейки; в MVP только расчёт. "
        "Получатель комиссии, банковская услуга, НДС, реквизиты, ответственность и порядок юридического "
        "подписания должны быть согласованы отдельно. Банк не заявлен партнёром проекта.\n\n"
        "Ответы во вкладке «Вопросы» служат подготовке, не подписывают договор и не изменяют его условия. "
        "Кнопка подтверждения фиксирует только демонстрационное согласование этой редакции. "
        "Новая редакция требует новых подтверждений. Изменения действующего соглашения применяются "
        "после согласования всеми необходимыми сторонами; до этого сохраняются прежние условия.\n\n"
        "Условия и расчёт (все суммы в копейках):\n\n```json\n"
    )
    return text + json.dumps(payload, ensure_ascii=False, sort_keys=True, indent=2) + "\n```\n"


def create_version(db, contract, payload):
    if contract.proposed_version_id:
        fail(409, "PENDING_VERSION", "Сначала завершите согласование текущей редакции")
    number = (db.scalar(select(func.max(Version.number)).where(Version.contract_id == contract.id)) or 0) + 1
    offer = db.get(Offer, contract.offer_id)
    document = render_document(contract, offer, number, payload)
    version = Version(
        contract_id=contract.id,
        number=number,
        payload=payload,
        document=document,
        document_hash=hashlib.sha256(document.encode("utf-8")).hexdigest(),
        expires_at=int(time.time()) + 48 * 3600,
    )
    db.add(version)
    db.flush()
    contract.proposed_version_id = version.id
    if not contract.active_version_id:
        contract.status = "awaiting_signatures"
    for participant in db.scalars(select(Participant).where(Participant.contract_id == contract.id)):
        db.add(SignatureTask(version_id=version.id, company_id=participant.company_id))
    event(db, contract.id, "version_created", version_id=version.id, number=number)
    return version


def prepare_from_answers(db, contract):
    questions = db.scalars(select(Question).where(Question.contract_id == contract.id)).all()
    if any(q.status != "answered" for q in questions):
        return {"ready": False, "reason": "WAITING_FOR_ANSWERS"}
    offer = db.get(Offer, contract.offer_id)
    starts = [datetime.fromisoformat(q.answer["delivery_window"]["start"]) for q in questions]
    ends = [datetime.fromisoformat(q.answer["delivery_window"]["end"]) for q in questions]
    start, end = max(starts), min(ends)
    if start <= now():
        return {"ready": False, "reason": "DELIVERY_IN_PAST"}
    if start >= end:
        return {"ready": False, "reason": "NO_COMMON_DELIVERY_WINDOW"}
    purchases = [
        {
            "company_id": q.company_id,
            "company_name": db.get(Company, q.company_id).name,
            "quantity": q.answer["quantity"],
            "delivery_address": q.answer["delivery_address"],
        }
        for q in questions
    ]
    if len(purchases) < 2 or sum(p["quantity"] for p in purchases) < offer.min_quantity:
        return {"ready": False, "reason": "WHOLESALE_THRESHOLD_NOT_REACHED"}
    payload = calculate(offer, purchases)
    payload["delivery_window"] = {"start": start.isoformat(), "end": end.isoformat()}
    version = create_version(db, contract, payload)
    return {"ready": True, "version_id": version.id}


def expire_if_needed(db, contract, version):
    if version.status == "awaiting_signatures" and version.expires_at <= int(time.time()):
        version.status = "expired"
        for task in db.scalars(select(SignatureTask).where(SignatureTask.version_id == version.id)):
            if task.status == "pending":
                task.status = "expired"
        contract.proposed_version_id = None
        if not contract.active_version_id:
            contract.status = "clarifying"
            for question in db.scalars(select(Question).where(Question.contract_id == contract.id)):
                question.status = "open"
        event(db, contract.id, "version_expired", version_id=version.id)
        db.commit()
        return True
    return version.status == "expired"


def try_activate(db, contract, version):
    db.flush()
    tasks = db.scalars(select(SignatureTask).where(SignatureTask.version_id == version.id)).all()
    if not version.supplier_confirmed or not tasks or any(t.status != "confirmed" for t in tasks):
        return
    if datetime.fromisoformat(version.payload["delivery_window"]["start"]) <= now():
        fail(409, "DELIVERY_IN_PAST", "Нужно согласовать будущую дату поставки")
    if contract.active_version_id:
        db.get(Version, contract.active_version_id).status = "superseded"
    version.status = "active"
    contract.active_version_id = version.id
    contract.proposed_version_id = None
    contract.status = "active"
    event(db, contract.id, "version_activated", version_id=version.id, legally_binding=False)
