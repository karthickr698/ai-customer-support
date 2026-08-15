from dataclasses import dataclass
from typing import Protocol

from app.application.ports.vector_search_port import VectorSearchHit


@dataclass(frozen=True, slots=True)
class RerankRequest:
    tenant_id: str
    query: str
    hits: tuple[VectorSearchHit, ...]
    top_k: int


class RerankPort(Protocol):
    """Rerank retrieved chunks. Model adapters may replace the heuristic implementation."""

    async def rerank(self, request: RerankRequest) -> tuple[VectorSearchHit, ...]: ...
