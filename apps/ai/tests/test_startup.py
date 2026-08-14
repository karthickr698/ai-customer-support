from fastapi.testclient import TestClient

from app.adapters.inbound.http.app import create_app
from app.config import Settings
from app.domain.errors import AIProviderError, ConfigurationError, RateLimitExceededError


def test_lifespan_starts_and_shuts_down(settings: Settings) -> None:
    application = create_app(settings)

    with TestClient(application) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert application.state.settings.env == "test"


def test_error_codes() -> None:
    assert RateLimitExceededError("slow down").code == "RATE_LIMIT_EXCEEDED"
    assert RateLimitExceededError("slow down").status_code == 429
    assert AIProviderError("unavailable").status_code == 502
    assert ConfigurationError("bad config").status_code == 500
