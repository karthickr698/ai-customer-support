from __future__ import annotations

import logging
import time
from dataclasses import dataclass

from app.application.ports.document_parser_port import DocumentParserPort, ParseSource
from app.application.ports.embedding_port import EmbeddingPort, EmbeddingRequest
from app.application.ports.url_fetch_port import UrlFetchPort
from app.application.ports.vector_search_port import VectorIndexPort, VectorRecord
from app.domain.errors import (
    DocumentParseError,
    EmptyDocumentError,
    InvalidIngestionInputError,
    UnsafeUrlError,
    UnsupportedDocumentKindError,
)
from app.domain.ingestion import (
    MAX_ARTICLE_CHARS,
    MAX_BINARY_BYTES,
    DocumentKind,
    IngestionResult,
    ParsedDocument,
    normalize_source_uri,
    normalize_title,
    parse_document_kind,
    vector_record_id,
)
from app.domain.onboarding import require_tenant_id
from app.rag.chunking import chunk_text
from app.rag.metadata import chunk_metadata


@dataclass(frozen=True, slots=True)
class IngestDocumentCommand:
    tenant_id: str
    correlation_id: str
    document_id: str
    kind: str
    version: int
    title: str
    replace_previous_version: bool
    source_uri: str | None = None
    media_type: str | None = None
    checksum: str | None = None
    content: bytes | None = None
    content_text: str | None = None


class IngestDocumentUseCase:
    def __init__(
        self,
        parser: DocumentParserPort,
        fetcher: UrlFetchPort,
        embeddings: EmbeddingPort,
        vectors: VectorIndexPort,
        logger: logging.Logger,
    ) -> None:
        self._parser = parser
        self._fetcher = fetcher
        self._embeddings = embeddings
        self._vectors = vectors
        self._logger = logger

    async def execute(self, command: IngestDocumentCommand) -> IngestionResult:
        started = time.perf_counter()
        tenant_id = require_tenant_id(command.tenant_id)
        kind = parse_document_kind(command.kind)
        title = normalize_title(command.title)
        if command.version < 1:
            raise InvalidIngestionInputError("version must be at least 1")
        if not command.document_id.strip():
            raise InvalidIngestionInputError("documentId is required")

        try:
            parsed = await self._parse(command, kind, title, tenant_id)
            chunks = chunk_text(parsed.text)
            if not chunks:
                raise EmptyDocumentError()

            embedded = await self._embeddings.embed(
                EmbeddingRequest(texts=tuple(chunk.content for chunk in chunks), tenant_id=tenant_id)
            )
            if len(embedded.vectors) != len(chunks):
                raise InvalidIngestionInputError("Embedding count did not match chunk count")

            records = tuple(
                VectorRecord(
                    id=vector_record_id(tenant_id, command.document_id, command.version, chunk.index),
                    tenant_id=tenant_id,
                    document_id=command.document_id,
                    version=command.version,
                    chunk_index=chunk.index,
                    content=chunk.content,
                    embedding=vector,
                    metadata=chunk_metadata(
                        parsed,
                        chunk,
                        version=command.version,
                        chunk_count=len(chunks),
                    ).as_mapping(),
                )
                for chunk, vector in zip(chunks, embedded.vectors, strict=True)
            )
            await self._vectors.upsert(records)
            if command.replace_previous_version:
                await self._vectors.delete_by_document(
                    tenant_id=tenant_id,
                    document_id=command.document_id,
                    exclude_version=command.version,
                )

            latency_ms = int((time.perf_counter() - started) * 1000)
            self._logger.info(
                "Document ingested",
                extra={
                    "tenantId": tenant_id,
                    "documentId": command.document_id,
                    "version": command.version,
                    "chunkCount": len(records),
                    "model": embedded.model,
                    "parser": parsed.parser,
                    "latencyMs": latency_ms,
                    "correlationId": command.correlation_id,
                },
            )
            return IngestionResult(
                document_id=command.document_id,
                version=command.version,
                status="processed",
                chunk_count=len(records),
                embedding_model=embedded.model,
                parser=parsed.parser,
                checksum=parsed.checksum,
                title=parsed.title,
                kind=kind,
                character_count=parsed.character_count,
                source_uri=parsed.source_uri,
                media_type=parsed.media_type,
            )
        except (DocumentParseError, EmptyDocumentError, UnsafeUrlError, UnsupportedDocumentKindError, InvalidIngestionInputError) as exc:
            self._logger.warning(
                "Document ingestion failed",
                extra={
                    "tenantId": tenant_id,
                    "documentId": command.document_id,
                    "version": command.version,
                    "code": exc.code,
                    "correlationId": command.correlation_id,
                },
            )
            return IngestionResult(
                document_id=command.document_id,
                version=command.version,
                status="failed",
                chunk_count=0,
                embedding_model="",
                parser="",
                checksum=command.checksum or "",
                title=title,
                kind=kind,
                character_count=0,
                source_uri=command.source_uri,
                media_type=command.media_type,
                failure_code=exc.code,
                failure_message=exc.message,
            )


    async def _parse(
        self,
        command: IngestDocumentCommand,
        kind: DocumentKind,
        title: str,
        tenant_id: str,
    ) -> ParsedDocument:
        source_uri = normalize_source_uri(command.source_uri, required=kind == "url")
        if kind == "url" and command.content is None and command.content_text is None:
            if source_uri is None:
                raise InvalidIngestionInputError("A URL is required")
            fetched = await self._fetcher.fetch(source_uri, tenant_id)
            parse_kind = _kind_from_media_type(fetched.media_type)
            return await self._parser.parse(
                ParseSource(
                    kind=parse_kind,
                    title=title,
                    tenant_id=tenant_id,
                    source_uri=fetched.final_url,
                    media_type=fetched.media_type,
                    text=fetched.body.decode("utf-8", errors="replace") if parse_kind in ("url", "article") else None,
                    binary=fetched.body if parse_kind in ("pdf", "docx") else None,
                )
            )

        if kind in ("pdf", "docx"):
            binary = command.content
            if not binary:
                raise InvalidIngestionInputError("File content is required")
            if len(binary) > MAX_BINARY_BYTES:
                raise InvalidIngestionInputError("The document is too large")
            return await self._parser.parse(
                ParseSource(
                    kind=kind,
                    title=title,
                    tenant_id=tenant_id,
                    source_uri=source_uri,
                    media_type=command.media_type,
                    binary=binary,
                )
            )

        text = command.content_text or (command.content.decode("utf-8") if command.content else "")
        if len(text) > MAX_ARTICLE_CHARS:
            raise InvalidIngestionInputError("Article text is too long")
        return await self._parser.parse(
            ParseSource(
                kind="article" if kind == "article" else "url",
                title=title,
                tenant_id=tenant_id,
                source_uri=source_uri,
                media_type=command.media_type or ("text/plain" if kind == "article" else "text/html"),
                text=text,
            )
        )


@dataclass(frozen=True, slots=True)
class DeleteIndexedDocumentCommand:
    tenant_id: str
    document_id: str
    correlation_id: str


class DeleteIndexedDocumentUseCase:
    def __init__(self, vectors: VectorIndexPort, logger: logging.Logger) -> None:
        self._vectors = vectors
        self._logger = logger

    async def execute(self, command: DeleteIndexedDocumentCommand) -> int:
        tenant_id = require_tenant_id(command.tenant_id)
        if not command.document_id.strip():
            raise InvalidIngestionInputError("documentId is required")
        deleted = await self._vectors.delete_by_document(tenant_id=tenant_id, document_id=command.document_id)
        self._logger.info(
            "Document index removed",
            extra={
                "tenantId": tenant_id,
                "documentId": command.document_id,
                "deletedCount": deleted,
                "correlationId": command.correlation_id,
            },
        )
        return deleted


def _kind_from_media_type(media_type: str) -> DocumentKind:
    lowered = media_type.lower()
    if lowered == "application/pdf":
        return "pdf"
    if lowered in {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
    }:
        return "docx"
    if lowered in {"text/html", "application/xhtml+xml"}:
        return "url"
    if lowered.startswith("text/"):
        return "article"
    return "url"
