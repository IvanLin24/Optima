"""Company settings are private to the authenticated owner's company."""
import re
from fastapi import APIRouter
from sqlalchemy import select
from app.api import DB, Actor
from app.models import Company, StatementImport, Participant, PrototypeWorkspace
from app.schemas import CompanyProfileUpdate, CompanyProfileView
from app.errors import fail

router = APIRouter(prefix="/company/profile", tags=["Настройки компании"])
REQUISITES = ["name", "inn", "kpp", "legal_address"]


def identity_locked(db, user):
    company_id = user.company_id
    if user.demo_group or db.scalar(select(StatementImport.id).where(StatementImport.company_id == company_id).limit(1)) or db.scalar(select(Participant.id).where(Participant.company_id == company_id).limit(1)):
        return True
    workspace = db.get(PrototypeWorkspace, company_id)
    state = workspace.state if workspace else {}
    return bool(state.get("accepted") or any(deal.get("accepted") for deal in state.get("deals", []) if isinstance(deal, dict)))


def profile_view(company, user, locked):
    placeholder = not company.name or (not locked and company.inn == "0000000010" and bool(re.fullmatch(r"ООО «Линия [0-9A-F]{4}»", company.name)))
    return {
        "id": company.id, "name": company.name, "inn": company.inn,
        **{key: getattr(company, key) for key in ["kpp", "legal_address", "contact_name", "contact_phone", "contact_email"]},
        "login_email": user.email, "can_edit_requisites": not locked, "needs_setup": placeholder,
        "profile_revision": company.profile_revision,
    }


def clear_generated_identity(db, user, company):
    generated = company.inn == "0000000010" and bool(re.fullmatch(r"ООО «Линия [0-9A-F]{4}»", company.name))
    if generated and not identity_locked(db, user):
        from sqlalchemy import update
        db.execute(update(Company).where(Company.id == company.id, Company.name == company.name, Company.inn == "0000000010", Company.profile_revision == company.profile_revision).values(name="", inn=None, profile_revision=Company.profile_revision + 1))
        db.commit()
        db.refresh(company)
    return company


@router.get("", response_model=CompanyProfileView)
def get_profile(db: DB, user: Actor):
    company = clear_generated_identity(db, user, db.get(Company, user.company_id))
    return profile_view(company, user, identity_locked(db, user))


@router.put("", response_model=CompanyProfileView)
def update_profile(body: CompanyProfileUpdate, db: DB, user: Actor):
    company = db.scalar(select(Company).where(Company.id == user.company_id).with_for_update())
    locked = identity_locked(db, user)
    if body.profile_revision != company.profile_revision:
        fail(409, "PROFILE_CONFLICT", "Данные компании изменились в другой вкладке. Обновите настройки перед сохранением.")
    values = body.model_dump(exclude={"profile_revision"})
    if locked and any(values[key] != getattr(company, key) for key in REQUISITES):
        fail(409, "PROFILE_LOCKED", "Реквизиты уже используются в закупках. Контактные данные можно обновить.")
    for key, value in values.items():
        setattr(company, key, str(value) if value is not None else None)
    company.profile_revision += 1
    db.commit()
    return profile_view(company, user, locked)
