from io import BytesIO

from docx import Document
from pypdf import PdfWriter

from app.adapters.outbound.parsers.article_parser import ArticleParserAdapter
from app.adapters.outbound.parsers.docx_parser import DocxParserAdapter
from app.adapters.outbound.parsers.html_parser import HtmlParserAdapter
from app.adapters.outbound.parsers.pdf_parser import PdfParserAdapter
from app.application.ports.document_parser_port import ParseSource
from app.domain.errors import EmptyDocumentError


def _source(**overrides: object) -> ParseSource:
    payload: dict[str, object] = {
        "kind": "article",
        "title": "Policy",
        "tenant_id": "tenant-1",
        "source_uri": None,
        "media_type": None,
        "text": None,
        "binary": None,
    }
    payload.update(overrides)
    return ParseSource(**payload)  # type: ignore[arg-type]


async def test_article_parser_extracts_text() -> None:
    parsed = await ArticleParserAdapter().parse(_source(text="  Refunds take 5 days.  "))
    assert "Refunds take 5 days." in parsed.text
    assert parsed.parser == "article"


async def test_html_parser_strips_scripts() -> None:
    html = "<html><head><title>Help</title><script>steal()</script></head><body><p>Reset your password</p></body></html>"
    parsed = await HtmlParserAdapter().parse(_source(kind="url", text=html, media_type="text/html"))
    assert parsed.title == "Help"
    assert "Reset your password" in parsed.text
    assert "steal()" not in parsed.text


async def test_pdf_parser_rejects_blank_pdf() -> None:
    writer = PdfWriter()
    writer.add_blank_page(width=72, height=72)
    buffer = BytesIO()
    writer.write(buffer)
    try:
        await PdfParserAdapter().parse(_source(kind="pdf", binary=buffer.getvalue()))
        raise AssertionError("expected EmptyDocumentError")
    except EmptyDocumentError:
        pass


async def test_docx_parser_reads_paragraphs() -> None:
    document = Document()
    document.add_paragraph("Shipping takes two days.")
    buffer = BytesIO()
    document.save(buffer)
    parsed = await DocxParserAdapter().parse(_source(kind="docx", binary=buffer.getvalue()))
    assert "Shipping takes two days." in parsed.text


async def test_article_parser_rejects_empty_text() -> None:
    try:
        await ArticleParserAdapter().parse(_source(text="   "))
        raise AssertionError("expected EmptyDocumentError")
    except EmptyDocumentError:
        pass
