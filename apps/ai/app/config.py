from pathlib import Path
from typing import Literal

from pydantic import AliasChoices, Field, ValidationError, field_validator
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
        populate_by_name=True,
    )

    env: Environment = "development"
    host: str = "0.0.0.0"
    port: int = Field(default=8000, gt=0, lt=65536)
    log_level: LogLevel = "info"
    service_name: str = "ai"
    llm_provider: str = Field(
        default="",
        validation_alias=AliasChoices("LLM_PROVIDER", "AI_LLM_PROVIDER"),
    )
    llm_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("LLM_API_KEY", "AI_LLM_API_KEY"),
    )
    llm_model: str = Field(
        default="gpt-4o-mini",
        validation_alias=AliasChoices("LLM_MODEL", "AI_LLM_MODEL"),
    )
    llm_base_url: str = Field(
        default="https://api.openai.com/v1",
        validation_alias=AliasChoices("LLM_BASE_URL", "AI_LLM_BASE_URL"),
    )
    llm_quality_model: str = Field(
        default="gpt-4o",
        validation_alias=AliasChoices("LLM_QUALITY_MODEL", "AI_LLM_QUALITY_MODEL"),
    )
    llm_max_attempts: int = Field(
        default=3,
        ge=1,
        le=5,
        validation_alias=AliasChoices("LLM_MAX_ATTEMPTS", "AI_LLM_MAX_ATTEMPTS"),
    )
    embedding_provider: str = Field(
        default="",
        validation_alias=AliasChoices("EMBEDDING_PROVIDER", "AI_EMBEDDING_PROVIDER"),
    )
    embedding_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("EMBEDDING_API_KEY", "AI_EMBEDDING_API_KEY"),
    )
    embedding_model: str = Field(
        default="text-embedding-3-small",
        validation_alias=AliasChoices("EMBEDDING_MODEL", "AI_EMBEDDING_MODEL"),
    )
    embedding_base_url: str = Field(
        default="https://api.openai.com/v1",
        validation_alias=AliasChoices("EMBEDDING_BASE_URL", "AI_EMBEDDING_BASE_URL"),
    )
    embedding_dimensions: int = Field(
        default=64,
        ge=8,
        le=3072,
        validation_alias=AliasChoices("EMBEDDING_DIMENSIONS", "AI_EMBEDDING_DIMENSIONS"),
    )
    vector_store_provider: str = Field(
        default="",
        validation_alias=AliasChoices("VECTOR_STORE_PROVIDER", "AI_VECTOR_STORE_PROVIDER"),
    )
    vector_database_url: str = Field(
        default="",
        validation_alias=AliasChoices("AI_VECTOR_DATABASE_URL", "VECTOR_DATABASE_URL"),
    )
    vector_schema: str = Field(
        default="ai",
        validation_alias=AliasChoices("AI_VECTOR_SCHEMA", "VECTOR_SCHEMA"),
    )
    rag_top_k: int = Field(
        default=5,
        ge=1,
        le=20,
        validation_alias=AliasChoices("RAG_TOP_K", "AI_RAG_TOP_K"),
    )
    rag_candidate_k: int = Field(
        default=20,
        ge=1,
        le=50,
        validation_alias=AliasChoices("RAG_CANDIDATE_K", "AI_RAG_CANDIDATE_K"),
    )
    rag_max_top_k: int = Field(
        default=20,
        ge=1,
        le=50,
        validation_alias=AliasChoices("RAG_MAX_TOP_K", "AI_RAG_MAX_TOP_K"),
    )
    rag_vector_weight: float = Field(
        default=0.6,
        ge=0.0,
        le=1.0,
        validation_alias=AliasChoices("RAG_VECTOR_WEIGHT", "AI_RAG_VECTOR_WEIGHT"),
    )
    rag_keyword_weight: float = Field(
        default=0.4,
        ge=0.0,
        le=1.0,
        validation_alias=AliasChoices("RAG_KEYWORD_WEIGHT", "AI_RAG_KEYWORD_WEIGHT"),
    )
    rag_rerank_enabled: bool = Field(
        default=True,
        validation_alias=AliasChoices("RAG_RERANK_ENABLED", "AI_RAG_RERANK_ENABLED"),
    )
    rag_rrf_k: int = Field(
        default=60,
        ge=1,
        le=200,
        validation_alias=AliasChoices("RAG_RRF_K", "AI_RAG_RRF_K"),
    )

    @field_validator("host")
    @classmethod
    def host_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("AI_HOST must not be empty")
        return value

    @field_validator("vector_schema")
    @classmethod
    def vector_schema_must_be_ident(cls, value: str) -> str:
        ident = value.strip()
        if not ident or not ident.replace("_", "").isalnum() or ident[0].isdigit():
            raise ValueError("AI_VECTOR_SCHEMA must be a valid SQL identifier")
        return ident


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
