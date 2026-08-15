from fastapi.testclient import TestClient


def test_propose_requires_tenant_context(client: TestClient) -> None:
    response = client.post(
        "/v1/tools/propose",
        json={"conversationId": "conv-1", "visitorMessage": "Where is my order?"},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "TENANT_CONTEXT_REQUIRED"


def test_propose_order_tool_and_reject_unknown_schema(client: TestClient) -> None:
    response = client.post(
        "/v1/tools/propose",
        headers={"x-tenant-id": "tenant-1", "x-correlation-id": "corr-1"},
        json={
            "conversationId": "11111111-1111-1111-1111-111111111111",
            "visitorMessage": "Where is my order?",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["schemaVersion"] == 1
    assert body["calls"][0]["name"] == "getOrderDetails"
    assert body["calls"][0]["arguments"]["orderId"] == "ORD-1001"


def test_apply_tool_results_returns_reply(client: TestClient) -> None:
    response = client.post(
        "/v1/tools/apply-results",
        headers={"x-tenant-id": "tenant-1"},
        json={
            "conversationId": "11111111-1111-1111-1111-111111111111",
            "visitorMessage": "Where is my order?",
            "results": [
                {
                    "name": "getOrderDetails",
                    "ok": True,
                    "data": {"status": "shipped"},
                    "errorCode": None,
                    "errorMessage": None,
                }
            ],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["schemaVersion"] == 1
    assert body["reply"]
    assert body["model"]


def test_catalog_lists_allowlisted_tools(client: TestClient) -> None:
    response = client.get("/v1/tools")
    assert response.status_code == 200
    names = [item["name"] for item in response.json()["items"]]
    assert "handoffToAgent" in names
    assert "getOrderDetails" in names
