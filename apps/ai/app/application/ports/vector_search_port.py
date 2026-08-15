from dataclasses import dataclass, field
from typing import Literal, Mapping, Protocol

from app.domain.retrieval import RetrievalFilter

SearchMode = Literal["vector", "keyword", "hybrid"]


@dataclass(frozen=True, slots=True)
class VectorSearchRequest:
    tenant_id: str
    query: str
    limit: int
    document_id: str | None = None
    query_embedding: tuple[float, ...] | None = None
    mode: SearchMode = "hybrid"
    filters: RetrievalFilter | None = None
    candidate_limit: int | None = None
    vector_weight: float = 0.6
    keyword_weight: float = 0.4
    rrf_k: int = 60


@dataclass(frozen=True, slots=True)
class VectorSearchHit:
    id: str
    score: float
    content: str
    document_id: str | None = None
    version: int | None = None
    chunk_index: int | None = None
    metadata: Mapping[str, str | int | None] = field(default_factory=dict)
    vector_score: float | None = None
    keyword_score: float | None = None


@dataclass(frozen=True, slots=True)
class VectorRecord:
    id: str
    tenant_id: str
    document_id: str
    version: int
    chunk_index: int
    content: str
    embedding: tuple[float, ...]
    metadata: Mapping[str, str | int | None]


class VectorSearchPort(Protocol):
    """Outbound vector search. Vector-DB SDKs implement this in adapters."""

    async def search(self, request: VectorSearchRequest) -> tuple[VectorSearchHit, ...]: ...


class VectorIndexPort(Protocol):
    """Upsert and delete tenant-scoped document vectors. Search is included for retrieval."""

    async def upsert(self, records: tuple[VectorRecord, ...]) -> None: ...

    async def delete_by_document(
        self,
        *,
        tenant_id: str,
        document_id: str,
        version: int | None = None,
        exclude_version: int | None = None,
    ) -> int: ...

    async def search(self, request: VectorSearchRequest) -> tuple[VectorSearchHit, ...]: ...
