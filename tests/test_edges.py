import hashlib
from datetime import datetime, timedelta, timezone
from app.config import settings
from app.contracts import calculate
from app.mail import send_token_email
from app.models import Offer
from test_workflow import setup_scenario, answer_all, confirm_all, window


def test_rounding_and_zero_savings():
    offer = Offer(retail_minor=101, wholesale_minor=100, min_quantity=1, pack_size=1)
    result = calculate(offer, [{"company_id": "a", "quantity": 50}, {"company_id": "b", "quantity": 1}])
    assert result["shares"][0]["fee_minor"] == 2  # 1.5 kopecks -> 2.
    assert result["totals"]["fee_minor"] == 2
    offer.wholesale_minor = 102
    assert calculate(offer, [{"company_id": "a", "quantity": 50}])["totals"]["fee_minor"] == 0


def test_threshold_quantity_and_no_timezone(client, owner):
    actors, cid, offer_id = setup_scenario(client, owner)
    for actor in actors:
        q = client.get("/api/v1/questions", headers=actor).json()["items"][0]
        body = {
            "product_id": offer_id,
            "quantity": 100,
            "delivery_window": window(),
            "delivery_address": "Москва, тестовый адрес",
            "confirmed": True,
        }
        result = client.post(f"/api/v1/questions/{q['id']}/answers", headers=actor, json=body)
        assert result.status_code == 200, result.text
    assert result.json()["readiness"]["reason"] == "WHOLESALE_THRESHOLD_NOT_REACHED"
    body["quantity"] = 101
    assert client.post(f"/api/v1/questions/{q['id']}/answers", headers=actor, json=body).status_code == 422
    body["quantity"] = 100
    start = (datetime.now(timezone.utc) + timedelta(days=10)).replace(tzinfo=None)
    body["delivery_window"] = {"start": start.isoformat(), "end": (start + timedelta(hours=1)).isoformat()}
    assert client.post(f"/api/v1/questions/{q['id']}/answers", headers=actor, json=body).status_code == 422


def test_issued_document_immutable_and_sign_idempotent(client, owner):
    actors, cid, offer_id = setup_scenario(client, owner)
    answer_all(client, actors, offer_id)
    version = client.get(f"/api/v1/contracts/{cid}", headers=owner).json()["proposed_version"]
    before = client.get(f"/api/v1/documents/{version['id']}/download", headers=owner).content
    q = client.get("/api/v1/questions", headers=owner).json()["items"][0]
    assert client.post(f"/api/v1/questions/{q['id']}/answers", headers=owner, json=q["answer"]).status_code == 409
    task = client.get("/api/v1/signature-tasks", headers=owner).json()["items"][0]
    body = {"version_id": task["version_id"], "document_hash": task["document_hash"], "accepted": True}
    first = client.post(f"/api/v1/signature-tasks/{task['id']}/sign", headers=owner, json=body)
    second = client.post(f"/api/v1/signature-tasks/{task['id']}/sign", headers=owner, json=body)
    assert first.json() == second.json()
    after = client.get(f"/api/v1/documents/{version['id']}/download", headers=owner).content
    assert before == after and hashlib.sha256(after).hexdigest() == version["document_hash"]


def test_rejected_amendment_preserves_active_version(client, owner):
    actors, cid, offer_id = setup_scenario(client, owner)
    answer_all(client, actors, offer_id)
    version = client.get(f"/api/v1/contracts/{cid}", headers=owner).json()["proposed_version"]
    confirm_all(client, actors, version["id"])
    client.post(
        f"/api/v1/demo/contracts/{cid}/supplier-confirmation",
        headers=owner,
        json={"version_id": version["id"], "confirmed": True},
    )
    new = client.post(
        f"/api/v1/contracts/{cid}/amendments",
        headers=owner,
        json={"base_version_id": version["id"], "delivery_window": window(15), "reason": "Новый срок"},
    ).json()
    task = next(
        t for t in client.get("/api/v1/signature-tasks", headers=owner).json()["items"] if t["version_id"] == new["id"]
    )
    assert (
        client.post(
            f"/api/v1/signature-tasks/{task['id']}/reject",
            headers=owner,
            json={"version_id": new["id"], "document_hash": new["document_hash"], "reason": "Отказ"},
        ).status_code
        == 200
    )
    current = client.get(f"/api/v1/contracts/{cid}", headers=owner).json()
    assert current["status"] == "active" and current["active_version_id"] == version["id"]
    assert current["proposed_version_id"] is None


def test_smtp_starttls_path(monkeypatch):
    calls = []

    class FakeSMTP:
        def __init__(self, host, port, timeout):
            calls.append((host, port))

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def starttls(self, context):
            calls.append("tls")

        def login(self, username, password):
            calls.append("login")

        def send_message(self, message):
            assert "/verify-email?token=test-token" in message.get_content()
            calls.append("send")

    monkeypatch.setattr("app.mail.smtplib.SMTP", FakeSMTP)
    monkeypatch.setattr(settings(), "mail_mode", "smtp")
    monkeypatch.setattr(settings(), "smtp_host", "smtp.example.com")
    monkeypatch.setattr(settings(), "smtp_username", "demo")
    send_token_email("a@example.com", "test-token", "verify")
    assert calls == [("smtp.example.com", 587), "tls", "login", "send"]


def test_profile_edit_locks_after_analysis(client, owner):
    body = {"name": "Название компании", "inn": "0000000020"}
    assert client.post("/api/v1/company", headers=owner, json=body).status_code == 200
    client.post("/api/v1/consents", headers=owner, json={"version": "2026-10-26-v1", "accepted": True})
    assert client.post("/api/v1/demo/generate", headers=owner, json={"seed": 42}).status_code == 201
    assert client.post("/api/v1/company", headers=owner, json=body).status_code == 409
