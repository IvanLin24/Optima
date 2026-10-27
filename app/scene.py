# AI: синтетический район каждого владельца изолирован; не смешивать данные компаний разных аккаунтов.
import json
from pathlib import Path
import random
import time
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
from functools import lru_cache
from uuid import UUID
from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import Field
from sqlalchemy import select
from app.api import DB, Actor
from app.models import Company, SceneBusiness, SceneDeal, uid
from app.errors import fail
from app.schemas import Input
from app.prototype import NAMES, VOLUMES

router = APIRouter(prefix="/prototype/scene", tags=["Демонстрационный район"])
CATALOG = {
    "paper": {
        "name": "Бумага A4, 80 г/м², 500 листов",
        "unit": "пачек",
        "retail_minor": 36000,
        "wholesale_minor": 30000,
        "minimum": 1000,
        "supplier": "Бумага и дело",
    },
    "boxes": {
        "name": "Коробки 400 × 300 × 300 мм",
        "unit": "штук",
        "retail_minor": 5800,
        "wholesale_minor": 4300,
        "minimum": 4000,
        "supplier": "Форма упаковки",
    },
    "coffee": {
        "name": "Кофе в зерне, смесь Espresso",
        "unit": "кг",
        "retail_minor": 160000,
        "wholesale_minor": 125000,
        "minimum": 100,
        "supplier": "Тестовый обжарщик",
    },
    "cups": {
        "name": "Бумажные стаканы 300 мл",
        "unit": "штук",
        "retail_minor": 600,
        "wholesale_minor": 480,
        "minimum": 10000,
        "supplier": "Демо Упаковка",
    },
    "soap": {
        "name": "Жидкое мыло, 5 л",
        "unit": "канистр",
        "retail_minor": 54000,
        "wholesale_minor": 41000,
        "minimum": 200,
        "supplier": "Чистая среда",
    },
}
CATEGORIES = ["Кофейня", "Пекарня", "Офис", "Магазин", "Салон", "Ресторан", "Мастерская", "Поставщик"]


def today():
    return datetime.now(ZoneInfo("Europe/Moscow")).date()


class BusinessCreate(Input):
    name: str = Field(min_length=2, max_length=200)
    category: str = Field(min_length=2, max_length=30)
    address: str = Field(min_length=5, max_length=300)
    latitude: float = Field(ge=55.70, le=55.85)
    longitude: float = Field(ge=37.50, le=37.80)


class NeedCreate(Input):
    sku: str
    quantity: int = Field(gt=0, le=1000000, strict=True)
    delivery_date: date


class OperationCreate(Input):
    sku: str
    quantity: int = Field(gt=0, le=1000000, strict=True)


class DealCreate(Input):
    sku: str
    delivery_date: date


class DealAdvance(Input):
    revision: int = Field(ge=1)


@lru_cache
def boundary():
    result = json.loads((Path(__file__).parent / "data/district.json").read_text(encoding="utf-8")).get("result", [])
    return result[0].get("geojson") if result else None


def inside_ring(x, y, ring):
    inside = False
    for i in range(len(ring)):
        a, b = ring[i - 1], ring[i]
        if (a[1] > y) != (b[1] > y) and x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]:
            inside = not inside
    return inside


def point(rng):
    geo = boundary()
    polygons = geo["coordinates"] if geo and geo["type"] == "MultiPolygon" else [geo["coordinates"]] if geo else []
    if polygons:
        xs = [p[0] for polygon in polygons for p in polygon[0]]
        ys = [p[1] for polygon in polygons for p in polygon[0]]
        for _ in range(10000):
            x, y = rng.uniform(min(xs), max(xs)), rng.uniform(min(ys), max(ys))
            if any(inside_ring(x, y, p[0]) and not any(inside_ring(x, y, h) for h in p[1:]) for p in polygons):
                return y, x
    return 55.775 + rng.uniform(-0.008, 0.008), 37.595 + rng.uniform(-0.01, 0.01)


def data_for(rng, sku, quantity):
    p = CATALOG[sku]
    day = today()
    due = (day + timedelta(days=7)).isoformat()
    operations = [
        {
            "id": uid(),
            "date": (day - timedelta(days=5 + i * 7)).isoformat(),
            "supplier": p["supplier"],
            "sku": sku,
            "quantity": quantity,
            "amount_minor": quantity * p["retail_minor"],
            "purpose": p["name"] if i % 3 else "Оплата по счёту, требуется уточнение",
            "status": "Исполнено",
        }
        for i in range(12)
    ]
    balance = rng.randint(20, 150) * 100000
    return {
        "virtual": True,
        "contacts": {"person": "Тестовый представитель", "email": "не используется", "phone": "не используется"},
        "balance_minor": balance,
        "opening_balance_minor": balance + sum(o["amount_minor"] for o in operations),
        "tax_note": "Демонстрационные суммы; налоговый режим не согласован",
        "inventory": [{"sku": sku, "name": p["name"], "quantity": quantity // 2, "unit": p["unit"]}],
        "operations": operations,
        "needs": [
            {
                "id": uid(),
                "sku": sku,
                "name": p["name"],
                "quantity": quantity,
                "unit": p["unit"],
                "delivery_date": due,
                "status": "open",
            }
        ],
        "contracts": [],
    }


def ensure_scene(db, user):
    db.scalar(select(Company).where(Company.id == user.company_id).with_for_update())
    if db.scalar(select(SceneBusiness.id).where(SceneBusiness.owner_company_id == user.company_id).limit(1)):
        return
    rng = random.Random(user.company_id)
    own = db.get(Company, user.company_id)
    names = [own.name] + NAMES + [f"{CATEGORIES[i % len(CATEGORIES)]} «Квартал {i + 1}»" for i in range(31)]
    for i, name in enumerate(names):
        category = "Офис" if i < 9 else CATEGORIES[(i - 9) % len(CATEGORIES)]
        sku = "paper" if i < 9 else ["coffee", "cups", "boxes", "soap", "coffee", "cups", "boxes", "soap"][(i - 9) % 8]
        quantity = (
            ([100] + VOLUMES)[i]
            if i < 9
            else rng.choice(
                {"coffee": [20, 30, 40], "cups": [2000, 3000, 4000], "boxes": [500, 1000, 1500], "soap": [40, 60, 80]}[
                    sku
                ]
            )
        )
        lat, lon = point(rng)
        db.add(
            SceneBusiness(
                owner_company_id=user.company_id,
                scene_key=f"seed-{i}",
                name=name,
                category=category,
                address=f"Москва, Тверской район, тестовая точка {i + 1}",
                latitude=lat,
                longitude=lon,
                data=data_for(rng, sku, quantity),
            )
        )
    db.flush()
    rows = db.scalars(select(SceneBusiness).where(SceneBusiness.owner_company_id == user.company_id)).all()
    for sku, status, offset in [("paper", "delivered", -7), ("coffee", "paid", 2), ("boxes", "confirmed", 3)]:
        p = CATALOG[sku]
        shares = []
        for b in rows:
            need = b.data["needs"][0]
            if need["sku"] != sku:
                continue
            quantity = need["quantity"]
            retail = quantity * p["retail_minor"]
            wholesale = quantity * p["wholesale_minor"]
            saving = retail - wholesale
            fee = (saving * 3 + 50) // 100
            shares.append(
                {
                    "business_id": b.id,
                    "name": b.name,
                    "quantity": quantity,
                    "retail_minor": retail,
                    "wholesale_minor": wholesale,
                    "fee_minor": fee,
                    "net_savings_minor": saving - fee,
                }
            )
        totals = {
            key: sum(s[key] for s in shares)
            for key in ["quantity", "retail_minor", "wholesale_minor", "fee_minor", "net_savings_minor"]
        }
        payload = {
            "product": p["name"],
            "supplier": p["supplier"],
            "unit": p["unit"],
            "delivery_date": (today() + timedelta(days=offset)).isoformat(),
            "participants": shares,
            "totals": totals,
            "events": [{"at": int(time.time()), "text": "Историческая тестовая закупка"}],
            "virtual": True,
            "legally_binding": False,
            "historical": True,
        }
        d = SceneDeal(owner_company_id=user.company_id, sku=sku, status=status, payload=payload)
        db.add(d)
        db.flush()
        ids = {s["business_id"] for s in shares}
        for b in rows:
            if b.id in ids:
                b.data = {
                    **b.data,
                    "contracts": [*b.data["contracts"], {"id": d.id, "product": p["name"], "status": status}],
                }
    db.commit()


def summary(b):
    return {
        "id": b.id,
        "name": b.name,
        "category": b.category,
        "address": b.address,
        "latitude": b.latitude,
        "longitude": b.longitude,
        "revision": b.revision,
        "operation_count": len(b.data["operations"]),
        "need_count": sum(n["status"] == "open" for n in b.data["needs"]),
        "contract_count": len(b.data["contracts"]),
        "balance_minor": b.data["balance_minor"],
        "virtual": True,
    }


def business(db, user, bid, lock=False):
    q = select(SceneBusiness).where(SceneBusiness.id == str(bid), SceneBusiness.owner_company_id == user.company_id)
    if lock:
        q = q.with_for_update()
    item = db.scalar(q)
    if not item:
        fail(404, "NOT_FOUND", "Бизнес не найден")
    return item


def product(sku):
    if sku not in CATALOG:
        fail(422, "UNKNOWN_PRODUCT", "Выберите товар из каталога")
    return CATALOG[sku]


@router.get("")
def scene(db: DB, user: Actor) -> dict:
    ensure_scene(db, user)
    rows = db.scalars(
        select(SceneBusiness).where(SceneBusiness.owner_company_id == user.company_id).order_by(SceneBusiness.name)
    ).all()
    deals = db.scalars(
        select(SceneDeal).where(SceneDeal.owner_company_id == user.company_id).order_by(SceneDeal.created_at.desc())
    ).all()
    return {
        "name": "Тверской район · Москва",
        "businesses": [summary(b) for b in rows],
        "catalog": [{"sku": sku, **p} for sku, p in CATALOG.items()],
        "boundary": boundary(),
        "deals": [{"id": d.id, "status": d.status, "revision": d.revision, "sku": d.sku, **d.payload} for d in deals],
        "totals": {
            "businesses": len(rows),
            "operations": sum(len(b.data["operations"]) for b in rows),
            "needs": sum(sum(n["status"] == "open" for n in b.data["needs"]) for b in rows),
        },
        "virtual": True,
        "map_attribution": "© OpenStreetMap contributors",
    }


@router.get("/businesses/{business_id}")
def detail(business_id: UUID, db: DB, user: Actor) -> dict:
    b = business(db, user, business_id)
    return {**summary(b), "data": b.data}


@router.post("/businesses", status_code=201)
def create_business(body: BusinessCreate, db: DB, user: Actor) -> dict:
    ensure_scene(db, user)
    if body.category not in CATEGORIES:
        fail(422, "INVALID_CATEGORY", "Неизвестная категория")
    rng = random.Random(uid())
    data = data_for(rng, "paper", 100)
    data["operations"] = []
    data["opening_balance_minor"] = data["balance_minor"]
    data["needs"] = []
    data["inventory"] = []
    b = SceneBusiness(owner_company_id=user.company_id, scene_key=uid(), **body.model_dump(), data=data)
    db.add(b)
    db.commit()
    return summary(b)


@router.post("/businesses/{business_id}/needs", status_code=201)
def add_need(business_id: UUID, body: NeedCreate, db: DB, user: Actor) -> dict:
    p = product(body.sku)
    if body.delivery_date <= today():
        fail(422, "DELIVERY_IN_PAST", "Нужна будущая дата")
    b = business(db, user, business_id, True)
    item = {
        "id": uid(),
        "sku": body.sku,
        "name": p["name"],
        "unit": p["unit"],
        "quantity": body.quantity,
        "delivery_date": body.delivery_date.isoformat(),
        "status": "open",
    }
    if len(b.data["needs"]) >= 200:
        fail(409, "DEMO_LIMIT", "До 200 потребностей на бизнес")
    b.data = {**b.data, "needs": [*b.data["needs"], item]}
    b.revision += 1
    db.commit()
    return item


@router.post("/businesses/{business_id}/operations", status_code=201)
def add_operation(business_id: UUID, body: OperationCreate, db: DB, user: Actor) -> dict:
    p = product(body.sku)
    b = business(db, user, business_id, True)
    item = {
        "id": uid(),
        "date": today().isoformat(),
        "supplier": p["supplier"],
        "sku": body.sku,
        "quantity": body.quantity,
        "amount_minor": body.quantity * p["retail_minor"],
        "purpose": p["name"],
        "status": "Исполнено",
    }
    if len(b.data["operations"]) >= 200:
        fail(409, "DEMO_LIMIT", "До 200 операций на бизнес")
    b.data = {
        **b.data,
        "operations": [item, *b.data["operations"]],
        "balance_minor": b.data["balance_minor"] - item["amount_minor"],
    }
    b.revision += 1
    db.commit()
    return item


@router.post("/deals", status_code=201)
def create_deal(body: DealCreate, db: DB, user: Actor) -> dict:
    p = product(body.sku)
    if body.delivery_date <= today():
        fail(422, "DELIVERY_IN_PAST", "Нужна будущая поставка")
    rows = db.scalars(
        select(SceneBusiness)
        .where(SceneBusiness.owner_company_id == user.company_id)
        .order_by(SceneBusiness.id)
        .with_for_update()
    ).all()
    shares = []
    matched = []
    for b in rows:
        needs = [
            n
            for n in b.data["needs"]
            if n["status"] == "open" and n["sku"] == body.sku and n["delivery_date"] == body.delivery_date.isoformat()
        ]
        if not needs:
            continue
        quantity = sum(n["quantity"] for n in needs)
        retail = quantity * p["retail_minor"]
        wholesale = quantity * p["wholesale_minor"]
        saving = retail - wholesale
        fee = (saving * 3 + 50) // 100
        shares.append(
            {
                "business_id": b.id,
                "name": b.name,
                "quantity": quantity,
                "retail_minor": retail,
                "wholesale_minor": wholesale,
                "fee_minor": fee,
                "net_savings_minor": saving - fee,
            }
        )
        matched.append((b, {n["id"] for n in needs}))
    quantity = sum(s["quantity"] for s in shares)
    if len(shares) < 2 or quantity < p["minimum"]:
        fail(
            409,
            "THRESHOLD_NOT_REACHED",
            f"Найдено {quantity} {p['unit']}, требуется {p['minimum']} и минимум две компании с одной датой",
        )
    totals = {
        key: sum(s[key] for s in shares)
        for key in ["quantity", "retail_minor", "wholesale_minor", "fee_minor", "net_savings_minor"]
    }
    payload = {
        "product": p["name"],
        "supplier": p["supplier"],
        "unit": p["unit"],
        "delivery_date": body.delivery_date.isoformat(),
        "participants": shares,
        "totals": totals,
        "events": [{"at": int(time.time()), "text": "Общая закупка создана"}],
        "virtual": True,
        "legally_binding": False,
    }
    d = SceneDeal(owner_company_id=user.company_id, sku=body.sku, payload=payload)
    db.add(d)
    db.flush()
    for b, ids in matched:
        b.data = {
            **b.data,
            "needs": [{**n, "status": "matched"} if n["id"] in ids else n for n in b.data["needs"]],
            "contracts": [*b.data["contracts"], {"id": d.id, "product": p["name"], "status": "ready"}],
        }
        b.revision += 1
    db.commit()
    return {"id": d.id, "status": d.status, "revision": d.revision, **d.payload}


@router.post("/deals/{deal_id}/advance")
def advance(deal_id: UUID, body: DealAdvance, db: DB, user: Actor) -> dict:
    d = db.scalar(
        select(SceneDeal)
        .where(SceneDeal.id == str(deal_id), SceneDeal.owner_company_id == user.company_id)
        .with_for_update()
    )
    if not d:
        fail(404, "NOT_FOUND", "Закупка не найдена")
    if d.revision != body.revision:
        fail(409, "VERSION_CONFLICT", "Состояние закупки изменилось")
    transitions = {
        "ready": ("confirmed", "Условия подтверждены в демо"),
        "confirmed": ("paid", "Оплата отмечена в демо"),
        "paid": ("delivered", "Получение отмечено в демо"),
    }
    if d.status not in transitions:
        fail(409, "INVALID_STATE", "Закупка уже завершена")
    d.status, text = transitions[d.status]
    d.revision += 1
    d.payload = {**d.payload, "events": [*d.payload["events"], {"at": int(time.time()), "text": text}]}
    for share in d.payload["participants"]:
        b = business(db, user, share["business_id"], True)
        b.data = {
            **b.data,
            "contracts": [{**c, "status": d.status} if c["id"] == d.id else c for c in b.data["contracts"]],
        }
        if d.status == "paid":
            if len(b.data["operations"]) >= 200:
                fail(409, "DEMO_LIMIT", "В истории бизнеса уже 200 операций")
            amount = share["wholesale_minor"] + share["fee_minor"]
            payment = {
                "id": uid(),
                "date": today().isoformat(),
                "supplier": d.payload["supplier"],
                "sku": d.sku,
                "quantity": share["quantity"],
                "amount_minor": amount,
                "purpose": "Тестовая оплата совместной закупки " + d.payload["product"],
                "status": "Исполнено",
            }
            b.data = {
                **b.data,
                "operations": [payment, *b.data["operations"]],
                "balance_minor": b.data["balance_minor"] - amount,
            }
        b.revision += 1
    db.commit()
    return {"id": d.id, "status": d.status, "revision": d.revision, **d.payload}


@router.get("/deals/{deal_id}/document")
def document(deal_id: UUID, db: DB, user: Actor):
    d = db.scalar(select(SceneDeal).where(SceneDeal.id == str(deal_id), SceneDeal.owner_company_id == user.company_id))
    if not d:
        fail(404, "NOT_FOUND", "Документ не найден")
    text = (
        "# Демонстрационное соглашение\n\nЮридической силы не имеет. Реальных платежей нет.\nКомиссия: 3% положительной экономии.\n\n"
        + json.dumps(d.payload, ensure_ascii=False, indent=2)
    )
    return Response(
        text,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="scene-{d.id}.md"'},
    )
