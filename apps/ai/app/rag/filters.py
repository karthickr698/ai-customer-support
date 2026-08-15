"""Metadata filter matching for tenant-scoped chunks. No provider SDKs."""

from typing import Mapping

from app.domain.retrieval import RetrievalFilter, normalize_retrieval_filter


def effective_filter(filters: RetrievalFilter | None, document_id: str | None) -> RetrievalFilter:
    base = filters or RetrievalFilter()
    return normalize_retrieval_filter(
        document_ids=base.document_ids,
        kinds=base.kinds,
        source_uri=base.source_uri,
        title_contains=base.title_contains,
        metadata_equals=base.metadata_equals,
        document_id=document_id,
    )


def matches_metadata(
    metadata: Mapping[str, str | int | None],
    filters: RetrievalFilter,
    *,
    document_id: str,
) -> bool:
    if filters.document_ids and document_id not in filters.document_ids:
        return False
    kind = str(metadata.get("kind") or "")
    if filters.kinds and kind not in filters.kinds:
        return False
    source_uri = metadata.get("sourceUri")
    if filters.source_uri and source_uri != filters.source_uri:
        return False
    if filters.title_contains:
        title = str(metadata.get("title") or "")
        if filters.title_contains.lower() not in title.lower():
            return False
    for key, expected in filters.metadata_equals.items():
        actual = metadata.get(key)
        if actual is None or str(actual) != expected:
            return False
    return True
