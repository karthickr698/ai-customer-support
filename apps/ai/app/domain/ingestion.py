from dataclasses import dataclass
from hashlib import sha256
from typing import Literal
from urllib.parse import urlparse

from app.domain.errors import InvalidIngestionInputError, UnsafeUrlError

DocumentKind = Literal["pdf", "docx", "url", "article"]
IngestionStatus = Literal["processed", "failed"]

DOCUMENT_KINDS: tuple[DocumentKind, ...] = ("pdf", "docx", "url", "article")
INGEST_SCHEMA_VERSION = 1
MAX_TITLE_LENGTH = 200
MAX_ARTICLE_CHARS = 200_000
MAX_BINARY_BYTES = 10 * 1024 * 1024
DEFAULT_CHUNK_SIZE = 800
DEFAULT_CHUNK_OVERLAP = 120


@dataclass(frozen=True, slots=True)
class DocumentChunk:
    index: int
    content: str
    start_offset: int
    end_offset: int


@dataclass(frozen=True, slots=True)
class ParsedDocument:
    kind: DocumentKind
    title: str
    text: str
    parser: str
    source_uri: str | None
    media_type: str | None
    checksum: str
    character_count: int


@dataclass(frozen=True, slots=True)
class ChunkMetadata:
    title: str
    kind: DocumentKind
    source_uri: str | None
    media_type: str | None
    checksum: str
    version: int
    chunk_index: int
    chunk_count: int
    character_count: int
    parser: str
    start_offset: int
    end_offset: int

    def as_mapping(self) -> dict[str, str | int | None]:
        return {
            "title": self.title,
            "kind": self.kind,
            "sourceUri": self.source_uri,
            "mediaType": self.media_type,
            "checksum": self.checksum,
            "version": self.version,
            "chunkIndex": self.chunk_index,
            "chunkCount": self.chunk_count,
            "characterCount": self.character_count,
            "parser": self.parser,
            "startOffset": self.start_offset,
            "endOffset": self.end_offset,
        }


@dataclass(frozen=True, slots=True)
class IngestionResult:
    document_id: str
    version: int
    status: IngestionStatus
    chunk_count: int
    embedding_model: str
    parser: str
    checksum: str
    title: str
    kind: DocumentKind
    character_count: int
    source_uri: str | None
    media_type: str | None
    failure_code: str | None = None
    failure_message: str | None = None

    def to_dict(self) -> dict[str, object]:
        return {
            "schemaVersion": INGEST_SCHEMA_VERSION,
            "documentId": self.document_id,
            "version": self.version,
            "status": self.status,
            "chunkCount": self.chunk_count,
            "embeddingModel": self.embedding_model,
            "parser": self.parser,
            "checksum": self.checksum,
            "metadata": {
                "title": self.title,
                "kind": self.kind,
                "characterCount": self.character_count,
                "sourceUri": self.source_uri,
                "mediaType": self.media_type,
            },
            "failureCode": self.failure_code,
            "failureMessage": self.failure_message,
        }


def parse_document_kind(value: str) -> DocumentKind:
    if value in DOCUMENT_KINDS:
        return value  # type: ignore[return-value]
    raise InvalidIngestionInputError("Document kind is invalid")


def normalize_title(value: str) -> str:
    title = value.strip()
    if not title or len(title) > MAX_TITLE_LENGTH:
        raise InvalidIngestionInputError(f"Title must be between 1 and {MAX_TITLE_LENGTH} characters")
    return title


def normalize_source_uri(value: str | None, *, required: bool) -> str | None:
    uri = (value or "").strip()
    if not uri:
        if required:
            raise InvalidIngestionInputError("A URL is required for this document kind")
        return None
    parsed = urlparse(uri)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise UnsafeUrlError("URL must start with http or https")
    if len(uri) > 2000:
        raise InvalidIngestionInputError("URL is too long")
    return uri


def checksum_bytes(payload: bytes) -> str:
    return sha256(payload).hexdigest()


def checksum_text(payload: str) -> str:
    return checksum_bytes(payload.encode("utf-8"))


def vector_record_id(tenant_id: str, document_id: str, version: int, chunk_index: int) -> str:
    return f"{tenant_id}:{document_id}:v{version}:{chunk_index}"
