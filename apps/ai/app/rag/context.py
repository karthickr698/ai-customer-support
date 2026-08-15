"""Prompt context construction from retrieved chunks. No provider SDKs."""

from app.domain.retrieval import RetrievedChunk
from app.rag.citations import snippet

_MAX_CONTEXT_CHARS = 6_000


def build_knowledge_context(chunks: tuple[RetrievedChunk, ...], *, snippet_chars: int = 280) -> str:
    if not chunks:
        return ""
    parts: list[str] = []
    used = 0
    for index, chunk in enumerate(chunks, start=1):
        source = f" ({chunk.source_uri})" if chunk.source_uri else ""
        excerpt = snippet(chunk.content, snippet_chars)
        block = f"[{index}] {chunk.title}{source}: {excerpt}"
        if used + len(block) + 1 > _MAX_CONTEXT_CHARS:
            break
        parts.append(block)
        used += len(block) + 1
    return "\n".join(parts)
