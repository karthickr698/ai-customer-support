from threading import Lock

from app.application.ports.vector_search_port import (
    VectorIndexPort,
    VectorRecord,
    VectorSearchHit,
    VectorSearchRequest,
)
from app.domain.errors import TenantContextRequiredError
from app.rag.filters import effective_filter, matches_metadata
from app.rag.hybrid import hybrid_weights, reciprocal_rank_fusion
from app.rag.keyword import bm25_scores, tokenize
from app.rag.vector import cosine_similarity


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

        filters = effective_filter(request.filters, request.document_id)
        with self._lock:
            candidates = [
                record
                for record in self._records.values()
                if record.tenant_id == request.tenant_id
                and matches_metadata(record.metadata, filters, document_id=record.document_id)
            ]

        if not candidates:
            return ()

        candidate_limit = max(request.limit, request.candidate_limit or request.limit)
        vector_ranked = _vector_rank(candidates, request.query_embedding, candidate_limit)
        keyword_ranked = _keyword_rank(candidates, query, candidate_limit)

        if request.mode == "vector":
            selected = vector_ranked[: request.limit]
            return tuple(_to_hit(record, score, vector_score=score) for record, score in selected)
        if request.mode == "keyword" or not vector_ranked:
            selected = keyword_ranked[: request.limit]
            return tuple(_to_hit(record, score, keyword_score=score) for record, score in selected)
        if not keyword_ranked:
            selected = vector_ranked[: request.limit]
            return tuple(_to_hit(record, score, vector_score=score) for record, score in selected)

        vector_weight, keyword_weight = hybrid_weights(request.vector_weight, request.keyword_weight)
        fused = reciprocal_rank_fusion(
            (
                tuple(record.id for record, _score in vector_ranked),
                tuple(record.id for record, _score in keyword_ranked),
            ),
            weights=(vector_weight, keyword_weight),
            k=request.rrf_k,
        )
        by_id = {record.id: record for record in candidates}
        vector_scores = {record.id: score for record, score in vector_ranked}
        keyword_scores = {record.id: score for record, score in keyword_ranked}
        hits: list[VectorSearchHit] = []
        for record_id, score in fused[: request.limit]:
            record = by_id[record_id]
            hits.append(
                _to_hit(
                    record,
                    score,
                    vector_score=vector_scores.get(record_id),
                    keyword_score=keyword_scores.get(record_id),
                )
            )
        return tuple(hits)


def _vector_rank(
    candidates: list[VectorRecord],
    query_embedding: tuple[float, ...] | None,
    limit: int,
) -> list[tuple[VectorRecord, float]]:
    if not query_embedding:
        return []
    scored: list[tuple[VectorRecord, float]] = []
    for record in candidates:
        similarity = cosine_similarity(query_embedding, record.embedding)
        if similarity > 0:
            scored.append((record, similarity))
    scored.sort(key=lambda item: item[1], reverse=True)
    return scored[:limit]


def _keyword_rank(candidates: list[VectorRecord], query: str, limit: int) -> list[tuple[VectorRecord, float]]:
    documents = tuple(tokenize(record.content) for record in candidates)
    scores = bm25_scores(tokenize(query), documents)
    scored = [
        (record, score) for record, score in zip(candidates, scores, strict=True) if score > 0
    ]
    scored.sort(key=lambda item: item[1], reverse=True)
    return scored[:limit]


def _to_hit(
    record: VectorRecord,
    score: float,
    *,
    vector_score: float | None = None,
    keyword_score: float | None = None,
) -> VectorSearchHit:
    return VectorSearchHit(
        id=record.id,
        score=score,
        content=record.content,
        document_id=record.document_id,
        version=record.version,
        chunk_index=record.chunk_index,
        metadata=record.metadata,
        vector_score=vector_score,
        keyword_score=keyword_score,
    )


def _require_tenant(tenant_id: str) -> None:
    if not tenant_id.strip():
        raise TenantContextRequiredError()
