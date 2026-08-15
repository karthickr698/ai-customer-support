from __future__ import annotations

import logging
import time
from dataclasses import dataclass

from app.application.ports.embedding_port import EmbeddingPort, EmbeddingRequest
from app.application.ports.rerank_port import RerankPort, RerankRequest
from app.application.ports.vector_search_port import VectorIndexPort, VectorSearchHit, VectorSearchRequest
from app.domain.errors import AIError, InvalidRetrievalInputError, VectorIndexError
from app.domain.onboarding import require_tenant_id
from app.domain.retrieval import (
    Citation,
    RetrievalFilter,
    RetrievalPolicy,
    RetrievedChunk,
    normalize_retrieval_filter,
)
from app.rag.citations import citations_from_hits, chunks_from_hits
from app.rag.context import build_knowledge_context


@dataclass(frozen=True, slots=True)
class RetrieveKnowledgeCommand:
    tenant_id: str
    correlation_id: str
    query: str
    top_k: int | None = None
    filters: RetrievalFilter | None = None
    document_id: str | None = None


@dataclass(frozen=True, slots=True)
class RetrievalResult:
    query: str
    top_k: int
    chunks: tuple[RetrievedChunk, ...]
    citations: tuple[Citation, ...]
    context: str

    @staticmethod
    def empty(query: str = "", top_k: int = 0) -> RetrievalResult:
        return RetrievalResult(query=query, top_k=top_k, chunks=(), citations=(), context="")

    def to_dict(self) -> dict[str, object]:
        return {
            "query": self.query,
            "topK": self.top_k,
            "citations": [citation.to_dict() for citation in self.citations],
            "chunks": [
                {
                    "id": chunk.id,
                    "documentId": chunk.document_id,
                    "version": chunk.version,
                    "chunkIndex": chunk.chunk_index,
                    "content": chunk.content,
                    "score": chunk.score,
                    "title": chunk.title,
                    "sourceUri": chunk.source_uri,
                    "kind": chunk.kind,
                }
                for chunk in self.chunks
            ],
        }


class RetrieveKnowledgeUseCase:
    def __init__(
        self,
        embeddings: EmbeddingPort,
        vectors: VectorIndexPort,
        reranker: RerankPort,
        policy: RetrievalPolicy,
        logger: logging.Logger,
    ) -> None:
        self._embeddings = embeddings
        self._vectors = vectors
        self._reranker = reranker
        self._policy = policy
        self._logger = logger

    async def execute(self, command: RetrieveKnowledgeCommand) -> RetrievalResult:
        started = time.perf_counter()
        tenant_id = require_tenant_id(command.tenant_id)
        query = command.query.strip()
        if not query:
            raise InvalidRetrievalInputError("query is required")
        top_k = self._policy.resolve_top_k(command.top_k)
        filters = normalize_retrieval_filter(
            document_ids=command.filters.document_ids if command.filters else (),
            kinds=command.filters.kinds if command.filters else (),
            source_uri=command.filters.source_uri if command.filters else None,
            title_contains=command.filters.title_contains if command.filters else None,
            metadata_equals=command.filters.metadata_equals if command.filters else None,
            document_id=command.document_id,
        )
        query_embedding = await self._embed_query(query, tenant_id)
        candidate_k = self._policy.resolve_candidate_k(top_k)
        try:
            hits = await self._vectors.search(
                VectorSearchRequest(
                    tenant_id=tenant_id,
                    query=query,
                    limit=candidate_k if self._policy.rerank_enabled else top_k,
                    document_id=command.document_id,
                    query_embedding=query_embedding,
                    mode="hybrid",
                    filters=filters,
                    candidate_limit=candidate_k,
                    vector_weight=self._policy.vector_weight,
                    keyword_weight=self._policy.keyword_weight,
                    rrf_k=self._policy.rrf_k,
                )
            )
        except AIError:
            raise
        except Exception as exc:
            raise VectorIndexError("The vector index is unavailable") from exc

        ranked = await self._rerank(tenant_id, query, hits, top_k)
        chunks = chunks_from_hits(ranked)
        citations = citations_from_hits(ranked, snippet_chars=self._policy.snippet_chars)
        result = RetrievalResult(
            query=query,
            top_k=top_k,
            chunks=chunks,
            citations=citations,
            context=build_knowledge_context(chunks, snippet_chars=self._policy.snippet_chars),
        )
        self._logger.info(
            "Knowledge retrieved",
            extra={
                "tenantId": tenant_id,
                "topK": top_k,
                "hitCount": len(result.chunks),
                "candidateCount": len(hits),
                "latencyMs": int((time.perf_counter() - started) * 1000),
                "correlationId": command.correlation_id,
            },
        )
        return result

    async def _embed_query(self, query: str, tenant_id: str) -> tuple[float, ...] | None:
        try:
            embedded = await self._embeddings.embed(EmbeddingRequest(texts=(query,), tenant_id=tenant_id))
        except Exception:
            self._logger.warning(
                "Query embedding failed; using keyword retrieval",
                extra={"tenantId": tenant_id},
            )
            return None
        if not embedded.vectors:
            return None
        return embedded.vectors[0]

    async def _rerank(
        self,
        tenant_id: str,
        query: str,
        hits: tuple[VectorSearchHit, ...],
        top_k: int,
    ) -> tuple[VectorSearchHit, ...]:
        if not self._policy.rerank_enabled:
            return hits[:top_k]
        try:
            return await self._reranker.rerank(
                RerankRequest(tenant_id=tenant_id, query=query, hits=hits, top_k=top_k)
            )
        except AIError:
            raise
        except Exception:
            self._logger.warning("Rerank failed; using hybrid ranks", extra={"tenantId": tenant_id})
            return hits[:top_k]
