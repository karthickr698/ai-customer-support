"""Chunk metadata for tenant-scoped vector records. No provider SDKs."""

from app.domain.ingestion import ChunkMetadata, DocumentChunk, ParsedDocument


def chunk_metadata(
    parsed: ParsedDocument,
    chunk: DocumentChunk,
    *,
    version: int,
    chunk_count: int,
) -> ChunkMetadata:
    return ChunkMetadata(
        title=parsed.title,
        kind=parsed.kind,
        source_uri=parsed.source_uri,
        media_type=parsed.media_type,
        checksum=parsed.checksum,
        version=version,
        chunk_index=chunk.index,
        chunk_count=chunk_count,
        character_count=len(chunk.content),
        parser=parsed.parser,
        start_offset=chunk.start_offset,
        end_offset=chunk.end_offset,
    )
