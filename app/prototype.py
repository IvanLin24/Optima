# AI: состояние оригинального дизайна; сохранять изоляцию company_id и проверку revision.
import time
from fastapi import APIRouter
from sqlalchemy import update
from app.api import DB, Actor
from app.models import Company, PrototypeWorkspace, BusinessProfile
from app.schemas import PrototypeSave
from app.errors import fail
from app.workspace_defaults import initial_state, clean_legacy_defaults

router = APIRouter(prefix="/prototype", tags=["Рабочий дизайн-прототип"])
NAMES = [
    "Белый фильтр",
    "Утро на Лесной",
    "Северный офис",
    "Лесной коворкинг",
    "Площадь кофе",
    "Бюро 12",
    "Городская пекарня",
    "Офис на площади",
]
VOLUMES = [130, 120, 150, 100, 90, 110, 80, 120]


def ensure_workspace(db, company):
    workspace = db.get(PrototypeWorkspace, company.id)
    if workspace:
        return workspace
    directory = []
    state = initial_state()
    workspace = PrototypeWorkspace(company_id=company.id, revision=1, state=state, directory=directory)
    db.add(workspace)
    return workspace


def view(db, user):
    workspace = db.get(PrototypeWorkspace, user.company_id)
    if not workspace:
        fail(404, "NOT_FOUND", "Виртуальная компания не подготовлена")
    company = db.get(Company, user.company_id)
    from app.company_profile import clear_generated_identity
    company = clear_generated_identity(db, user, company)
    clean = clean_legacy_defaults(workspace.state, company.created_at)
    if clean != workspace.state:
        legacy_directory = [
            {"id": f"virtual-{i + 1}", "name": name, "quantity": quantity, "unit": "пачек", "address": f"Москва, Лесная улица, тестовый офис {i + 1}", "contact": f"Участник {i + 1}", "status": "Объём подтверждён", "virtual": True}
            for i, (name, quantity) in enumerate(zip(NAMES, VOLUMES))
        ]
        directory = [row for row in workspace.directory if row not in legacy_directory]
        previous = workspace.revision
        db.execute(update(PrototypeWorkspace).where(PrototypeWorkspace.company_id == user.company_id, PrototypeWorkspace.revision == previous).values(state=clean, directory=directory, revision=previous + 1))
        db.commit()
        db.refresh(workspace)
    return {
        "company": {"id": company.id, "name": company.name, "inn": company.inn, "email": user.email},
        "revision": workspace.revision,
        "state": workspace.state,
        "companies": workspace.directory,
        "supplier": {"name": "ООО «Бумага и дело»", "address": "Москва, тестовый склад", "virtual": True},
        "virtual": True,
        "legally_binding": False,
    }


@router.get("/state")
def get_state(db: DB, user: Actor) -> dict:
    return view(db, user)


@router.put("/state")
def save_state(body: PrototypeSave, db: DB, user: Actor) -> dict:
    from sqlalchemy import select
    profile = db.scalar(select(BusinessProfile).where(BusinessProfile.company_id == user.company_id, BusinessProfile.user_id == user.id))
    if profile and body.state.get("role") != profile.role:
        fail(409, "PROFILE_ROLE_MISMATCH", "Роль закреплена за бизнес-профилем. Выберите другой профиль.")
    result = db.execute(
        update(PrototypeWorkspace)
        .where(PrototypeWorkspace.company_id == user.company_id, PrototypeWorkspace.revision == body.revision)
        .values(state=body.state, revision=PrototypeWorkspace.revision + 1)
        .returning(PrototypeWorkspace.revision)
    )
    revision = result.scalar_one_or_none()
    if revision is None:
        fail(409, "STATE_CONFLICT", "Данные изменились в другой вкладке. Обновите страницу.")
    db.commit()
    return {"revision": revision, "saved_at": int(time.time())}
