from app.adapters.outbound.vector_store.in_memory_vector_store import InMemoryVectorStoreAdapter
from app.adapters.outbound.vector_store.pgvector_store import PgVectorStoreAdapter
from app.application.ports.vector_search_port import VectorIndexPort
from app.config import Settings
from app.domain.errors import ConfigurationError
from app.logging import get_logger


def create_vector_index_port(settings: Settings) -> VectorIndexPort:
    provider = (settings.vector_store_provider or "").strip().lower()
    if provider in ("", "memory", "in_memory", "none"):
        return InMemoryVectorStoreAdapter()
    if provider in ("pgvector", "postgres", "postgresql"):
        url = (settings.vector_database_url or "").strip()
        if not url:
            if settings.env == "production":
                raise ConfigurationError(
                    "AI_VECTOR_DATABASE_URL is required when VECTOR_STORE_PROVIDER is pgvector"
                )
            get_logger("vector").warning(
                "pgvector selected without AI_VECTOR_DATABASE_URL; using in-memory index"
            )
            return InMemoryVectorStoreAdapter()
        return PgVectorStoreAdapter(
            dsn=url,
            schema=settings.vector_schema,
            embedding_dimensions=settings.embedding_dimensions,
            logger=get_logger("vector.pgvector"),
        )
    raise ConfigurationError(f"Unsupported VECTOR_STORE_PROVIDER: {settings.vector_store_provider}")


async def close_vector_index_port(port: VectorIndexPort) -> None:
    close = getattr(port, "close", None)
    if close is not None:
        await close()
