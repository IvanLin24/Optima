import pytest
from app.demo import make_statement
from app.statements import parse_1c, StatementError, money


@pytest.mark.parametrize("encoding", ["cp1251", "utf-8-sig"])
def test_encodings_and_ambiguous_purpose(encoding):
    data = make_statement("Тест", "0000000010", 4000).decode("cp1251").encode(encoding)
    rows, errors = parse_1c(data, "0000000010")
    assert not errors and len(rows) == 3
    assert rows[0]["amount_minor"] == 2400000
    assert rows[0]["direction"] == "outgoing"
    assert "уточнение" in rows[1]["purpose"]


@pytest.mark.parametrize("value", ["NaN", "Infinity", "-1", "0", "0.001", "100000000001"])
def test_invalid_money(value):
    with pytest.raises(StatementError):
        money(value)


def test_money_precision_and_corruption():
    assert money("1 234,56") == 123456
    data = make_statement("Тест", "0000000010", 4000)
    rows, errors = parse_1c(data, "9999999999")
    assert not rows and len(errors) == 3
    with pytest.raises(StatementError):
        parse_1c(data.replace("КонецФайла".encode("cp1251"), b""), "0000000010")


def test_import_requires_consent_and_deduplicates(client, owner):
    data = make_statement("Тест", "0000000010", 4000)
    files = {"file": ("statement.txt", data)}
    assert client.post("/api/v1/statement-imports", headers=owner, files=files).status_code == 403
    assert (
        client.post("/api/v1/consents", headers=owner, json={"version": "2026-10-26-v1", "accepted": True}).status_code
        == 200
    )
    first = client.post("/api/v1/statement-imports", headers=owner, files=files)
    assert first.status_code == 201, first.text
    assert first.json()["inserted"] == 3
    second = client.post("/api/v1/statement-imports", headers=owner, files=files)
    assert second.json()["inserted"] == 0 and second.json()["duplicates"] == 3
    assert len(client.get("/api/v1/transactions", headers=owner).json()["items"]) == 3


def test_bad_file_and_upload_size(client, owner, monkeypatch):
    from app.config import settings

    client.post("/api/v1/consents", headers=owner, json={"version": "2026-10-26-v1", "accepted": True})
    assert client.post("/api/v1/statement-imports", headers=owner, files={"file": ("x.txt", b"bad")}).status_code == 422
    monkeypatch.setattr(settings(), "max_upload_bytes", 5)
    assert (
        client.post("/api/v1/statement-imports", headers=owner, files={"file": ("x.txt", b"123456")}).status_code == 413
    )
