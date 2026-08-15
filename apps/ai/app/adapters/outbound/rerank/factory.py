from app.adapters.outbound.rerank.heuristic_rerank_adapter import HeuristicRerankAdapter, IdentityRerankAdapter
from app.application.ports.rerank_port import RerankPort
from app.config import Settings


def create_rerank_port(settings: Settings) -> RerankPort:
    if settings.rag_rerank_enabled:
        return HeuristicRerankAdapter()
    return IdentityRerankAdapter()
