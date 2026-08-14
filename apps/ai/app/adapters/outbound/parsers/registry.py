from app.adapters.outbound.parsers.article_parser import ArticleParserAdapter
from app.adapters.outbound.parsers.docx_parser import DocxParserAdapter
from app.adapters.outbound.parsers.html_parser import HtmlParserAdapter
from app.adapters.outbound.parsers.pdf_parser import PdfParserAdapter
from app.application.ports.document_parser_port import DocumentParserPort, ParseSource
from app.domain.errors import UnsupportedDocumentKindError
from app.domain.ingestion import DocumentKind, ParsedDocument


class CompositeDocumentParser(DocumentParserPort):
    def __init__(self, parsers: dict[DocumentKind, DocumentParserPort] | None = None) -> None:
        html = HtmlParserAdapter()
        self._parsers: dict[DocumentKind, DocumentParserPort] = parsers or {
            "pdf": PdfParserAdapter(),
            "docx": DocxParserAdapter(),
            "article": ArticleParserAdapter(),
            "url": html,
        }

    async def parse(self, source: ParseSource) -> ParsedDocument:
        parser = self._parsers.get(source.kind)
        if parser is None:
            raise UnsupportedDocumentKindError()
        return await parser.parse(source)


def default_document_parser() -> CompositeDocumentParser:
    return CompositeDocumentParser()
