# AI: состояние оригинального дизайна; сохранять изоляцию company_id и проверку revision.
import time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from fastapi import APIRouter
from sqlalchemy import update
from app.api import DB, Actor
from app.models import Company, PrototypeWorkspace
from app.schemas import PrototypeSave
from app.errors import fail

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
    future = (datetime.now(ZoneInfo("Europe/Moscow")) + timedelta(days=7)).date().isoformat()
    directory = [
        {
            "id": f"virtual-{i + 1}",
            "name": name,
            "quantity": quantity,
            "unit": "пачек",
            "address": f"Москва, Лесная улица, тестовый офис {i + 1}",
            "contact": f"Участник {i + 1}",
            "status": "Объём подтверждён",
            "virtual": True,
        }
        for i, (name, quantity) in enumerate(zip(NAMES, VOLUMES))
    ]
    state = {
        "schema": 3,
        "role": "buyer",
        "ownQuantity": 100,
        "joined": True,
        "accepted": False,
        "signatures": {"buyer": False, "supplier": False},
        "paid": False,
        "received": False,
        "saved": [],
        "needs": [
            {
                "id": "need-paper",
                "name": "Бумага A4, 80 г/м², 500 листов",
                "quantity": 100,
                "unit": "пачек",
                "city": "Москва",
                "date": future,
            },
            {
                "id": "need-boxes",
                "name": "Коробки 400 × 300 × 300 мм",
                "quantity": 500,
                "unit": "штук",
                "city": "Москва",
                "date": future,
            },
        ],
        "messages": {
            "group": [
                {
                    "id": "peer-welcome",
                    "side": "member",
                    "name": "Мария К.",
                    "company": NAMES[0],
                    "initials": "МК",
                    "time": "10:40",
                    "text": "Наши 130 пачек подтверждены. Готовы согласовать общую поставку.",
                },
                {
                    "id": "peer-address",
                    "side": "member",
                    "name": "Павел С.",
                    "company": NAMES[3],
                    "initials": "ПС",
                    "time": "10:43",
                    "text": "Получаем на Лесной. У каждой компании будет отдельный счёт и адрес доставки.",
                },
            ],
            "private": [],
        },
        "drafts": {"group": "", "private": ""},
        "comments": [],
        "issues": [],
        "tasks": [
            {
                "id": "task-check",
                "person": "Елена К. · согласующий",
                "comment": "Проверить дату поставки и стоимость общей закупки",
                "status": "Ожидает решения",
                "time": "10:45",
            }
        ],
        "events": [
            {
                "id": "company-created",
                "title": "Виртуальная компания создана",
                "detail": "Почта подтверждена одноразовым кодом",
                "time": "Сейчас",
            }
        ],
        "readMessages": False,
        "notificationsRead": False,
        "delivery": {
            "city": "Москва",
            "address": "Москва, Лесная улица, тестовый офис 9",
            "contact": "Иван Л. · представитель виртуальной компании",
            "interval": "09:00–12:00",
        },
        "deals": [],
    }
    workspace = PrototypeWorkspace(company_id=company.id, revision=1, state=state, directory=directory)
    db.add(workspace)
    return workspace


def view(db, user):
    workspace = db.get(PrototypeWorkspace, user.company_id)
    if not workspace:
        fail(404, "NOT_FOUND", "Виртуальная компания не подготовлена")
    company = db.get(Company, user.company_id)
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
