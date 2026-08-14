from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True)
class EmbeddingRequest:
    texts: tuple[str, ...]
    tenant_id: str


@dataclass(frozen=True, slots=True)
class EmbeddingResult:
    vectors: tuple[tuple[float, ...], ...]
    model: str
    dimensions: int
    token_count: int = 0


class EmbeddingPort(Protocol):
    """Outbound embedding capability. Provider SDKs implement this in adapters."""

    async def embed(self, request: EmbeddingRequest) -> EmbeddingResult: ...
