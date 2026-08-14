import hashlib
import math

from app.application.ports.embedding_port import EmbeddingPort, EmbeddingRequest, EmbeddingResult, EmbeddingResult

HASH_EMBEDDING_MODEL = "hash-v1"
HASH_EMBEDDING_DIMENSIONS = 64


class HashEmbeddingAdapter(EmbeddingPort):
    """Deterministic embeddings for local development and tests. Not a live provider."""

    def __init__(self, dimensions: int = HASH_EMBEDDING_DIMENSIONS) -> None:
        if dimensions < 8:
            raise ValueError("Embedding dimensions must be at least 8")
        self._dimensions = dimensions

    async def embed(self, request: EmbeddingRequest) -> EmbeddingResult:
        if not request.tenant_id.strip():
            raise ValueError("tenant_id is required")
        vectors = tuple(_hash_vector(text, self._dimensions) for text in request.texts)
        return EmbeddingResult(
            vectors=vectors,
            model=HASH_EMBEDDING_MODEL,
            dimensions=self._dimensions,
            token_count=sum(len(text.split()) for text in request.texts),
        )


def _hash_vector(text: str, dimensions: int) -> tuple[float, ...]:
    values: list[float] = []
    seed = text.encode("utf-8")
    counter = 0
    while len(values) < dimensions:
        digest = hashlib.sha256(seed + counter.to_bytes(4, "big")).digest()
        for index in range(0, len(digest), 2):
            raw = int.from_bytes(digest[index : index + 2], "big")
            values.append((raw / 65535.0) * 2.0 - 1.0)
            if len(values) == dimensions:
                break
        counter += 1
    norm = math.sqrt(sum(value * value for value in values)) or 1.0
    return tuple(value / norm for value in values)
