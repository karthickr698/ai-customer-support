"""Citation construction from retrieved hits. No provider SDKs."""

from app.application.ports.vector_search_port import VectorSearchHit
from app.domain.retrieval import Citation, DEFAULT_SNIPPET_CHARS, RagPlaygroundSource, RetrievedChunk


def citations_from_hits(
    hits: tuple[VectorSearchHit, ...],
    *,
    snippet_chars: int = DEFAULT_SNIPPET_CHARS,
) -> tuple[Citation, ...]:
    return tuple(
        _citation_from_chunk(chunk, snippet_chars=snippet_chars)
        for chunk in chunks_from_hits(hits)
        if chunk.document_id.strip() and chunk.id.strip()
    )


def chunks_from_hits(hits: tuple[VectorSearchHit, ...]) -> tuple[RetrievedChunk, ...]:
    chunks: list[RetrievedChunk] = []
    for hit in hits:
        metadata = dict(hit.metadata)
        title = str(metadata.get("title") or "").strip()
        source = metadata.get("sourceUri")
        kind = metadata.get("kind")
        chunk_index = hit.chunk_index
        if chunk_index is None:
            raw_index = metadata.get("chunkIndex")
            chunk_index = raw_index if isinstance(raw_index, int) else None
        chunks.append(
            RetrievedChunk(
                id=hit.id,
                document_id=hit.document_id or "",
                version=hit.version,
                chunk_index=chunk_index,
                content=hit.content,
                score=hit.score,
                title=title or "Knowledge",
                source_uri=str(source) if isinstance(source, str) and source else None,
                kind=str(kind) if isinstance(kind, str) and kind else None,
                metadata=hit.metadata,
                vector_score=hit.vector_score,
                keyword_score=hit.keyword_score,
            )
        )
    return tuple(chunks)


def sources_from_chunks(chunks: tuple[RetrievedChunk, ...]) -> tuple[RagPlaygroundSource, ...]:
    grouped: dict[str, list[RetrievedChunk]] = {}
    for chunk in chunks:
        if not chunk.document_id.strip():
            continue
        grouped.setdefault(chunk.document_id, []).append(chunk)
    sources = [
        RagPlaygroundSource(
            document_id=document_id,
            title=items[0].title,
            source_uri=items[0].source_uri,
            kind=items[0].kind,
            chunk_count=len(items),
            max_score=max(item.score for item in items),
        )
        for document_id, items in grouped.items()
    ]
    sources.sort(key=lambda source: source.max_score, reverse=True)
    return tuple(sources)


def _citation_from_chunk(chunk: RetrievedChunk, *, snippet_chars: int) -> Citation:
    return Citation(
        document_id=chunk.document_id,
        chunk_id=chunk.id,
        title=chunk.title,
        source_uri=chunk.source_uri,
        chunk_index=chunk.chunk_index,
        snippet=snippet(chunk.content, snippet_chars),
        score=round(max(0.0, float(chunk.score)), 6),
    )


def snippet(text: str, limit: int) -> str:
    collapsed = " ".join(text.split())
    if len(collapsed) <= limit:
        return collapsed
    clipped = collapsed[: max(1, limit - 1)].rstrip()
    break_at = clipped.rfind(" ")
    if break_at >= limit // 2:
        clipped = clipped[:break_at]
    return f"{clipped}…"
