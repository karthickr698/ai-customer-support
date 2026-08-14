from app.application.ports import (
    EmbeddingPort,
    EmbeddingRequest,
    EmbeddingResult,
    LLMCompletionRequest,
    LLMCompletionResult,
    LLMMessage,
    LLMPort,
    LLMStreamChunk,
    VectorSearchHit,
    VectorSearchPort,
    VectorSearchRequest,
)


class FakeLLM:
    async def complete(self, request: LLMCompletionRequest) -> LLMCompletionResult:
        assert request.tenant_id == "tenant-1"
        return LLMCompletionResult(
            content="ok",
            model="fake",
            prompt_tokens=1,
            completion_tokens=1,
        )

    async def stream(self, request: LLMCompletionRequest):
        result = await self.complete(request)
        yield LLMStreamChunk(delta=result.content, done=True, result=result)


class FakeEmbeddings:
    async def embed(self, request: EmbeddingRequest) -> EmbeddingResult:
        assert request.tenant_id == "tenant-1"
        return EmbeddingResult(vectors=((0.1, 0.2),), model="fake", dimensions=2)


class FakeVectorSearch:
    async def search(self, request: VectorSearchRequest) -> tuple[VectorSearchHit, ...]:
        assert request.tenant_id == "tenant-1"
        return (VectorSearchHit(id="chunk-1", score=0.9, content="policy"),)


async def test_llm_port_is_implementable_without_provider_sdk() -> None:
    llm: LLMPort = FakeLLM()
    result = await llm.complete(
        LLMCompletionRequest(
            messages=(LLMMessage(role="user", content="hello"),),
            correlation_id="corr-1",
            tenant_id="tenant-1",
        )
    )
    assert result.model == "fake"


async def test_embedding_and_vector_ports_require_tenant_scope() -> None:
    embeddings: EmbeddingPort = FakeEmbeddings()
    search: VectorSearchPort = FakeVectorSearch()

    vectors = await embeddings.embed(EmbeddingRequest(texts=("hello",), tenant_id="tenant-1"))
    hits = await search.search(
        VectorSearchRequest(tenant_id="tenant-1", query="hello", limit=5)
    )

    assert vectors.vectors == ((0.1, 0.2),)
    assert hits[0].id == "chunk-1"
