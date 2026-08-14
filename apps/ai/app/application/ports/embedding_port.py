from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True)
class EmbeddingRequest:
    texts: tuple[str, ...]
    tenant_id: str


class EmbeddingPort(Protocol):
    """Outbound embedding capability. Provider SDKs implement this in adapters."""

    async def embed(self, request: EmbeddingRequest) -> tuple[tuple[float, ...], ...]: ...
