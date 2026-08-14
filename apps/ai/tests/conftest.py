import os
from collections.abc import Iterator

os.environ.setdefault("AI_ENV", "test")

import pytest
from fastapi.testclient import TestClient

from app.adapters.inbound.http.app import create_app
from app.config import Settings, reset_settings


@pytest.fixture
def settings() -> Settings:
    reset_settings()
    return Settings(
        _env_file=None,
        env="test",
        log_level="warning",
        host="127.0.0.1",
        port=8000,
    )


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    application = create_app(settings)
    with TestClient(application) as test_client:
        yield test_client
