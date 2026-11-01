from conftest import account
from sqlalchemy.orm import Session
from app.models import PrototypeWorkspace, Company


def payload(profile, **changes):
    keys = ["profile_revision", "name", "inn", "kpp", "legal_address", "contact_name", "contact_phone", "contact_email"]
    return {**{key: profile[key] for key in keys}, **changes}


def test_profile_private_and_persists_after_reload(client, owner):
    initial = client.get("/api/v1/company/profile", headers=owner)
    assert initial.status_code == 200
    profile = initial.json()
    assert profile["needs_setup"] is False and profile["contact_email"] is None
    saved = client.put("/api/v1/company/profile", headers=owner, json=payload(profile, name="ООО «Север»", inn="1234567890", kpp="123456789", legal_address="Москва, адрес компании", contact_name="Представитель", contact_phone="+7 000 000-00-00", contact_email="contact@example.com"))
    assert saved.status_code == 200, saved.text
    assert saved.json()["profile_revision"] == profile["profile_revision"] + 1
    assert saved.json()["needs_setup"] is False
    assert client.get("/api/v1/company/profile", headers=owner).json() == saved.json()
    assert client.get("/api/v1/prototype/state", headers=owner).json()["company"]["name"] == "ООО «Север»"
    other = account(client, "profile-other@example.com")
    other_profile = client.get("/api/v1/company/profile", headers=other).json()
    assert other_profile["id"] != profile["id"] and other_profile["contact_email"] is None
    assert client.get("/api/v1/company/profile").status_code == 401


def test_partial_profile_and_empty_optional_fields(client, owner):
    profile = client.get("/api/v1/company/profile", headers=owner).json()
    result = client.put("/api/v1/company/profile", headers=owner, json=payload(profile, name="  Моя компания  ", inn="", kpp="", legal_address=" ", contact_email=""))
    assert result.status_code == 200
    assert result.json()["name"] == "Моя компания"
    for key in ["inn", "kpp", "legal_address", "contact_email"]:
        assert result.json()[key] is None


def test_profile_rejects_stale_save_and_owner_injection(client, owner):
    profile = client.get("/api/v1/company/profile", headers=owner).json()
    assert client.put("/api/v1/company/profile", headers=owner, json=payload(profile, contact_name="Первое изменение")).status_code == 200
    stale = client.put("/api/v1/company/profile", headers=owner, json=payload(profile, contact_name="Устаревшее изменение"))
    assert stale.status_code == 409 and stale.json()["error"]["code"] == "PROFILE_CONFLICT"
    latest = client.get("/api/v1/company/profile", headers=owner).json()
    assert latest["contact_name"] == "Первое изменение"
    assert client.put("/api/v1/company/profile", headers=owner, json={**payload(latest), "company_id": "other-company"}).status_code == 422


def test_profile_validation(client, owner):
    profile = client.get("/api/v1/company/profile", headers=owner).json()
    for changes in [{"name": "  "}, {"inn": "123"}, {"kpp": "letters"}, {"contact_email": "not-an-email"}, {"legal_address": "x" * 501}]:
        assert client.put("/api/v1/company/profile", headers=owner, json=payload(profile, **changes)).status_code == 422


def test_order_locks_identity_but_not_contacts(client, owner, db_engine):
    profile = client.get("/api/v1/company/profile", headers=owner).json()
    with Session(db_engine) as db:
        workspace = db.get(PrototypeWorkspace, profile["id"])
        workspace.state = {**workspace.state, "accepted": True}
        db.commit()
    current = client.get("/api/v1/company/profile", headers=owner).json()
    assert current["can_edit_requisites"] is False
    saved = client.put("/api/v1/company/profile", headers=owner, json=payload(current, contact_name="Новый контакт"))
    assert saved.status_code == 200
    assert client.put("/api/v1/company/profile", headers=owner, json=payload(saved.json(), name="Другая компания")).status_code == 409
    assert client.post("/api/v1/company", headers=owner, json={"name": "Другая компания", "inn": "1234567890"}).status_code == 409


def test_old_generated_identity_clears_only_unconfigured_company(client, owner, db_engine):
    profile = client.get("/api/v1/company/profile", headers=owner).json()
    with Session(db_engine) as db:
        company = db.get(Company, profile["id"])
        company.name = "ООО «Линия A1CC»"
        company.inn = "0000000010"
        db.commit()
    state = client.get("/api/v1/prototype/state", headers=owner).json()
    assert state["company"]["name"] == "" and state["company"]["inn"] is None
    current = client.get("/api/v1/company/profile", headers=owner).json()
    assert current["needs_setup"] is True
    assert current["profile_revision"] == profile["profile_revision"] + 1
