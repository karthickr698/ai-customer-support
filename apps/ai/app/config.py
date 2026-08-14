from pathlib import Path
from typing import Literal

from pydantic import Field, ValidationError, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.domain.errors import ConfigurationError

type Environment = Literal["development", "test", "production"]
type LogLevel = Literal["debug", "info", "warning", "error"]


def _env_files() -> tuple[str, ...]:
    repo_root = Path(__file__).resolve().parents[2]
    files: list[str] = []
    for candidate in (repo_root / ".env", Path.cwd() / ".env"):
        resolved = str(candidate.resolve())
        if candidate.is_file() and resolved not in files:
            files.append(resolved)
    return tuple(files)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="AI_",
        env_file=_env_files(),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    env: Environment = "development"
    host: str = "0.0.0.0"
    port: int = Field(default=8000, gt=0, lt=65536)
    log_level: LogLevel = "info"
    service_name: str = "ai"

    @field_validator("host")
    @classmethod
    def host_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("AI_HOST must not be empty")
        return value


def load_settings() -> Settings:
    try:
        return Settings()
    except ValidationError as exc:
        raise ConfigurationError(f"Invalid AI service configuration: {exc}") from exc


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = load_settings()
    return _settings


def override_settings(settings: Settings) -> Settings:
    global _settings
    _settings = settings
    return settings


def reset_settings() -> None:
    global _settings
    _settings = None
