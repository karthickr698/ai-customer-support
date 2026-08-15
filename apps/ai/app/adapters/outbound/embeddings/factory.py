from app.adapters.outbound.embeddings.hash_embedding_adapter import HashEmbeddingAdapter
from app.adapters.outbound.embeddings.openai.openai_embedding_adapter import OpenAIEmbeddingAdapter
from app.application.ports.embedding_port import EmbeddingPort
from app.config import Settings
from app.domain.errors import ConfigurationError
from app.logging import get_logger


def create_embedding_port(settings: Settings) -> EmbeddingPort:
    provider = (settings.embedding_provider or "").strip().lower()
    api_key = (settings.embedding_api_key or settings.llm_api_key or "").strip()

    if provider in ("hash", "heuristic", "none"):
        return HashEmbeddingAdapter(dimensions=settings.embedding_dimensions)

    if provider in ("openai", "openai_compatible") or (provider == "" and api_key):
        if not api_key:
            if settings.env == "production":
                raise ConfigurationError("EMBEDDING_API_KEY is required when EMBEDDING_PROVIDER is openai")
            return HashEmbeddingAdapter(dimensions=settings.embedding_dimensions)
        return OpenAIEmbeddingAdapter(
            api_key=api_key,
            model=settings.embedding_model,
            base_url=settings.embedding_base_url,
            logger=get_logger("embeddings.openai"),
        )

    if provider == "" and not api_key:
        return HashEmbeddingAdapter(dimensions=settings.embedding_dimensions)

    raise ConfigurationError(f"Unsupported EMBEDDING_PROVIDER: {settings.embedding_provider}")
