from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.adapters.inbound.http.app import create_app
from app.config import Settings
from app.domain.errors import RateLimitExceededError


class _Payload(BaseModel):
    tenant_id: str


def _app_with_test_routes(settings: Settings) -> FastAPI:
    application = create_app(settings)

    @application.get("/__test__/domain-error")
    async def domain_error() -> None:
        raise RateLimitExceededError("Too many requests")

    @application.get("/__test__/crash")
    async def crash() -> None:
        raise RuntimeError("secret internals")

    @application.post("/__test__/validate")
    async def validate(payload: _Payload) -> _Payload:
        return payload

    return application


def test_domain_error_is_structured(settings: Settings) -> None:
    with TestClient(_app_with_test_routes(settings)) as client:
        response = client.get("/__test__/domain-error")

    assert response.status_code == 429
    assert response.json() == {
        "error": {"code": "RATE_LIMIT_EXCEEDED", "message": "Too many requests"}
    }


def test_unhandled_error_hides_internals(settings: Settings) -> None:
    with TestClient(
        _app_with_test_routes(settings),
        raise_server_exceptions=False,
    ) as client:
        response = client.get("/__test__/crash")

    assert response.status_code == 500
    body = response.json()
    assert body == {"error": {"code": "INTERNAL_ERROR", "message": "An unexpected error occurred"}}
    assert "secret internals" not in response.text
    assert "Traceback" not in response.text


def test_not_found_is_structured(client: TestClient) -> None:
    response = client.get("/does-not-exist")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"
    assert response.json()["error"]["message"] == "Not found"


def test_validation_error_is_structured(settings: Settings) -> None:
    with TestClient(_app_with_test_routes(settings)) as client:
        response = client.post("/__test__/validate", json={})

    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert body["error"]["message"] == "Request validation failed"
    assert isinstance(body["error"]["details"], list)
