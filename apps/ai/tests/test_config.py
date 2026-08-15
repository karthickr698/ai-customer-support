import pytest
from pydantic import ValidationError

from app.config import Settings, load_settings, override_settings, reset_settings
from app.domain.errors import ConfigurationError


def test_settings_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    for key in ("AI_ENV", "AI_HOST", "AI_PORT", "AI_LOG_LEVEL"):
        monkeypatch.delenv(key, raising=False)

    settings = Settings(_env_file=None)

    assert settings.env == "development"
    assert settings.host == "0.0.0.0"
    assert settings.port == 8000
    assert settings.service_name == "ai"
    assert settings.log_level == "info"
    assert settings.rag_top_k == 5
    assert settings.vector_store_provider == ""
    assert settings.embedding_dimensions == 64
    assert settings.llm_quality_model == "gpt-4o"
    assert settings.llm_max_attempts == 3


def test_settings_read_prefixed_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AI_ENV", "production")
    monkeypatch.setenv("AI_HOST", "127.0.0.1")
    monkeypatch.setenv("AI_PORT", "8010")
    monkeypatch.setenv("AI_LOG_LEVEL", "debug")
    reset_settings()

    settings = Settings(_env_file=None)

    assert settings.env == "production"
    assert settings.host == "127.0.0.1"
    assert settings.port == 8010
    assert settings.log_level == "debug"


def test_settings_ignore_unprefixed_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PORT", "3000")
    monkeypatch.delenv("AI_PORT", raising=False)

    settings = Settings(_env_file=None)

    assert settings.port == 8000


def test_settings_reject_invalid_port() -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None, port=0)


def test_load_settings_wraps_invalid_configuration(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AI_PORT", "not-a-port")
    reset_settings()

    with pytest.raises(ConfigurationError) as exc_info:
        load_settings()

    assert exc_info.value.code == "CONFIGURATION_ERROR"


def test_override_and_reset_settings() -> None:
    reset_settings()
    override_settings(Settings(_env_file=None, env="test", port=8099))
    from app.config import get_settings

    assert get_settings().port == 8099
    reset_settings()
