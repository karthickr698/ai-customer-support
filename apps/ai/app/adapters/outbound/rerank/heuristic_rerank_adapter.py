from app.application.ports.rerank_port import RerankPort, RerankRequest
from app.application.ports.vector_search_port import VectorSearchHit
from app.rag.rerank import rerank_hits


class HeuristicRerankAdapter(RerankPort):
    """Lexical plus hybrid-score reranker. Swap for a cross-encoder adapter later."""

    async def rerank(self, request: RerankRequest) -> tuple[VectorSearchHit, ...]:
        if not request.tenant_id.strip():
            return ()
        return rerank_hits(request.query, request.hits, top_k=request.top_k)


class IdentityRerankAdapter(RerankPort):
    async def rerank(self, request: RerankRequest) -> tuple[VectorSearchHit, ...]:
        if request.top_k < 1:
            return ()
        return request.hits[: request.top_k]
