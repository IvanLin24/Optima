"""Explicitly enabled, isolated synthetic tenants; no production bypass of email verification."""

import random
import secrets
import time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from uuid import uuid4, UUID
from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy import select
from app.api import DB, Actor
from app.config import settings
from app.contracts import accessible_contract, event, expire_if_needed, try_activate, version_view
from app.errors import fail
from app.models import User, Company, Offer, Transaction, Contract, Participant, Question, Version
from app.schemas import DemoGenerate, SupplierConfirmation, AuthResult
from app.security import hasher, issue_token, auth_rate_limit


def demo_enabled():
    if not settings().enable_demo or settings().app_env == "production":
        fail(404, "NOT_FOUND", "Демонстрационные инструменты отключены")


router = APIRouter(prefix="/demo", tags=["Демонстрация"], dependencies=[Depends(demo_enabled)])
opportunities = APIRouter(tags=["Поиск закупок"])


@router.post("/sessions", response_model=AuthResult, dependencies=[Depends(auth_rate_limit)])
def demo_session(db: DB):
    """Create an isolated synthetic account; normal email login is not bypassed."""
    fail(410, "CODE_REQUIRED", "Вход доступен только по коду из почты.")


def make_statement(company_name, company_inn, quantity, seed=42):
    rng = random.Random(seed)
    lines = [
        "1CClientBankExchange",
        "ВерсияФормата=1.03",
        "Кодировка=Windows",
        "Отправитель=DEMO GENERATOR, NOT BANK ORIGINAL",
        "Получатель=",
        "",
    ]
    today = datetime.now(ZoneInfo("Europe/Moscow")).date()
    for index, days in enumerate((60, 30, 7), 1):
        d = today - timedelta(days=days)
        purpose = "Стаканы CUP-300 300 мл" if index != 2 else "Упаковка по счету, требуется уточнение"
        lines += [
            "СекцияДокумент=Платежное поручение",
            f"Номер={index}",
            f"Дата={d:%d.%m.%Y}",
            f"Сумма={quantity * 6}.00",
            f"Плательщик={company_name}",
            f"ПлательщикИНН={company_inn}",
            f"ПлательщикСчет=DEMO-PAYER-{seed}",
            "Получатель=Демо Упаковка",
            "ПолучательИНН=0000000000",
            "ПолучательСчет=DEMO-SUPPLIER",
            f"НазначениеПлатежа={purpose}; тест {rng.randint(100, 999)}",
            "КонецДокумента",
        ]
    lines += ["КонецФайла"]
    return "\r\n".join(lines).encode("cp1251", errors="replace")


@router.post("/generate", status_code=201)
def generate(body: DemoGenerate, db: DB, user: Actor) -> dict:
    locked = db.scalar(select(User).where(User.id == user.id).with_for_update())
    if locked.demo_group:
        fail(409, "DEMO_EXISTS", "Демо уже создано для этой компании")
    company = db.get(Company, user.company_id)
    if not company.consent_version:
        fail(403, "CONSENT_REQUIRED", "Сначала примите условия анализа")
    if not company.inn:
        fail(422, "INN_REQUIRED", "Для демо зарегистрируйте компанию с тестовым ИНН")
    group = str(uuid4())
    locked.demo_group = group
    offer = Offer(
        demo_group=group,
        supplier="Демо Упаковка",
        supplier_inn="0000000000",
        product="Бумажные стаканы 300 мл",
        sku="CUP-300",
        retail_minor=600,
        wholesale_minor=480,
        min_quantity=10000,
        pack_size=100,
    )
    db.add(offer)
    identities = [
        {
            "company_id": company.id,
            "name": company.name,
            "quantity": 4000,
            "statement_url": "/api/v1/demo/statement",
            "email": user.email,
        }
    ]
    for name, quantity, inn in [("Утро на площади", 3500, "0000000001"), ("Белый фильтр", 2500, "0000000002")]:
        other = Company(name=name, inn=inn, consent_version="2026-10-26-v1", consent_at=int(time.time()))
        db.add(other)
        db.flush()
        account = User(
            email=f"demo-{uuid4().hex}@example.com",
            password_hash=hasher.hash(secrets.token_urlsafe(32)),
            company_id=other.id,
            verified=True,
            demo_group=group,
        )
        db.add(account)
        db.flush()
        other.consent_user_id = account.id
        identities.append(
            {
                "company_id": other.id,
                "name": name,
                "quantity": quantity,
                "email": account.email,
                "access_token": issue_token(db, account.id, "access", 3600),
                "statement_url": "/api/v1/demo/statement",
            }
        )
    db.commit()
    return {
        "demo_group": group,
        "offer_id": offer.id,
        "seed": body.seed,
        "companies": identities,
        "note": "Синтетические партнёры; импортируйте выписки всех трёх, затем вызовите /opportunities/discover",
    }


@router.get("/statement", response_class=Response, responses={200: {"content": {"text/plain": {}}}})
def statement(db: DB, user: Actor, seed: int = 42):
    if not user.demo_group:
        fail(404, "NOT_FOUND", "Демо не создано")
    company = db.get(Company, user.company_id)
    quantities = {"Утро на площади": 3500, "Белый фильтр": 2500}
    data = make_statement(company.name, company.inn, quantities.get(company.name, 4000), seed)
    return Response(
        data,
        media_type="text/plain; charset=windows-1251",
        headers={"Content-Disposition": 'attachment; filename="DEMO-statement-1c.txt"'},
    )


@opportunities.post("/opportunities/discover")
def discover(db: DB, user: Actor) -> dict:
    if not user.demo_group:
        return {"items": [], "reason": "NO_SUPPLIER_OFFERS", "note": "Каталог поставщиков пока только тестовый"}
    offer = db.scalar(select(Offer).where(Offer.demo_group == user.demo_group).with_for_update())
    existing = db.scalar(select(Contract).where(Contract.offer_id == offer.id))
    if existing:
        accessible_contract(db, existing.id, user)
        return {"items": [{"contract_id": existing.id}], "created": False}
    if not db.get(Company, user.company_id).consent_version:
        fail(403, "CONSENT_REQUIRED", "Нужно согласие на анализ")
    peers = db.scalars(select(User).where(User.demo_group == user.demo_group)).all()
    companies = []
    for peer in peers:
        history = db.scalar(
            select(Transaction.id)
            .where(
                Transaction.company_id == peer.company_id,
                Transaction.direction == "outgoing",
                Transaction.counterparty_inn == offer.supplier_inn,
            )
            .limit(1)
        )
        if history and db.get(Company, peer.company_id).consent_version:
            companies.append(peer.company_id)
    if len(set(companies)) < 2 or user.company_id not in companies:
        return {"items": [], "reason": "NOT_ENOUGH_MATCHING_COMPANIES"}
    contract = Contract(offer_id=offer.id, title="Совместная закупка стаканов — Белая площадь", status="clarifying")
    db.add(contract)
    db.flush()
    for company_id in set(companies):
        db.add(Participant(contract_id=contract.id, company_id=company_id))
        db.add(
            Question(
                contract_id=contract.id,
                company_id=company_id,
                text="Вы покупали упаковку у Демо Упаковка. Подтвердите CUP-300, объём следующей закупки, адрес и окно доставки. Ответ служит только подготовке.",
            )
        )
    event(
        db,
        contract.id,
        "candidate_discovered",
        participant_count=len(set(companies)),
        method="supplier_inn_rule",
        product_requires_confirmation=True,
    )
    db.commit()
    return {"items": [{"contract_id": contract.id}], "created": True}


@router.post("/contracts/{contract_id}/supplier-confirmation")
def supplier_confirmation(contract_id: UUID, body: SupplierConfirmation, db: DB, user: Actor) -> dict:
    contract = accessible_contract(db, str(contract_id), user, lock=True)
    offer = db.get(Offer, contract.offer_id)
    if not user.demo_group or offer.demo_group != user.demo_group:
        fail(404, "NOT_FOUND", "Тестовая закупка не найдена")
    version = db.get(Version, str(body.version_id))
    if not version or version.contract_id != contract.id:
        fail(404, "NOT_FOUND", "Редакция не найдена")
    if expire_if_needed(db, contract, version):
        fail(409, "VERSION_EXPIRED", "Срок согласования истёк")
    if contract.active_version_id == version.id and version.supplier_confirmed:
        return version_view(version)
    if contract.proposed_version_id != version.id or version.status != "awaiting_signatures":
        fail(409, "VERSION_CONFLICT", "Нужна актуальная предложенная редакция")
    version.supplier_confirmed = True
    event(db, contract.id, "demo_supplier_confirmation", version_id=version.id)
    try_activate(db, contract, version)
    db.commit()
    return version_view(version)
