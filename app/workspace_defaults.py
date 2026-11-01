"""Empty accounts and a conservative, once-only removal of legacy demo defaults."""
from copy import deepcopy
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo


def initial_state():
    return {
        "schema": 3, "workspaceVersion": 2, "role": "buyer", "ownQuantity": 100,
        "joined": False, "accepted": False, "signatures": {"buyer": False, "supplier": False},
        "paid": False, "received": False, "saved": [], "needs": [],
        "messages": {"group": [], "private": []}, "drafts": {"group": "", "private": ""},
        "comments": [], "issues": [], "tasks": [], "events": [],
        "readMessages": True, "notificationsRead": True,
        "delivery": {"city": "", "address": "", "contact": "", "interval": ""},
        "vendorProducts": [], "vendorOffers": [], "deals": [],
    }


def clean_legacy_defaults(state, created_at):
    if isinstance(state.get("workspaceVersion"), int) and state["workspaceVersion"] >= 2:
        return state
    clean = deepcopy(state)
    clean["workspaceVersion"] = 2
    seed_date = (datetime.fromtimestamp(created_at, ZoneInfo("Europe/Moscow")) + timedelta(days=7)).date().isoformat()
    needs = [
        {"id": "need-paper", "name": "Бумага A4, 80 г/м², 500 листов", "quantity": 100, "unit": "пачек", "city": "Москва", "date": seed_date},
        {"id": "need-boxes", "name": "Коробки 400 × 300 × 300 мм", "quantity": 500, "unit": "штук", "city": "Москва", "date": seed_date},
    ]
    clean["needs"] = [row for row in clean.get("needs", []) if row not in needs]
    task = {"id": "task-check", "person": "Елена К. · согласующий", "comment": "Проверить дату поставки и стоимость общей закупки", "status": "Ожидает решения", "time": "10:45"}
    clean["tasks"] = [row for row in clean.get("tasks", []) if row != task]
    messages = [
        {"id": "peer-welcome", "side": "member", "name": "Мария К.", "company": "Белый фильтр", "initials": "МК", "time": "10:40", "text": "Наши 130 пачек подтверждены. Готовы согласовать общую поставку."},
        {"id": "peer-address", "side": "member", "name": "Павел С.", "company": "Лесной коворкинг", "initials": "ПС", "time": "10:43", "text": "Получаем на Лесной. У каждой компании будет отдельный счёт и адрес доставки."},
    ]
    clean.setdefault("messages", {"group": [], "private": []})
    clean["messages"]["group"] = [row for row in clean["messages"].get("group", []) if row not in messages]
    # Only reset participation if no subsequent action could indicate user intent.
    untouched = (
        clean.get("ownQuantity") == 100 and not clean.get("accepted")
        and not clean.get("paid") and not clean.get("received")
        and not any(clean.get("signatures", {}).values())
        and not any(clean.get(key) for key in ["needs", "tasks", "comments", "issues", "deals"])
        and not any(clean.get("drafts", {}).values())
        and not any(clean["messages"].values())
        and all(isinstance(event, dict) and event.get("id") == "company-created" for event in clean.get("events", []))
    )
    if untouched:
        clean["joined"] = False
        clean["readMessages"] = True
        clean["notificationsRead"] = True
        delivery = {"city": "Москва", "address": "Москва, Лесная улица, тестовый офис 9", "contact": "Иван Л. · представитель виртуальной компании", "interval": "09:00–12:00"}
        if clean.get("delivery") == delivery:
            clean["delivery"] = initial_state()["delivery"]
    seed_product = {"id": "seed-paper", "name": "Бумага для офиса A4", "sku": "A4-80-500", "detail": "80 г/м² · 500 листов · белизна 146% CIE", "category": "Офис", "unit": "пачек", "image": "", "status": "active"}
    if not any(offer.get("productId") == "seed-paper" for offer in clean.get("vendorOffers", [])):
        clean["vendorProducts"] = [row for row in clean.get("vendorProducts", []) if row != seed_product]
    clean.setdefault("vendorProducts", [])
    clean.setdefault("vendorOffers", [])
    return clean
