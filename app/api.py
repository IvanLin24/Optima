import time
from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, File, UploadFile, Query
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.config import settings
from app.contracts import (
    accessible_contract,
    contract_view,
    version_view,
    event,
    prepare_from_answers,
    create_version,
    expire_if_needed,
    try_activate,
    now,
)
from app.db import get_db
from app.errors import fail
from app.models import (
    Company,
    User,
    StatementImport,
    Transaction,
    Offer,
    Contract,
    Participant,
    Question,
    Version,
    SignatureTask,
    AuditEvent,
)
from app.schemas import (
    Consent,
    CompanyUpdate,
    Answer,
    Decision,
    Reject,
    Amendment,
    Page,
    ContractView,
    MeView,
    CompanyView,
    VersionView,
    QuestionView,
    TaskView,
    AnswerResult,
    ImportView,
    TransactionView,
    DocumentView,
    EventView,
)
from app.security import current_user
from app.statements import parse_1c, StatementError

router = APIRouter()
DB = Annotated[Session, Depends(get_db)]
Actor = Annotated[User, Depends(current_user)]


def paginate(db, statement, model, limit, cursor):
    if cursor:
        statement = statement.where(model.id > str(cursor))
    rows = db.scalars(statement.order_by(model.id).limit(limit + 1)).all()
    return rows[:limit], rows[limit - 1].id if len(rows) > limit else None


Limit = Annotated[int, Query(ge=1, le=100)]


@router.get("/me", tags=["Профиль"], response_model=MeView)
def me(db: DB, user: Actor) -> dict:
    company = db.get(Company, user.company_id)
    return {
        "id": user.id,
        "email": user.email,
        "email_verified": user.verified,
        "company": {"id": company.id, "name": company.name, "inn": company.inn},
        "consent_version": company.consent_version,
        "consent_at": company.consent_at,
        "is_demo": user.demo_group is not None,
    }


@router.get("/consents/current", tags=["Профиль"])
def consent_terms() -> dict:
    return {
        "version": "2026-10-26-v1",
        "demo_terms": True,
        "text": "Разрешаю анализ загруженной выписки для поиска совместных закупок. "
        "Полная выписка другим компаниям не раскрывается. При подтверждении потребности "
        "участники закупки увидят название компании, объём и адрес доставки в проекте документа. "
        "Это демонстрационные условия; "
        "оператор, сроки хранения и порядок прекращения обработки требуют заполнения до запуска.",
    }


@router.post("/company", tags=["Профиль"], response_model=CompanyView)
def update_company(body: CompanyUpdate, db: DB, user: Actor) -> dict:
    company = db.scalar(select(Company).where(Company.id == user.company_id).with_for_update())
    has_history = db.scalar(select(StatementImport.id).where(StatementImport.company_id == company.id).limit(1))
    has_contracts = db.scalar(select(Participant.id).where(Participant.company_id == company.id).limit(1))
    if has_history or has_contracts or user.demo_group:
        fail(409, "PROFILE_LOCKED", "После начала анализа реквизиты компании нельзя менять в MVP")
    company.name, company.inn = body.name, body.inn
    db.commit()
    return {"id": company.id, "name": company.name, "inn": company.inn}


@router.post("/consents", tags=["Профиль"])
def consent(body: Consent, db: DB, user: Actor) -> dict:
    company = db.get(Company, user.company_id)
    company.consent_version = body.version
    company.consent_at = int(time.time())
    company.consent_user_id = user.id
    db.commit()
    return {"version": company.consent_version, "accepted_at": company.consent_at}


@router.post("/statement-imports", tags=["Выписки"], status_code=201, response_model=ImportView)
async def import_statement(db: DB, user: Actor, file: UploadFile = File(...)) -> dict:
    company = db.get(Company, user.company_id)
    if company.consent_version != "2026-10-26-v1":
        fail(403, "CONSENT_REQUIRED", "Примите текущие условия анализа")
    data = await file.read(settings().max_upload_bytes + 1)
    await file.close()
    if len(data) > settings().max_upload_bytes:
        fail(413, "FILE_TOO_LARGE", "Максимальный размер выписки — 5 МБ")
    try:
        records, errors = parse_1c(data, company.inn)
    except StatementError as exc:
        fail(422, "INVALID_STATEMENT", str(exc))
    item = StatementImport(
        company_id=company.id,
        filename=(file.filename or "statement.txt")[:255],
        status="completed_with_errors" if errors else "completed",
    )
    db.add(item)
    db.flush()
    inserted = duplicates = 0
    if db.bind.dialect.name == "postgresql":
        from sqlalchemy.dialects.postgresql import insert
    else:
        from sqlalchemy.dialects.sqlite import insert
    for record in records:
        result = db.execute(
            insert(Transaction)
            .values(company_id=company.id, import_id=item.id, **record)
            .on_conflict_do_nothing(index_elements=["company_id", "fingerprint"])
            .returning(Transaction.id)
        )
        if result.scalar_one_or_none() is not None:
            inserted += 1
        else:
            duplicates += 1
    item.result = {"inserted": inserted, "duplicates": duplicates, "errors": errors}
    db.commit()
    return {"id": item.id, "status": item.status, **item.result}


@router.get("/statement-imports/{import_id}", tags=["Выписки"], response_model=ImportView)
def import_status(import_id: UUID, db: DB, user: Actor) -> dict:
    item = db.get(StatementImport, str(import_id))
    if not item or item.company_id != user.company_id:
        fail(404, "NOT_FOUND", "Импорт не найден")
    return {"id": item.id, "status": item.status, **item.result}


@router.get("/transactions", tags=["Выписки"], response_model=Page[TransactionView])
def transactions(db: DB, user: Actor, limit: Limit = 30, cursor: UUID | None = None):
    rows, next_cursor = paginate(
        db, select(Transaction).where(Transaction.company_id == user.company_id), Transaction, limit, cursor
    )
    return {
        "items": [
            {
                "id": t.id,
                "date": t.date,
                "amount_minor": t.amount_minor,
                "direction": t.direction,
                "counterparty": t.counterparty,
                "counterparty_inn": t.counterparty_inn,
                "purpose": t.purpose,
            }
            for t in rows
        ],
        "next_cursor": next_cursor,
    }


@router.get("/contracts", tags=["Контракты"], response_model=Page[ContractView])
def contracts(db: DB, user: Actor, limit: Limit = 30, cursor: UUID | None = None, status: str | None = None):
    statement = select(Contract).join(Participant).where(Participant.company_id == user.company_id)
    if status:
        statement = statement.where(Contract.status == status)
    rows, next_cursor = paginate(db, statement, Contract, limit, cursor)
    return {"items": [contract_view(db, row) for row in rows], "next_cursor": next_cursor}


@router.get("/contracts/{contract_id}", tags=["Контракты"], response_model=ContractView)
def contract(contract_id: UUID, db: DB, user: Actor):
    return contract_view(db, accessible_contract(db, str(contract_id), user))


@router.get("/contracts/{contract_id}/versions", tags=["Контракты"], response_model=Page[VersionView])
def versions(contract_id: UUID, db: DB, user: Actor, limit: Limit = 30, cursor: UUID | None = None):
    accessible_contract(db, str(contract_id), user)
    rows, next_cursor = paginate(
        db, select(Version).where(Version.contract_id == str(contract_id)), Version, limit, cursor
    )
    return {"items": [version_view(row) for row in rows], "next_cursor": next_cursor}


@router.get("/contracts/{contract_id}/events", tags=["Контракты"], response_model=Page[EventView])
def events(contract_id: UUID, db: DB, user: Actor, limit: Limit = 30, cursor: UUID | None = None):
    accessible_contract(db, str(contract_id), user)
    statement = select(AuditEvent).where(AuditEvent.contract_id == str(contract_id))
    rows, next_cursor = paginate(db, statement, AuditEvent, limit, cursor)
    return {
        "items": [{"id": e.id, "created_at": e.created_at, "kind": e.kind, "detail": e.detail} for e in rows],
        "next_cursor": next_cursor,
    }


@router.get("/contracts/{contract_id}/documents", tags=["Контракты"], response_model=Page[DocumentView])
def documents(contract_id: UUID, db: DB, user: Actor, limit: Limit = 30, cursor: UUID | None = None):
    accessible_contract(db, str(contract_id), user)
    rows, next_cursor = paginate(
        db, select(Version).where(Version.contract_id == str(contract_id)), Version, limit, cursor
    )
    return {
        "items": [
            {
                "id": v.id,
                "version": v.number,
                "format": "markdown",
                "document_hash": v.document_hash,
                "download_url": f"/api/v1/documents/{v.id}/download",
                "legally_binding": False,
            }
            for v in rows
        ],
        "next_cursor": next_cursor,
    }


@router.get(
    "/documents/{document_id}/download",
    tags=["Контракты"],
    response_class=Response,
    responses={200: {"content": {"text/markdown": {}}}},
)
def download_document(document_id: UUID, db: DB, user: Actor):
    version = db.get(Version, str(document_id))
    if not version:
        fail(404, "NOT_FOUND", "Документ не найден")
    accessible_contract(db, version.contract_id, user)
    return Response(
        version.document,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="contract-{version.id}.md"'},
    )


def question_view(question, offer):
    return {
        "id": question.id,
        "contract_id": question.contract_id,
        "text": question.text,
        "status": question.status,
        "answer": question.answer,
        "legally_binding": False,
        "answer_schema": {
            "product_id": offer.id,
            "sku": offer.sku,
            "pack_size": offer.pack_size,
            "required": ["product_id", "quantity", "delivery_window", "delivery_address", "confirmed"],
        },
    }


@router.get("/questions", tags=["Вопросы"], response_model=Page[QuestionView])
def questions(
    db: DB,
    user: Actor,
    limit: Limit = 30,
    cursor: UUID | None = None,
    status: str | None = None,
    contract_id: UUID | None = None,
):
    statement = select(Question).where(Question.company_id == user.company_id)
    if status:
        statement = statement.where(Question.status == status)
    if contract_id:
        statement = statement.where(Question.contract_id == str(contract_id))
    rows, next_cursor = paginate(db, statement, Question, limit, cursor)
    return {
        "items": [question_view(q, db.get(Offer, db.get(Contract, q.contract_id).offer_id)) for q in rows],
        "next_cursor": next_cursor,
    }


@router.get("/questions/{question_id}", tags=["Вопросы"], response_model=QuestionView)
def question(question_id: UUID, db: DB, user: Actor) -> dict:
    q = db.get(Question, str(question_id))
    if not q or q.company_id != user.company_id:
        fail(404, "NOT_FOUND", "Вопрос не найден")
    return question_view(q, db.get(Offer, db.get(Contract, q.contract_id).offer_id))


@router.post("/questions/{question_id}/answers", tags=["Вопросы"], response_model=AnswerResult)
def answer(question_id: UUID, body: Answer, db: DB, user: Actor) -> dict:
    q = db.get(Question, str(question_id))
    if not q or q.company_id != user.company_id:
        fail(404, "NOT_FOUND", "Вопрос не найден")
    item = accessible_contract(db, q.contract_id, user, lock=True)
    if item.status != "clarifying" or item.proposed_version_id or item.active_version_id:
        fail(409, "INVALID_STATE", "Условия уже выпущены на подтверждение; нужно изменение редакции")
    offer = db.get(Offer, item.offer_id)
    if str(body.product_id) != offer.id:
        fail(422, "INVALID_PRODUCT", "Выберите товар из этого предложения")
    if body.quantity % offer.pack_size:
        fail(422, "INVALID_QUANTITY", f"Количество должно быть кратно {offer.pack_size}")
    if body.delivery_window.start <= now():
        fail(422, "DELIVERY_IN_PAST", "Нужна будущая поставка")
    q.answer = body.model_dump(mode="json")
    q.status = "answered"
    db.flush()
    event(db, item.id, "question_answered", user.company_id, question_id=q.id)
    readiness = prepare_from_answers(db, item)
    db.commit()
    return {"question": question_view(q, offer), "readiness": readiness}


def task_view(db, task):
    version = db.get(Version, task.version_id)
    return {
        "id": task.id,
        "contract_id": version.contract_id,
        "version_id": version.id,
        "version": version.number,
        "status": task.status,
        "version_status": version.status,
        "document_hash": version.document_hash,
        "expires_at": version.expires_at,
        "supplier_confirmed": version.supplier_confirmed,
        "download_url": f"/api/v1/documents/{version.id}/download",
        "signature_mode": "demo",
        "legally_binding": False,
    }


@router.get("/signature-tasks", tags=["Подписи"], response_model=Page[TaskView])
def tasks(db: DB, user: Actor, limit: Limit = 30, cursor: UUID | None = None, status: str | None = None):
    statement = select(SignatureTask).where(SignatureTask.company_id == user.company_id)
    if status:
        statement = statement.where(SignatureTask.status == status)
    rows, next_cursor = paginate(db, statement, SignatureTask, limit, cursor)
    return {"items": [task_view(db, t) for t in rows], "next_cursor": next_cursor}


@router.get("/signature-tasks/{task_id}", tags=["Подписи"], response_model=TaskView)
def task(task_id: UUID, db: DB, user: Actor) -> dict:
    item = db.get(SignatureTask, str(task_id))
    if not item or item.company_id != user.company_id:
        fail(404, "NOT_FOUND", "Задача не найдена")
    return task_view(db, item)


def decision_objects(db, user, task_id, version_id, document_hash):
    task = db.get(SignatureTask, str(task_id))
    if not task or task.company_id != user.company_id:
        fail(404, "NOT_FOUND", "Задача не найдена")
    version = db.get(Version, task.version_id)
    item = accessible_contract(db, version.contract_id, user, lock=True)
    db.refresh(task)
    db.refresh(version)
    if str(version_id) != version.id or document_hash != version.document_hash:
        fail(409, "VERSION_CONFLICT", "Версия или хеш документа изменились")
    if expire_if_needed(db, item, version):
        fail(409, "VERSION_EXPIRED", "Срок согласования истёк")
    return task, version, item


@router.post("/signature-tasks/{task_id}/sign", tags=["Подписи"], response_model=TaskView)
def sign(task_id: UUID, body: Decision, db: DB, user: Actor) -> dict:
    task, version, item = decision_objects(db, user, task_id, body.version_id, body.document_hash)
    if task.status == "confirmed":
        return task_view(db, task)
    if item.proposed_version_id != version.id or version.status != "awaiting_signatures" or task.status != "pending":
        fail(409, "INVALID_STATE", "Редакция больше не доступна для подтверждения")
    task.status, task.confirmed_by, task.decided_at = "confirmed", user.id, int(time.time())
    event(db, item.id, "demo_confirmation", user.company_id, version_id=version.id, legally_binding=False)
    try_activate(db, item, version)
    db.commit()
    return task_view(db, task)


@router.post("/signature-tasks/{task_id}/reject", tags=["Подписи"], response_model=TaskView)
def reject(task_id: UUID, body: Reject, db: DB, user: Actor) -> dict:
    task, version, item = decision_objects(db, user, task_id, body.version_id, body.document_hash)
    if task.status == "rejected":
        return task_view(db, task)
    if item.proposed_version_id != version.id or version.status != "awaiting_signatures" or task.status != "pending":
        fail(409, "INVALID_STATE", "Нельзя отклонить эту задачу")
    task.status, task.reason, task.confirmed_by, task.decided_at = "rejected", body.reason, user.id, int(time.time())
    version.status = "rejected"
    for other in db.scalars(select(SignatureTask).where(SignatureTask.version_id == version.id)):
        if other.id != task.id and other.status == "pending":
            other.status = "cancelled"
    item.proposed_version_id = None
    if not item.active_version_id:
        item.status = "clarifying"
        for q in db.scalars(select(Question).where(Question.contract_id == item.id)):
            q.status = "open"
    event(db, item.id, "version_rejected", user.company_id, version_id=version.id)
    db.commit()
    return task_view(db, task)


@router.post("/contracts/{contract_id}/amendments", tags=["Подписи"], status_code=201, response_model=VersionView)
def amendment(contract_id: UUID, body: Amendment, db: DB, user: Actor) -> dict:
    item = accessible_contract(db, str(contract_id), user, lock=True)
    if not item.active_version_id or item.active_version_id != str(body.base_version_id):
        fail(409, "VERSION_CONFLICT", "Изменение должно ссылаться на действующую редакцию")
    if body.delivery_window.start <= now():
        fail(422, "DELIVERY_IN_PAST", "Нужна будущая поставка")
    base = db.get(Version, item.active_version_id)
    payload = {
        **base.payload,
        "delivery_window": body.delivery_window.model_dump(mode="json"),
        "amendment_reason": body.reason,
        "base_version_id": base.id,
    }
    new_version = create_version(db, item, payload)
    db.commit()
    return version_view(new_version)
