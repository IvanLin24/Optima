import os
from pathlib import Path
import re
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault("ENABLE_DEMO", "true")
os.environ.setdefault("MAIL_MODE", "file")

from app.config import settings  # noqa: E402
from app.db import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture
def db_engine():
    # Set TEST_DATABASE_URL to an EMPTY dedicated PostgreSQL database for integration tests.
    url = os.environ.get("TEST_DATABASE_URL", "sqlite://")
    kwargs = {"poolclass": StaticPool, "connect_args": {"check_same_thread": False}} if url == "sqlite://" else {}
    engine = create_engine(url, **kwargs)
    if url.startswith("sqlite"):

        @event.listens_for(engine, "connect")
        def fk(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture
def client(db_engine, tmp_path, monkeypatch):
    monkeypatch.setattr(settings(), "mail_dir", str(tmp_path / "mail"))
    monkeypatch.setattr(settings(), "enable_demo", True)
    monkeypatch.setattr(settings(), "app_env", "development")
    monkeypatch.setattr(settings(), "mail_mode", "file")
    factory = sessionmaker(db_engine, expire_on_commit=False)

    def override():
        with factory() as db:
            try:
                yield db
            except Exception:
                db.rollback()
                raise

    app.dependency_overrides[get_db] = override
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


def mail_token(email):
    from email import policy
    from email.parser import BytesParser

    for path in reversed(sorted(Path(settings().mail_dir).glob("*.eml"), key=lambda p: p.stat().st_mtime_ns)):
        msg = BytesParser(policy=policy.default).parsebytes(path.read_bytes())
        if str(msg["To"]) == email:
            return re.search(r"Ваш код: (\d{6})", msg.get_body(preferencelist=("plain",)).get_content()).group(1)
    raise AssertionError("No message for " + email)


def account(client, email="owner@example.com", inn="0000000010"):
    response = client.post(
        "/api/v1/auth/virtual-company",
        json={"email": email, "password": "VeryStrongPass123!"},
    )
    assert response.status_code == 202, response.text
    response = client.post(
        "/api/v1/auth/verify-code",
        json={"email": email, "challenge_id": response.json()["challenge_id"], "code": mail_token(email)},
    )
    assert response.status_code == 200, response.text
    headers = {"Authorization": "Bearer " + response.json()["access_token"]}
    if inn != "0000000010":
        assert (
            client.post("/api/v1/company", headers=headers, json={"name": "Тестовая компания", "inn": inn}).status_code
            == 200
        )
    return headers


@pytest.fixture
def owner(client):
    return account(client)
