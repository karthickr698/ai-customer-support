"""RAG pipeline helpers. Implementations are added by feature commands."""

from app.rag.chunking import chunk_text, normalize_document_text
from app.rag.citations import citations_from_hits, chunks_from_hits, snippet
from app.rag.context import build_knowledge_context
from app.rag.filters import effective_filter, matches_metadata
from app.rag.hybrid import hybrid_weights, reciprocal_rank_fusion
from app.rag.keyword import bm25_scores, tokenize
from app.rag.metadata import chunk_metadata
from app.rag.rerank import rerank_hits
from app.rag.vector import cosine_similarity

__all__ = [
    "bm25_scores",
    "build_knowledge_context",
    "chunk_metadata",
    "chunk_text",
    "citations_from_hits",
    "chunks_from_hits",
    "cosine_similarity",
    "effective_filter",
    "hybrid_weights",
    "matches_metadata",
    "normalize_document_text",
    "reciprocal_rank_fusion",
    "rerank_hits",
    "snippet",
    "tokenize",
]
