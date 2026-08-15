from app.application.ports.vector_search_port import VectorSearchHit
from app.rag.rerank import rerank_hits


def test_rerank_promotes_lexical_match() -> None:
    hits = (
        VectorSearchHit(
            id="noise",
            score=0.02,
            content="Shipping takes three days to Canada.",
            document_id="doc-ship",
            metadata={"title": "Shipping"},
            vector_score=0.9,
            keyword_score=0.0,
        ),
        VectorSearchHit(
            id="policy",
            score=0.01,
            content="Refunds are issued within five business days.",
            document_id="doc-refund",
            metadata={"title": "Refund policy"},
            vector_score=0.1,
            keyword_score=1.2,
        ),
    )
    ranked = rerank_hits("refunds", hits, top_k=1)
    assert len(ranked) == 1
    assert ranked[0].id == "policy"


def test_rerank_respects_top_k() -> None:
    hits = tuple(
        VectorSearchHit(id=f"c{index}", score=0.1, content=f"token {index} refunds", document_id=f"d{index}")
        for index in range(5)
    )
    ranked = rerank_hits("refunds", hits, top_k=2)
    assert len(ranked) == 2
