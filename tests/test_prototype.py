from conftest import account


def test_state_persists_and_isolated(client, owner):
    original = client.get("/api/v1/prototype/state", headers=owner).json()
    modified = {**original["state"], "ownQuantity": 150}
    response = client.put(
        "/api/v1/prototype/state", headers=owner, json={"revision": original["revision"], "state": modified}
    )
    assert response.status_code == 200 and response.json()["revision"] == original["revision"] + 1
    assert client.get("/api/v1/prototype/state", headers=owner).json()["state"]["ownQuantity"] == 150
    assert (
        client.put(
            "/api/v1/prototype/state", headers=owner, json={"revision": original["revision"], "state": modified}
        ).status_code
        == 409
    )
    other = account(client, "other@example.com")
    assert client.get("/api/v1/prototype/state", headers=other).json()["state"]["ownQuantity"] == 100


def test_unknown_schema_rejected(client, owner):
    assert (
        client.put("/api/v1/prototype/state", headers=owner, json={"revision": 1, "state": {"schema": 0}}).status_code
        == 422
    )
