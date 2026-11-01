from copy import deepcopy
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from sqlalchemy.orm import Session
from app.models import Company, PrototypeWorkspace
from app.workspace_defaults import initial_state, clean_legacy_defaults


def legacy(created_at):
    state = initial_state()
    state.pop("workspaceVersion")
    state["joined"] = True
    day = (datetime.fromtimestamp(created_at, ZoneInfo("Europe/Moscow")) + timedelta(days=7)).date().isoformat()
    state["needs"] = [
        {"id": "need-paper", "name": "Бумага A4, 80 г/м², 500 листов", "quantity": 100, "unit": "пачек", "city": "Москва", "date": day},
        {"id": "need-boxes", "name": "Коробки 400 × 300 × 300 мм", "quantity": 500, "unit": "штук", "city": "Москва", "date": day},
    ]
    state["tasks"] = [{"id": "task-check", "person": "Елена К. · согласующий", "comment": "Проверить дату поставки и стоимость общей закупки", "status": "Ожидает решения", "time": "10:45"}]
    state["delivery"] = {"city": "Москва", "address": "Москва, Лесная улица, тестовый офис 9", "contact": "Иван Л. · представитель виртуальной компании", "interval": "09:00–12:00"}
    state["messages"]["group"] = [{"id": "peer-welcome", "side": "member", "name": "Мария К.", "company": "Белый фильтр", "initials": "МК", "time": "10:40", "text": "Наши 130 пачек подтверждены. Готовы согласовать общую поставку."}]
    return state


def test_account_starts_empty(client, owner):
    result = client.get("/api/v1/prototype/state", headers=owner).json()
    state = result["state"]
    assert state["joined"] is False
    for key in ["needs", "tasks", "deals", "vendorProducts", "vendorOffers", "comments", "issues"]:
        assert state[key] == []
    assert state["messages"] == {"group": [], "private": []}
    assert not any(state["delivery"].values())
    assert result["companies"] == []


def test_known_demo_defaults_removed_without_mutating_input():
    before = legacy(1793000000)
    original = deepcopy(before)
    cleaned = clean_legacy_defaults(before, 1793000000)
    assert before == original
    assert cleaned["joined"] is False
    assert cleaned["needs"] == cleaned["tasks"] == []
    assert cleaned["messages"]["group"] == []
    assert not any(cleaned["delivery"].values())
    assert clean_legacy_defaults(cleaned, 1793000000) == cleaned


def test_user_edits_confirmed_order_and_custom_records_are_preserved():
    before = legacy(1793000000)
    before["needs"][0]["quantity"] = 175
    before["tasks"][0]["comment"] = "Мой комментарий"
    before["messages"]["group"][0]["text"] = "Изменённый текст"
    before["delivery"]["address"] = "Указанный пользователем адрес"
    before["accepted"] = True
    before["vendorProducts"] = [{"id": "product-user", "name": "Мой товар"}]
    cleaned = clean_legacy_defaults(before, 1793000000)
    assert cleaned["joined"] is True and cleaned["accepted"] is True
    assert cleaned["needs"] == [before["needs"][0]]
    for key in ["tasks", "messages", "delivery", "vendorProducts"]:
        assert cleaned[key] == before[key]


def test_legacy_upgrade_is_once_only_and_rejects_stale_save(client, owner, db_engine):
    company_id = client.get("/api/v1/prototype/state", headers=owner).json()["company"]["id"]
    with Session(db_engine) as db:
        company = db.get(Company, company_id)
        workspace = db.get(PrototypeWorkspace, company_id)
        workspace.state = legacy(company.created_at)
        workspace.revision = 8
        db.commit()
    upgraded = client.get("/api/v1/prototype/state", headers=owner).json()
    assert upgraded["revision"] == 9 and upgraded["state"]["joined"] is False
    assert client.get("/api/v1/prototype/state", headers=owner).json()["revision"] == 9
    assert client.put("/api/v1/prototype/state", headers=owner, json={"revision": 8, "state": upgraded["state"]}).status_code == 409
