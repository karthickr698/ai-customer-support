"""Deterministic overlapping chunker. No provider SDKs."""

import re

from app.domain.ingestion import DEFAULT_CHUNK_OVERLAP, DEFAULT_CHUNK_SIZE, DocumentChunk

_WHITESPACE = re.compile(r"[ \t]+")
_NEWLINES = re.compile(r"\n{3,}")
_NUL = re.compile(r"\x00")


def normalize_document_text(value: str) -> str:
    without_nul = _NUL.sub("", value)
    collapsed = _WHITESPACE.sub(" ", without_nul)
    collapsed = _NEWLINES.sub("\n\n", collapsed)
    return collapsed.replace("\r\n", "\n").replace("\r", "\n").strip()


def chunk_text(
    text: str,
    *,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    overlap: int = DEFAULT_CHUNK_OVERLAP,
) -> tuple[DocumentChunk, ...]:
    normalized = normalize_document_text(text)
    if not normalized:
        return ()
    if chunk_size < 1:
        raise ValueError("chunk_size must be positive")
    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("overlap must be >= 0 and < chunk_size")

    chunks: list[DocumentChunk] = []
    start = 0
    index = 0
    length = len(normalized)
    while start < length:
        end = min(length, start + chunk_size)
        if end < length:
            break_at = normalized.rfind(" ", start + max(1, chunk_size // 2), end)
            if break_at > start:
                end = break_at
        piece = normalized[start:end].strip()
        if piece:
            chunks.append(
                DocumentChunk(
                    index=index,
                    content=piece,
                    start_offset=start,
                    end_offset=start + len(piece),
                )
            )
            index += 1
        if end >= length:
            break
        start = max(end - overlap, start + 1)

    return tuple(chunks)
