from app.adapters.outbound.embeddings.hash_embedding_adapter import HashEmbeddingAdapter
from app.adapters.outbound.vector_store.in_memory_vector_store import InMemoryVectorStoreAdapter
from app.application.ports.document_parser_port import DocumentParserPort, ParseSource
from app.application.ports.embedding_port import EmbeddingPort
from app.application.ports.url_fetch_port import FetchedWebDocument, UrlFetchPort
from app.application.ports.vector_search_port import VectorSearchRequest
from app.application.use_cases.ingest_document_use_case import (
    DeleteIndexedDocumentCommand,
    DeleteIndexedDocumentUseCase,
    IngestDocumentCommand,
    IngestDocumentUseCase,
)
from app.domain.ingestion import ParsedDocument, checksum_text
from app.logging import get_logger


class FakeParser(DocumentParserPort):
    async def parse(self, source: ParseSource) -> ParsedDocument:
        text = source.text or "Refunds are issued within five business days."
        return ParsedDocument(
            kind=source.kind if source.kind != "url" else "article",
            title=source.title,
            text=text,
            parser="fake",
            source_uri=source.source_uri,
            media_type=source.media_type,
            checksum=checksum_text(text),
            character_count=len(text),
        )


class FakeFetcher(UrlFetchPort):
    async def fetch(self, url: str, tenant_id: str) -> FetchedWebDocument:
        assert tenant_id == "tenant-1"
        return FetchedWebDocument(
            url=url,
            body=b"<html><body><p>Hours of operation are 9 to 5.</p></body></html>",
            media_type="text/html",
            final_url=url,
        )


def _use_case() -> tuple[IngestDocumentUseCase, InMemoryVectorStoreAdapter]:
    vectors = InMemoryVectorStoreAdapter()
    embeddings: EmbeddingPort = HashEmbeddingAdapter()
    use_case = IngestDocumentUseCase(
        FakeParser(),
        FakeFetcher(),
        embeddings,
        vectors,
        get_logger("test.ingestion"),
    )
    return use_case, vectors


async def test_ingest_article_indexes_tenant_scoped_chunks() -> None:
    use_case, vectors = _use_case()
    result = await use_case.execute(
        IngestDocumentCommand(
            tenant_id="tenant-1",
            correlation_id="corr-1",
            document_id="doc-1",
            kind="article",
            version=1,
            title="Refund policy",
            replace_previous_version=False,
            content_text="Refunds are issued within five business days. Keep your receipt.",
        )
    )
    assert result.status == "processed"
    assert result.chunk_count >= 1
    hits = await vectors.search(VectorSearchRequest(tenant_id="tenant-1", query="refunds", limit=5))
    assert hits
    other = await vectors.search(VectorSearchRequest(tenant_id="tenant-2", query="refunds", limit=5))
    assert other == ()


async def test_reindex_replaces_previous_version() -> None:
    use_case, vectors = _use_case()
    await use_case.execute(
        IngestDocumentCommand(
            tenant_id="tenant-1",
            correlation_id="corr-1",
            document_id="doc-1",
            kind="article",
            version=1,
            title="Policy",
            replace_previous_version=False,
            content_text="Old shipping policy mentions Canada only.",
        )
    )
    result = await use_case.execute(
        IngestDocumentCommand(
            tenant_id="tenant-1",
            correlation_id="corr-1",
            document_id="doc-1",
            kind="article",
            version=2,
            title="Policy",
            replace_previous_version=True,
            content_text="New shipping policy covers the United States.",
        )
    )
    assert result.status == "processed"
    assert result.version == 2
    hits = await vectors.search(VectorSearchRequest(tenant_id="tenant-1", query="shipping", limit=10))
    assert hits
    assert all(hit.version == 2 for hit in hits)


async def test_ingest_url_uses_fetcher() -> None:
    use_case, _vectors = _use_case()
    result = await use_case.execute(
        IngestDocumentCommand(
            tenant_id="tenant-1",
            correlation_id="corr-1",
            document_id="doc-url",
            kind="url",
            version=1,
            title="Help center",
            replace_previous_version=False,
            source_uri="https://example.com/help",
        )
    )
    assert result.status == "processed"


async def test_failed_parse_returns_structured_failure() -> None:
    use_case, _vectors = _use_case()
    result = await use_case.execute(
        IngestDocumentCommand(
            tenant_id="tenant-1",
            correlation_id="corr-1",
            document_id="doc-empty",
            kind="article",
            version=1,
            title="Empty",
            replace_previous_version=False,
            content_text="   ",
        )
    )
    assert result.status == "failed"
    assert result.failure_code == "EMPTY_DOCUMENT"


async def test_delete_index_is_tenant_scoped() -> None:
    use_case, vectors = _use_case()
    await use_case.execute(
        IngestDocumentCommand(
            tenant_id="tenant-1",
            correlation_id="corr-1",
            document_id="doc-1",
            kind="article",
            version=1,
            title="Policy",
            replace_previous_version=False,
            content_text="Keep this knowledge in tenant one.",
        )
    )
    deleter = DeleteIndexedDocumentUseCase(vectors, get_logger("test.ingestion"))
    deleted = await deleter.execute(
        DeleteIndexedDocumentCommand(tenant_id="tenant-1", document_id="doc-1", correlation_id="corr-1")
    )
    assert deleted >= 1
    hits = await vectors.search(VectorSearchRequest(tenant_id="tenant-1", query="knowledge", limit=5))
    assert hits == ()
