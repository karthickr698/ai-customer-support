from fastapi.testclient import TestClient


def test_health_returns_ok(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "ai"}


def test_health_echoes_request_and_correlation_ids(client: TestClient) -> None:
    response = client.get(
        "/health",
        headers={
            "x-request-id": "req-123",
            "x-correlation-id": "corr-456",
            "x-tenant-id": "tenant-789",
        },
    )

    assert response.status_code == 200
    assert response.headers["x-request-id"] == "req-123"
    assert response.headers["x-correlation-id"] == "corr-456"


def test_health_generates_request_id_when_missing(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.headers["x-request-id"]
    assert response.headers["x-correlation-id"] == response.headers["x-request-id"]
