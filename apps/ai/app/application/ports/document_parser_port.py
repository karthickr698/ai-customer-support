from dataclasses import dataclass
from typing import Protocol

from app.domain.ingestion import DocumentKind, ParsedDocument


@dataclass(frozen=True, slots=True)
class ParseSource:
    kind: DocumentKind
    title: str
    tenant_id: str
    source_uri: str | None = None
    media_type: str | None = None
    text: str | None = None
    binary: bytes | None = None


class DocumentParserPort(Protocol):
    """Turns a source payload into plain text. Vendor parsers live in adapters."""

    async def parse(self, source: ParseSource) -> ParsedDocument: ...
