from __future__ import annotations

import json
import logging
from typing import Any

import asyncpg

from app.application.ports.vector_search_port import (
    VectorIndexPort,
    VectorRecord,
    VectorSearchHit,
    VectorSearchRequest,
)
from app.domain.errors import TenantContextRequiredError, VectorIndexError
from app.domain.retrieval import RetrievalFilter
from app.rag.filters import effective_filter
from app.rag.hybrid import hybrid_weights, reciprocal_rank_fusion

_VECTOR_LITERAL_MAX_LEN = 1_000_000


class PgVectorStoreAdapter(VectorIndexPort):
    """PostgreSQL pgvector index in a Python-owned schema. Never writes Prisma business tables."""

    def __init__(
        self,
        *,
        dsn: str,
        schema: str,
        embedding_dimensions: int,
        logger: logging.Logger,
        pool: asyncpg.Pool | None = None,
    ) -> None:
        if embedding_dimensions < 8:
            raise VectorIndexError("Embedding dimensions must be at least 8")
        self._dsn = dsn
        self._schema = _safe_ident(schema)
        self._dimensions = embedding_dimensions
        self._logger = logger
        self._pool = pool
        self._schema_ready = pool is not None

    async def close(self) -> None:
        if self._pool is not None:
            await self._pool.close()
            self._pool = None
            self._schema_ready = False

    async def upsert(self, records: tuple[VectorRecord, ...]) -> None:
        if not records:
            return
        pool = await self._ensure_pool()
        try:
            async with pool.acquire() as connection:
                async with connection.transaction():
                    for record in records:
                        _require_tenant(record.tenant_id)
                        if len(record.embedding) != self._dimensions:
                            raise VectorIndexError("Embedding dimensions do not match the vector index")
                        await connection.execute(
                            f"""
                            INSERT INTO {self._schema}.knowledge_chunks (
                                id, tenant_id, document_id, version, chunk_index, content, embedding, metadata
                            )
                            VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8::jsonb)
                            ON CONFLICT (id) DO UPDATE SET
                                tenant_id = EXCLUDED.tenant_id,
                                document_id = EXCLUDED.document_id,
                                version = EXCLUDED.version,
                                chunk_index = EXCLUDED.chunk_index,
                                content = EXCLUDED.content,
                                embedding = EXCLUDED.embedding,
                                metadata = EXCLUDED.metadata
                            """,
                            record.id,
                            record.tenant_id,
                            record.document_id,
                            record.version,
                            record.chunk_index,
                            record.content,
                            to_vector_literal(record.embedding),
                            json.dumps(dict(record.metadata)),
                        )
        except VectorIndexError:
            raise
        except Exception as exc:
            raise VectorIndexError("The vector index failed to upsert records") from exc

    async def delete_by_document(
        self,
        *,
        tenant_id: str,
        document_id: str,
        version: int | None = None,
        exclude_version: int | None = None,
    ) -> int:
        _require_tenant(tenant_id)
        pool = await self._ensure_pool()
        try:
            async with pool.acquire() as connection:
                result = await connection.execute(
                    f"""
                    DELETE FROM {self._schema}.knowledge_chunks
                    WHERE tenant_id = $1
                      AND document_id = $2
                      AND ($3::int IS NULL OR version = $3)
                      AND ($4::int IS NULL OR version <> $4)
                    """,
                    tenant_id,
                    document_id,
                    version,
                    exclude_version,
                )
        except Exception as exc:
            raise VectorIndexError("The vector index failed to delete records") from exc
        return _rowcount(result)

    async def search(self, request: VectorSearchRequest) -> tuple[VectorSearchHit, ...]:
        _require_tenant(request.tenant_id)
        query = request.query.strip()
        if not query or request.limit < 1:
            return ()
        filters = effective_filter(request.filters, request.document_id)
        candidate_limit = max(request.limit, request.candidate_limit or request.limit)
        pool = await self._ensure_pool()
        try:
            async with pool.acquire() as connection:
                vector_rows = []
                if request.mode in ("vector", "hybrid") and request.query_embedding:
                    if len(request.query_embedding) != self._dimensions:
                        raise VectorIndexError("Query embedding dimensions do not match the vector index")
                    vector_rows = await self._vector_search(
                        connection, request.tenant_id, request.query_embedding, candidate_limit, filters
                    )
                keyword_rows = []
                if request.mode in ("keyword", "hybrid"):
                    keyword_rows = await self._keyword_search(
                        connection, request.tenant_id, query, candidate_limit, filters
                    )
        except VectorIndexError:
            raise
        except Exception as exc:
            raise VectorIndexError("The vector index failed to search") from exc

        if request.mode == "vector":
            return tuple(_hit_from_row(row, score=float(row["vector_score"]), vector_score=float(row["vector_score"])) for row in vector_rows[: request.limit])
        if request.mode == "keyword" or not vector_rows:
            return tuple(
                _hit_from_row(row, score=float(row["keyword_score"]), keyword_score=float(row["keyword_score"]))
                for row in keyword_rows[: request.limit]
            )
        if not keyword_rows:
            return tuple(
                _hit_from_row(row, score=float(row["vector_score"]), vector_score=float(row["vector_score"]))
                for row in vector_rows[: request.limit]
            )

        vector_weight, keyword_weight = hybrid_weights(request.vector_weight, request.keyword_weight)
        fused = reciprocal_rank_fusion(
            (
                tuple(str(row["id"]) for row in vector_rows),
                tuple(str(row["id"]) for row in keyword_rows),
            ),
            weights=(vector_weight, keyword_weight),
            k=request.rrf_k,
        )
        by_id = {str(row["id"]): row for row in (*vector_rows, *keyword_rows)}
        vector_scores = {str(row["id"]): float(row["vector_score"]) for row in vector_rows}
        keyword_scores = {str(row["id"]): float(row["keyword_score"]) for row in keyword_rows}
        hits: list[VectorSearchHit] = []
        for record_id, score in fused[: request.limit]:
            row = by_id[record_id]
            hits.append(
                _hit_from_row(
                    row,
                    score=score,
                    vector_score=vector_scores.get(record_id),
                    keyword_score=keyword_scores.get(record_id),
                )
            )
        return tuple(hits)

    async def _vector_search(
        self,
        connection: asyncpg.Connection,
        tenant_id: str,
        query_embedding: tuple[float, ...],
        limit: int,
        filters: RetrievalFilter,
    ) -> list[asyncpg.Record]:
        where, args = _filter_sql(filters, start=3)
        sql = f"""
            SELECT id, document_id, version, chunk_index, content, metadata,
                   1 - (embedding <=> $2::vector) AS vector_score,
                   NULL::float AS keyword_score
            FROM {self._schema}.knowledge_chunks
            WHERE tenant_id = $1
            {where}
            ORDER BY embedding <=> $2::vector
            LIMIT {int(limit)}
        """
        return await connection.fetch(sql, tenant_id, to_vector_literal(query_embedding), *args)

    async def _keyword_search(
        self,
        connection: asyncpg.Connection,
        tenant_id: str,
        query: str,
        limit: int,
        filters: RetrievalFilter,
    ) -> list[asyncpg.Record]:
        where, args = _filter_sql(filters, start=3)
        sql = f"""
            SELECT id, document_id, version, chunk_index, content, metadata,
                   NULL::float AS vector_score,
                   ts_rank_cd(tsv, plainto_tsquery('english', $2)) AS keyword_score
            FROM {self._schema}.knowledge_chunks
            WHERE tenant_id = $1
              AND tsv @@ plainto_tsquery('english', $2)
            {where}
            ORDER BY keyword_score DESC
            LIMIT {int(limit)}
        """
        return await connection.fetch(sql, tenant_id, query, *args)

    async def _ensure_pool(self) -> asyncpg.Pool:
        if self._pool is None:
            try:
                self._pool = await asyncpg.create_pool(self._dsn, min_size=1, max_size=10)
            except Exception as exc:
                raise VectorIndexError("Could not connect to the vector database") from exc
        if not self._schema_ready:
            await self._ensure_schema()
            self._schema_ready = True
        return self._pool

    async def _ensure_schema(self) -> None:
        assert self._pool is not None
        dimensions = int(self._dimensions)
        schema = self._schema
        try:
            async with self._pool.acquire() as connection:
                await connection.execute("CREATE EXTENSION IF NOT EXISTS vector")
                await connection.execute(f"CREATE SCHEMA IF NOT EXISTS {schema}")
                await connection.execute(
                    f"""
                    CREATE TABLE IF NOT EXISTS {schema}.knowledge_chunks (
                        id TEXT PRIMARY KEY,
                        tenant_id TEXT NOT NULL,
                        document_id TEXT NOT NULL,
                        version INTEGER NOT NULL,
                        chunk_index INTEGER NOT NULL,
                        content TEXT NOT NULL,
                        embedding vector({dimensions}) NOT NULL,
                        metadata JSONB NOT NULL DEFAULT '{{}}'::jsonb,
                        tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                    )
                    """
                )
                await connection.execute(
                    f"""
                    CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_hnsw
                    ON {schema}.knowledge_chunks USING hnsw (embedding vector_cosine_ops)
                    """
                )
                await connection.execute(
                    f"""
                    CREATE INDEX IF NOT EXISTS knowledge_chunks_tsv_gin
                    ON {schema}.knowledge_chunks USING gin (tsv)
                    """
                )
                await connection.execute(
                    f"""
                    CREATE INDEX IF NOT EXISTS knowledge_chunks_tenant_document
                    ON {schema}.knowledge_chunks (tenant_id, document_id)
                    """
                )
        except Exception as exc:
            raise VectorIndexError("Could not initialize the pgvector schema") from exc
        self._logger.info(
            "pgvector schema ready",
            extra={"schema": schema, "embeddingDimensions": dimensions},
        )


def to_vector_literal(values: tuple[float, ...]) -> str:
    literal = "[" + ",".join(f"{value:.8f}" for value in values) + "]"
    if len(literal) > _VECTOR_LITERAL_MAX_LEN:
        raise VectorIndexError("Embedding is too large for the vector index")
    return literal


def _filter_sql(filters: RetrievalFilter, *, start: int) -> tuple[str, list[Any]]:
    clauses: list[str] = []
    args: list[Any] = []
    index = start
    if filters.document_ids:
        clauses.append(f"AND document_id = ANY(${index}::text[])")
        args.append(list(filters.document_ids))
        index += 1
    if filters.kinds:
        clauses.append(f"AND metadata->>'kind' = ANY(${index}::text[])")
        args.append(list(filters.kinds))
        index += 1
    if filters.source_uri:
        clauses.append(f"AND metadata->>'sourceUri' = ${index}")
        args.append(filters.source_uri)
        index += 1
    if filters.title_contains:
        clauses.append(f"AND metadata->>'title' ILIKE ${index} ESCAPE '\\'")
        args.append(_ilike_contains(filters.title_contains))
        index += 1
    for key, value in filters.metadata_equals.items():
        clauses.append(f"AND metadata->>${index} = ${index + 1}")
        args.extend([key, value])
        index += 2
    return (" ".join(clauses), args)


def _hit_from_row(
    row: asyncpg.Record | dict[str, Any],
    *,
    score: float,
    vector_score: float | None = None,
    keyword_score: float | None = None,
) -> VectorSearchHit:
    metadata = row["metadata"]
    if isinstance(metadata, str):
        metadata = json.loads(metadata)
    if not isinstance(metadata, dict):
        metadata = {}
    return VectorSearchHit(
        id=str(row["id"]),
        score=score,
        content=str(row["content"]),
        document_id=str(row["document_id"]) if row["document_id"] is not None else None,
        version=int(row["version"]) if row["version"] is not None else None,
        chunk_index=int(row["chunk_index"]) if row["chunk_index"] is not None else None,
        metadata=metadata,
        vector_score=vector_score,
        keyword_score=keyword_score,
    )


def _rowcount(status: str) -> int:
    parts = status.split()
    if len(parts) >= 2 and parts[-1].isdigit():
        return int(parts[-1])
    return 0


def _ilike_contains(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def _safe_ident(value: str) -> str:
    ident = value.strip() or "ai"
    if not ident.replace("_", "").isalnum() or ident[0].isdigit():
        raise VectorIndexError("Vector schema name is invalid")
    return ident


def _require_tenant(tenant_id: str) -> None:
    if not tenant_id.strip():
        raise TenantContextRequiredError()
