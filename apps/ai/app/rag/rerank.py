"""Heuristic reranking over hybrid candidates. No provider SDKs."""

from app.application.ports.vector_search_port import VectorSearchHit
from app.rag.keyword import keyword_overlap_score, tokenize


def rerank_hits(query: str, hits: tuple[VectorSearchHit, ...], *, top_k: int) -> tuple[VectorSearchHit, ...]:
    if top_k < 1 or not hits:
        return ()
    query_tokens = tokenize(query)
    scored: list[VectorSearchHit] = []
    for hit in hits:
        lexical = keyword_overlap_score(query_tokens, tokenize(hit.content))
        title = str(hit.metadata.get("title") or "")
        title_bonus = 0.15 if query_tokens and set(query_tokens) & set(tokenize(title)) else 0.0
        vector = hit.vector_score if hit.vector_score is not None else 0.0
        keyword = hit.keyword_score if hit.keyword_score is not None else lexical
        combined = 0.45 * hit.score + 0.25 * max(vector, 0.0) + 0.25 * max(keyword, lexical) + title_bonus
        scored.append(
            VectorSearchHit(
                id=hit.id,
                score=combined,
                content=hit.content,
                document_id=hit.document_id,
                version=hit.version,
                chunk_index=hit.chunk_index,
                metadata=hit.metadata,
                vector_score=hit.vector_score,
                keyword_score=hit.keyword_score,
            )
        )
    scored.sort(key=lambda hit: hit.score, reverse=True)
    return tuple(scored[:top_k])
