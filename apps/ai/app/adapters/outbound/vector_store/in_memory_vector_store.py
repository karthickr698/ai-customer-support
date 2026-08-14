import math
from threading import Lock

from app.application.ports.vector_search_port import (
    VectorIndexPort,
    VectorRecord,
    VectorSearchHit,
    VectorSearchRequest,
)
from app.domain.errors import TenantContextRequiredError


class InMemoryVectorStoreAdapter(VectorIndexPort):
    """Process-local vector index. Replace with a vector DB adapter without changing use cases."""

    def __init__(self) -> None:
        self._records: dict[str, VectorRecord] = {}
        self._lock = Lock()

    async def upsert(self, records: tuple[VectorRecord, ...]) -> None:
        with self._lock:
            for record in records:
                _require_tenant(record.tenant_id)
                self._records[record.id] = record

    async def delete_by_document(
        self,
        *,
        tenant_id: str,
        document_id: str,
        version: int | None = None,
        exclude_version: int | None = None,
    ) -> int:
        _require_tenant(tenant_id)
        removed = 0
        with self._lock:
            to_delete = [
                record_id
                for record_id, record in self._records.items()
                if record.tenant_id == tenant_id
                and record.document_id == document_id
                and (version is None or record.version == version)
                and (exclude_version is None or record.version != exclude_version)
            ]
            for record_id in to_delete:
                del self._records[record_id]
                removed += 1
        return removed

    async def search(self, request: VectorSearchRequest) -> tuple[VectorSearchHit, ...]:
        _require_tenant(request.tenant_id)
        query = request.query.strip()
        if not query or request.limit < 1:
            return ()

        with self._lock:
            candidates = [
                record
                for record in self._records.values()
                if record.tenant_id == request.tenant_id
                and (request.document_id is None or record.document_id == request.document_id)
            ]

        if not candidates:
            return ()

        query_tokens = set(query.lower().split())
        scored: list[VectorSearchHit] = []
        for record in candidates:
            content_tokens = set(record.content.lower().split())
            overlap = len(query_tokens & content_tokens)
            cosine = _token_overlap_score(overlap, len(query_tokens), len(content_tokens))
            if cosine <= 0:
                continue
            scored.append(
                VectorSearchHit(
                    id=record.id,
                    score=cosine,
                    content=record.content,
                    document_id=record.document_id,
                    version=record.version,
                )
            )
        scored.sort(key=lambda hit: hit.score, reverse=True)
        return tuple(scored[: request.limit])


def _require_tenant(tenant_id: str) -> None:
    if not tenant_id.strip():
        raise TenantContextRequiredError()


def _token_overlap_score(overlap: int, left: int, right: int) -> float:
    if overlap == 0 or left == 0 or right == 0:
        return 0.0
    return overlap / math.sqrt(left * right)
