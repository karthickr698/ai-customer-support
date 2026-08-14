from io import BytesIO

from pypdf import PdfReader

from app.application.ports.document_parser_port import DocumentParserPort, ParseSource
from app.domain.errors import DocumentParseError, EmptyDocumentError
from app.domain.ingestion import ParsedDocument, checksum_bytes
from app.rag.chunking import normalize_document_text


class PdfParserAdapter(DocumentParserPort):
    async def parse(self, source: ParseSource) -> ParsedDocument:
        if not source.binary:
            raise DocumentParseError("PDF bytes are required")
        try:
            reader = PdfReader(BytesIO(source.binary))
            pages: list[str] = []
            for page in reader.pages:
                extracted = page.extract_text() or ""
                if extracted.strip():
                    pages.append(extracted)
        except Exception as exc:  # noqa: BLE001 — pypdf raises various parse errors
            raise DocumentParseError("The PDF could not be parsed") from exc

        text = normalize_document_text("\n\n".join(pages))
        if not text:
            raise EmptyDocumentError("The PDF did not contain extractable text")

        meta_title = None
        if reader.metadata is not None:
            raw_title = getattr(reader.metadata, "title", None)
            if isinstance(raw_title, str) and raw_title.strip():
                meta_title = raw_title.strip()

        return ParsedDocument(
            kind="pdf",
            title=meta_title or source.title,
            text=text,
            parser="pypdf",
            source_uri=source.source_uri,
            media_type=source.media_type or "application/pdf",
            checksum=checksum_bytes(source.binary),
            character_count=len(text),
        )
