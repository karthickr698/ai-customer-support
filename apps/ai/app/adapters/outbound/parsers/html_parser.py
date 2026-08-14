from html.parser import HTMLParser

from app.application.ports.document_parser_port import DocumentParserPort, ParseSource
from app.domain.errors import DocumentParseError, EmptyDocumentError
from app.domain.ingestion import ParsedDocument, checksum_text
from app.rag.chunking import normalize_document_text

_SKIP_TAGS = frozenset({"script", "style", "noscript", "svg", "template"})


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._chunks: list[str] = []
        self._skip_depth = 0
        self.title: str | None = None
        self._in_title = False

    def handle_starttag(self, tag: str, _attrs: list[tuple[str, str | None]]) -> None:
        lowered = tag.lower()
        if lowered in _SKIP_TAGS:
            self._skip_depth += 1
            return
        if lowered == "title" and self._skip_depth == 0:
            self._in_title = True
        if lowered in {"p", "br", "div", "li", "h1", "h2", "h3", "h4", "tr", "section", "article"}:
            self._chunks.append("\n")

    def handle_endtag(self, tag: str) -> None:
        lowered = tag.lower()
        if lowered in _SKIP_TAGS and self._skip_depth > 0:
            self._skip_depth -= 1
            return
        if lowered == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._skip_depth > 0:
            return
        if self._in_title and self.title is None:
            title = data.strip()
            if title:
                self.title = title
        self._chunks.append(data)

    def text(self) -> str:
        return normalize_document_text("".join(self._chunks))


class HtmlParserAdapter(DocumentParserPort):
    async def parse(self, source: ParseSource) -> ParsedDocument:
        raw = source.text
        if raw is None and source.binary is not None:
            raw = source.binary.decode("utf-8", errors="replace")
        if not raw:
            raise DocumentParseError("HTML content is empty")

        extractor = _TextExtractor()
        try:
            extractor.feed(raw)
            extractor.close()
        except Exception as exc:  # noqa: BLE001 — HTMLParser raises various parse errors
            raise DocumentParseError("The HTML document could not be parsed") from exc

        text = extractor.text()
        if not text:
            raise EmptyDocumentError("The page did not contain extractable text")

        title = extractor.title or source.title
        return ParsedDocument(
            kind=source.kind if source.kind in ("url", "article") else "url",
            title=title,
            text=text,
            parser="html",
            source_uri=source.source_uri,
            media_type=source.media_type or "text/html",
            checksum=checksum_text(text),
            character_count=len(text),
        )
