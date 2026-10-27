from datetime import timedelta
from app.scene import today
from conftest import account


def get_scene(client, owner):
    response = client.get("/api/v1/prototype/scene", headers=owner)
    assert response.status_code == 200, response.text
    return response.json()


def test_full_seed_and_isolated_business_databases(client, owner):
    scene = get_scene(client, owner)
    assert scene["totals"] == {"businesses": 40, "operations": 480, "needs": 40}
    assert len(scene["deals"]) == 3
    assert scene["boundary"]["type"] in ["Polygon", "MultiPolygon"]
    first = scene["businesses"][0]["id"]
    second = scene["businesses"][1]["id"]
    original = client.get(f"/api/v1/prototype/scene/businesses/{first}", headers=owner).json()
    assert (
        original["data"]["opening_balance_minor"] - sum(o["amount_minor"] for o in original["data"]["operations"])
        == original["balance_minor"]
    )
    response = client.post(
        f"/api/v1/prototype/scene/businesses/{first}/operations", headers=owner, json={"sku": "paper", "quantity": 2}
    )
    assert response.status_code == 201
    changed = client.get(f"/api/v1/prototype/scene/businesses/{first}", headers=owner).json()
    assert changed["operation_count"] == 13 and changed["balance_minor"] == original["balance_minor"] - 72000
    assert client.get(f"/api/v1/prototype/scene/businesses/{second}", headers=owner).json()["operation_count"] == 12
    other = account(client, "other@example.com")
    assert client.get(f"/api/v1/prototype/scene/businesses/{first}", headers=other).status_code == 404
    assert get_scene(client, other)["totals"]["operations"] == 480


def test_create_business_need_and_future_only(client, owner):
    get_scene(client, owner)
    response = client.post(
        "/api/v1/prototype/scene/businesses",
        headers=owner,
        json={
            "name": "Новая кофейня",
            "category": "Кофейня",
            "address": "Москва, тестовый адрес",
            "latitude": 55.777,
            "longitude": 37.587,
        },
    )
    assert response.status_code == 201
    ident = response.json()["id"]
    assert response.json()["operation_count"] == 0
    need = {"sku": "coffee", "quantity": 20, "delivery_date": (today() + timedelta(days=7)).isoformat()}
    assert client.post(f"/api/v1/prototype/scene/businesses/{ident}/needs", headers=owner, json=need).status_code == 201
    assert client.get(f"/api/v1/prototype/scene/businesses/{ident}", headers=owner).json()["need_count"] == 1
    assert (
        client.post(
            f"/api/v1/prototype/scene/businesses/{ident}/needs",
            headers=owner,
            json={**need, "delivery_date": today().isoformat()},
        ).status_code
        == 422
    )
    assert get_scene(client, owner)["totals"]["businesses"] == 41


def test_joint_purchase_all_stages_versions_and_no_double_matching(client, owner):
    get_scene(client, owner)
    body = {"sku": "paper", "delivery_date": (today() + timedelta(days=7)).isoformat()}
    result = client.post("/api/v1/prototype/scene/deals", headers=owner, json=body)
    assert result.status_code == 201, result.text
    deal = result.json()
    assert len(deal["participants"]) == 9 and deal["totals"]["quantity"] == 1000
    assert deal["totals"]["fee_minor"] == 180000 and deal["totals"]["net_savings_minor"] == 5820000
    assert client.post("/api/v1/prototype/scene/deals", headers=owner, json=body).status_code == 409
    first_revision = deal["revision"]
    for status in ["confirmed", "paid", "delivered"]:
        response = client.post(
            f"/api/v1/prototype/scene/deals/{deal['id']}/advance", headers=owner, json={"revision": deal["revision"]}
        )
        assert response.status_code == 200, response.text
        deal = response.json()
        assert deal["status"] == status
    assert (
        client.post(
            f"/api/v1/prototype/scene/deals/{deal['id']}/advance", headers=owner, json={"revision": first_revision}
        ).status_code
        == 409
    )
    for share in deal["participants"]:
        biz = client.get(f"/api/v1/prototype/scene/businesses/{share['business_id']}", headers=owner).json()
        assert next(c for c in biz["data"]["contracts"] if c["id"] == deal["id"])["status"] == "delivered"
        assert biz["operation_count"] == 13
    assert client.get(f"/api/v1/prototype/scene/deals/{deal['id']}/document", headers=owner).status_code == 200
    other = account(client, "outsider@example.com")
    assert client.get(f"/api/v1/prototype/scene/deals/{deal['id']}/document", headers=other).status_code == 404
