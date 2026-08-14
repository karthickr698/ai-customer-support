from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True)
class VectorSearchRequest:
    tenant_id: str
    query: str
    limit: int


@dataclass(frozen=True, slots=True)
class VectorSearchHit:
    id: str
    score: float
    content: str


class VectorSearchPort(Protocol):
    """Outbound vector search. Vector-DB SDKs implement this in adapters."""

    async def search(self, request: VectorSearchRequest) -> tuple[VectorSearchHit, ...]: ...
