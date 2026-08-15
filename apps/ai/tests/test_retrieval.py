from app.adapters.outbound.embeddings.hash_embedding_adapter import HashEmbeddingAdapter
from app.adapters.outbound.rerank.heuristic_rerank_adapter import HeuristicRerankAdapter
from app.adapters.outbound.vector_store.in_memory_vector_store import InMemoryVectorStoreAdapter
from app.application.ports.document_parser_port import DocumentParserPort, ParseSource
from app.application.ports.url_fetch_port import FetchedWebDocument, UrlFetchPort
from app.application.use_cases.ingest_document_use_case import IngestDocumentCommand, IngestDocumentUseCase
from app.application.use_cases.retrieve_knowledge_use_case import (
    RetrieveKnowledgeCommand,
    RetrieveKnowledgeUseCase,
)
from app.domain.ingestion import ParsedDocument, checksum_text
from app.domain.retrieval import RetrievalPolicy, normalize_retrieval_filter
from app.logging import get_logger


class FakeParser(DocumentParserPort):
    async def parse(self, source: ParseSource) -> ParsedDocument:
        text = source.text or ""
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
        return FetchedWebDocument(url=url, body=b"", media_type="text/html", final_url=url)


def _stack() -> tuple[IngestDocumentUseCase, RetrieveKnowledgeUseCase]:
    vectors = InMemoryVectorStoreAdapter()
    embeddings = HashEmbeddingAdapter()
    ingest = IngestDocumentUseCase(FakeParser(), FakeFetcher(), embeddings, vectors, get_logger("test.ingest"))
    retrieve = RetrieveKnowledgeUseCase(
        embeddings,
        vectors,
        HeuristicRerankAdapter(),
        RetrievalPolicy(default_top_k=5, max_top_k=8, candidate_k=10),
        get_logger("test.retrieve"),
    )
    return ingest, retrieve


async def test_retrieve_is_tenant_scoped_and_returns_citations() -> None:
    ingest, retrieve = _stack()
    await ingest.execute(
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
    hits = await retrieve.execute(
        RetrieveKnowledgeCommand(
            tenant_id="tenant-1",
            correlation_id="corr-1",
            query="When are refunds issued?",
            top_k=3,
        )
    )
    assert hits.chunks
    assert hits.citations
    assert hits.citations[0].document_id == "doc-1"
    assert hits.citations[0].title == "Refund policy"
    assert "Refunds" in hits.context
    other = await retrieve.execute(
        RetrieveKnowledgeCommand(tenant_id="tenant-2", correlation_id="corr-1", query="When are refunds issued?")
    )
    assert other.chunks == ()


async def test_retrieve_honors_top_k_and_metadata_filters() -> None:
    ingest, retrieve = _stack()
    await ingest.execute(
        IngestDocumentCommand(
            tenant_id="tenant-1",
            correlation_id="corr-1",
            document_id="doc-refund",
            kind="article",
            version=1,
            title="Refund policy",
            replace_previous_version=False,
            content_text="Refunds are issued within five business days.",
        )
    )
    await ingest.execute(
        IngestDocumentCommand(
            tenant_id="tenant-1",
            correlation_id="corr-1",
            document_id="doc-ship",
            kind="article",
            version=1,
            title="Shipping policy",
            replace_previous_version=False,
            content_text="Shipping takes three days to Canada.",
        )
    )
    limited = await retrieve.execute(
        RetrieveKnowledgeCommand(
            tenant_id="tenant-1",
            correlation_id="corr-1",
            query="policy refunds shipping",
            top_k=1,
        )
    )
    assert limited.top_k == 1
    assert len(limited.chunks) == 1

    filtered = await retrieve.execute(
        RetrieveKnowledgeCommand(
            tenant_id="tenant-1",
            correlation_id="corr-1",
            query="policy",
            top_k=5,
            filters=normalize_retrieval_filter(document_ids=("doc-ship",)),
        )
    )
    assert filtered.chunks
    assert all(chunk.document_id == "doc-ship" for chunk in filtered.chunks)
