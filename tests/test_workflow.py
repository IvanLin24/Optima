from datetime import datetime, timedelta, timezone
import hashlib
from sqlalchemy.orm import Session
from app.models import Version
from conftest import account


def window(days=10, hour=9):
    start = (datetime.now(timezone.utc) + timedelta(days=days)).replace(hour=hour, minute=0, second=0, microsecond=0)
    return {"start": start.isoformat(), "end": (start + timedelta(hours=3)).isoformat()}


def setup_scenario(client, owner):
    client.post("/api/v1/consents", headers=owner, json={"version": "2026-10-26-v1", "accepted": True})
    demo = client.post("/api/v1/demo/generate", headers=owner, json={"seed": 42})
    assert demo.status_code == 201, demo.text
    actors = [owner] + [{"Authorization": "Bearer " + c["access_token"]} for c in demo.json()["companies"][1:]]
    for actor in actors:
        data = client.get("/api/v1/demo/statement", headers=actor).content
        response = client.post("/api/v1/statement-imports", headers=actor, files={"file": ("demo.txt", data)})
        assert response.status_code == 201, response.text
    found = client.post("/api/v1/opportunities/discover", headers=owner)
    assert found.status_code == 200, found.text
    contract_id = found.json()["items"][0]["contract_id"]
    return actors, contract_id, demo.json()["offer_id"]


def answer_all(client, actors, offer_id, windows=None):
    for index, (actor, quantity) in enumerate(zip(actors, [4000, 3500, 2500])):
        question = client.get("/api/v1/questions", headers=actor).json()["items"][0]
        answer = {
            "product_id": offer_id,
            "quantity": quantity,
            "delivery_window": windows[index] if windows else window(),
            "delivery_address": "Москва, Лесная улица, тестовая точка " + str(index),
            "confirmed": True,
        }
        response = client.post(f"/api/v1/questions/{question['id']}/answers", headers=actor, json=answer)
        assert response.status_code == 200, response.text
    return response.json()


def confirm_all(client, actors, version_id):
    for actor in actors:
        task = next(
            t
            for t in client.get("/api/v1/signature-tasks", headers=actor).json()["items"]
            if t["version_id"] == version_id
        )
        response = client.post(
            f"/api/v1/signature-tasks/{task['id']}/sign",
            headers=actor,
            json={"version_id": task["version_id"], "document_hash": task["document_hash"], "accepted": True},
        )
        assert response.status_code == 200, response.text


def test_end_to_end_money_documents_and_amendment(client, owner):
    actors, cid, offer_id = setup_scenario(client, owner)
    assert client.post("/api/v1/opportunities/discover", headers=owner).json()["created"] is False
    assert client.get("/api/v1/signature-tasks", headers=owner).json()["items"] == []
    assert answer_all(client, actors, offer_id)["readiness"]["ready"]
    contract = client.get(f"/api/v1/contracts/{cid}", headers=owner).json()
    version = contract["proposed_version"]
    assert version["payload"]["totals"] == {
        "quantity": 10000,
        "retail_minor": 6000000,
        "wholesale_minor": 4800000,
        "gross_savings_minor": 1200000,
        "fee_minor": 36000,
        "net_savings_minor": 1164000,
    }
    doc = client.get(f"/api/v1/documents/{version['id']}/download", headers=owner)
    assert hashlib.sha256(doc.content).hexdigest() == version["document_hash"]
    confirm_all(client, actors, version["id"])
    assert client.get(f"/api/v1/contracts/{cid}", headers=owner).json()["status"] == "awaiting_signatures"
    supplier = client.post(
        f"/api/v1/demo/contracts/{cid}/supplier-confirmation",
        headers=owner,
        json={"version_id": version["id"], "confirmed": True},
    )
    assert supplier.status_code == 200
    assert client.get(f"/api/v1/contracts/{cid}", headers=owner).json()["status"] == "active"
    new = client.post(
        f"/api/v1/contracts/{cid}/amendments",
        headers=owner,
        json={"base_version_id": version["id"], "delivery_window": window(12), "reason": "Перенос поставки"},
    )
    assert new.status_code == 201, new.text
    second_id = new.json()["id"]
    current = client.get(f"/api/v1/contracts/{cid}", headers=owner).json()
    assert current["active_version_id"] == version["id"]
    assert current["proposed_version_id"] == second_id
    confirm_all(client, actors, second_id)
    assert client.get(f"/api/v1/contracts/{cid}", headers=owner).json()["active_version_id"] == version["id"]
    client.post(
        f"/api/v1/demo/contracts/{cid}/supplier-confirmation",
        headers=owner,
        json={"version_id": second_id, "confirmed": True},
    )
    current = client.get(f"/api/v1/contracts/{cid}", headers=owner).json()
    assert current["active_version_id"] == second_id and current["active_version"]["number"] == 2
    assert current["legally_binding"] is False


def test_no_intersection_and_future_only(client, owner):
    actors, cid, offer_id = setup_scenario(client, owner)
    result = answer_all(client, actors, offer_id, [window(10), window(11), window(12)])
    assert result["readiness"]["reason"] == "NO_COMMON_DELIVERY_WINDOW"
    assert client.get(f"/api/v1/contracts/{cid}", headers=owner).json()["proposed_version"] is None
    q = client.get("/api/v1/questions", headers=owner).json()["items"][0]
    body = {
        "product_id": offer_id,
        "quantity": 4000,
        "delivery_window": window(-1),
        "delivery_address": "Москва, тестовый адрес",
        "confirmed": True,
    }
    assert client.post(f"/api/v1/questions/{q['id']}/answers", headers=owner, json=body).status_code == 422


def test_document_question_task_and_import_isolation(client, owner):
    actors, cid, offer_id = setup_scenario(client, owner)
    answer_all(client, actors, offer_id)
    outsider = account(client, "outsider@example.com", "0000000030")
    version = client.get(f"/api/v1/contracts/{cid}", headers=owner).json()["proposed_version"]
    qid = client.get("/api/v1/questions", headers=owner).json()["items"][0]["id"]
    tid = client.get("/api/v1/signature-tasks", headers=owner).json()["items"][0]["id"]
    for path in [
        f"/contracts/{cid}",
        f"/documents/{version['id']}/download",
        f"/questions/{qid}",
        f"/signature-tasks/{tid}",
    ]:
        assert client.get("/api/v1" + path, headers=outsider).status_code == 404
    assert client.get("/api/v1/transactions", headers=outsider).json()["items"] == []


def test_stale_hash_and_rejection(client, owner):
    actors, cid, offer_id = setup_scenario(client, owner)
    answer_all(client, actors, offer_id)
    task = client.get("/api/v1/signature-tasks", headers=owner).json()["items"][0]
    payload = {"version_id": task["version_id"], "document_hash": "0" * 64, "accepted": True}
    assert client.post(f"/api/v1/signature-tasks/{task['id']}/sign", headers=owner, json=payload).status_code == 409
    reject = {"version_id": task["version_id"], "document_hash": task["document_hash"], "reason": "Не подходит срок"}
    assert client.post(f"/api/v1/signature-tasks/{task['id']}/reject", headers=owner, json=reject).status_code == 200
    other = client.get("/api/v1/signature-tasks", headers=actors[1]).json()["items"][0]
    payload = {"version_id": other["version_id"], "document_hash": other["document_hash"], "accepted": True}
    assert (
        client.post(f"/api/v1/signature-tasks/{other['id']}/sign", headers=actors[1], json=payload).status_code == 409
    )
    assert client.get(f"/api/v1/contracts/{cid}", headers=owner).json()["status"] == "clarifying"


def test_expiration(client, owner, db_engine):
    actors, cid, offer_id = setup_scenario(client, owner)
    answer_all(client, actors, offer_id)
    task = client.get("/api/v1/signature-tasks", headers=owner).json()["items"][0]
    with Session(db_engine) as db:
        db.get(Version, task["version_id"]).expires_at = 1
        db.commit()
    response = client.post(
        f"/api/v1/signature-tasks/{task['id']}/sign",
        headers=owner,
        json={"version_id": task["version_id"], "document_hash": task["document_hash"], "accepted": True},
    )
    assert response.status_code == 409 and response.json()["error"]["code"] == "VERSION_EXPIRED"
    assert client.get(f"/api/v1/contracts/{cid}", headers=owner).json()["proposed_version_id"] is None


def test_demo_disabled(client, owner, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings(), "enable_demo", False)
    assert client.post("/api/v1/demo/generate", headers=owner, json={"seed": 42}).status_code == 404


def test_requires_two_companies_and_threshold(client, owner):
    client.post("/api/v1/consents", headers=owner, json={"version": "2026-10-26-v1", "accepted": True})
    client.post("/api/v1/demo/generate", headers=owner, json={"seed": 42})
    data = client.get("/api/v1/demo/statement", headers=owner).content
    client.post("/api/v1/statement-imports", headers=owner, files={"file": ("demo.txt", data)})
    assert (
        client.post("/api/v1/opportunities/discover", headers=owner).json()["reason"] == "NOT_ENOUGH_MATCHING_COMPANIES"
    )
