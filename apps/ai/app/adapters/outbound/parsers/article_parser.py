from app.application.ports.document_parser_port import DocumentParserPort, ParseSource
from app.domain.errors import EmptyDocumentError
from app.domain.ingestion import ParsedDocument, checksum_text
from app.rag.chunking import normalize_document_text


class ArticleParserAdapter(DocumentParserPort):
    async def parse(self, source: ParseSource) -> ParsedDocument:
        text = normalize_document_text(source.text or "")
        if not text:
            raise EmptyDocumentError("Article text is empty")
        return ParsedDocument(
            kind="article",
            title=source.title,
            text=text,
            parser="article",
            source_uri=source.source_uri,
            media_type=source.media_type or "text/plain",
            checksum=checksum_text(text),
            character_count=len(text),
        )
