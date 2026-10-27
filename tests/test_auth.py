import time
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.models import User, Company, EmailChallenge, PrototypeWorkspace
from conftest import mail_token


def create(client, email="new@example.com"):
    response = client.post("/api/v1/auth/virtual-company", json={"email": email, "password": "VeryStrongPass123!"})
    assert response.status_code == 202, response.text
    return {"email": email, "challenge_id": response.json()["challenge_id"], "code": mail_token(email)}


def test_no_data_before_code_and_single_use(client, db_engine):
    body = create(client)
    with Session(db_engine) as db:
        assert db.scalar(select(func.count(User.id))) == 0
        assert db.scalar(select(func.count(Company.id))) == 0
    response = client.post("/api/v1/auth/verify-code", json=body)
    assert response.status_code == 200, response.text
    assert client.post("/api/v1/auth/verify-code", json=body).status_code == 400
    headers = {"Authorization": "Bearer " + response.json()["access_token"]}
    state = client.get("/api/v1/prototype/state", headers=headers)
    assert len(state.json()["companies"]) == 8
    with Session(db_engine) as db:
        user = db.scalar(select(User))
        assert user.password_hash.startswith("$argon2id$") and user.verified
        assert db.get(PrototypeWorkspace, user.company_id)
        assert db.scalar(select(EmailChallenge)).code_hash != body["code"]
    assert client.post("/api/v1/auth/logout", headers=headers).status_code == 200
    assert client.get("/api/v1/me", headers=headers).status_code == 401


def test_login_only_with_email_code(client, owner, monkeypatch):
    assert (
        client.post(
            "/api/v1/auth/login", json={"email": "owner@example.com", "password": "VeryStrongPass123!"}
        ).status_code
        == 422
    )
    monkeypatch.setattr("app.auth.quota", lambda *args: None)
    result = client.post("/api/v1/auth/login", json={"email": "owner@example.com"})
    assert result.status_code == 202
    confirmed = client.post(
        "/api/v1/auth/verify-code",
        json={
            "email": "owner@example.com",
            "challenge_id": result.json()["challenge_id"],
            "code": mail_token("owner@example.com"),
        },
    )
    assert confirmed.status_code == 200


def test_five_wrong_attempts_block_even_correct_code(client):
    body = create(client)
    wrong = "999999" if body["code"] != "999999" else "888888"
    for _ in range(5):
        result = client.post("/api/v1/auth/verify-code", json={**body, "code": wrong})
        assert result.status_code == 400
    assert client.post("/api/v1/auth/verify-code", json=body).status_code == 400


def test_expired_code(client, db_engine):
    body = create(client)
    with Session(db_engine) as db:
        db.get(EmailChallenge, body["challenge_id"]).expires_at = int(time.time()) - 1
        db.commit()
    assert client.post("/api/v1/auth/verify-code", json=body).status_code == 400


def test_code_bound_to_email(client):
    body = create(client)
    assert client.post("/api/v1/auth/verify-code", json={**body, "email": "other@example.com"}).status_code == 400


def test_resend_before_company_exists(client, monkeypatch):
    body = create(client)
    monkeypatch.setattr("app.auth.quota", lambda *args: None)
    result = client.post(
        "/api/v1/auth/resend-code", json={"email": body["email"], "challenge_id": body["challenge_id"]}
    )
    assert result.status_code == 202
    assert client.post("/api/v1/auth/verify-code", json=body).status_code == 400
    assert (
        client.post(
            "/api/v1/auth/verify-code",
            json={
                "email": body["email"],
                "challenge_id": result.json()["challenge_id"],
                "code": mail_token(body["email"]),
            },
        ).status_code
        == 200
    )


def test_cooldown(client):
    create(client)
    assert (
        client.post(
            "/api/v1/auth/virtual-company", json={"email": "new@example.com", "password": "VeryStrongPass123!"}
        ).status_code
        == 429
    )


def test_disposable_and_subdomains(client):
    for domain in ["mailinator.com", "sub.mailinator.com", "10minutemail.com"]:
        result = client.post(
            "/api/v1/auth/virtual-company", json={"email": "someone@" + domain, "password": "VeryStrongPass123!"}
        )
        assert result.status_code == 422 and result.json()["error"]["code"] == "DISPOSABLE_EMAIL"


def test_validation_never_echoes_secrets(client):
    result = client.post("/api/v1/auth/virtual-company", json={"email": "bad", "password": "secret"})
    assert result.status_code == 422 and "secret" not in result.text


def test_no_public_auth_bypasses(client):
    assert client.post("/api/v1/demo/sessions").status_code == 410
    assert client.post("/api/v1/auth/verify-email", json={"token": "x" * 32}).status_code == 410


def test_login_ip_limit(client, monkeypatch):
    monkeypatch.setattr("app.auth.quota", lambda *args: None)
    for i in range(30):
        assert client.post("/api/v1/auth/login", json={"email": f"none{i}@example.com"}).status_code == 202
    assert client.post("/api/v1/auth/login", json={"email": "none@example.com"}).status_code == 429
