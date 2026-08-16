"""Tenant-scoped retrieval policy, filters, and citations. No provider SDKs."""

from dataclasses import dataclass, field
from typing import Mapping

from app.domain.errors import InvalidRetrievalInputError

DEFAULT_TOP_K = 5
MIN_TOP_K = 1
MAX_TOP_K = 20
DEFAULT_CANDIDATE_K = 20
MAX_CANDIDATE_K = 50
DEFAULT_RRF_K = 60
DEFAULT_VECTOR_WEIGHT = 0.6
DEFAULT_KEYWORD_WEIGHT = 0.4
DEFAULT_SNIPPET_CHARS = 280
DOCUMENT_KINDS = frozenset({"pdf", "docx", "url", "article"})


@dataclass(frozen=True, slots=True)
class RetrievalFilter:
    document_ids: tuple[str, ...] = ()
    kinds: tuple[str, ...] = ()
    source_uri: str | None = None
    title_contains: str | None = None
    metadata_equals: Mapping[str, str] = field(default_factory=dict)

    def to_dict(self) -> dict[str, object]:
        return {
            "documentIds": list(self.document_ids),
            "kinds": list(self.kinds),
            "sourceUri": self.source_uri,
            "titleContains": self.title_contains,
        }


@dataclass(frozen=True, slots=True)
class RetrievalPolicy:
    default_top_k: int = DEFAULT_TOP_K
    max_top_k: int = MAX_TOP_K
    candidate_k: int = DEFAULT_CANDIDATE_K
    vector_weight: float = DEFAULT_VECTOR_WEIGHT
    keyword_weight: float = DEFAULT_KEYWORD_WEIGHT
    rrf_k: int = DEFAULT_RRF_K
    rerank_enabled: bool = True
    snippet_chars: int = DEFAULT_SNIPPET_CHARS

    def resolve_top_k(self, requested: int | None) -> int:
        value = self.default_top_k if requested is None else requested
        return clamp_top_k(value, max_value=self.max_top_k)

    def resolve_candidate_k(self, top_k: int) -> int:
        return max(top_k, min(self.candidate_k, MAX_CANDIDATE_K))


@dataclass(frozen=True, slots=True)
class Citation:
    document_id: str
    chunk_id: str
    title: str
    source_uri: str | None
    chunk_index: int | None
    snippet: str
    score: float

    def to_dict(self) -> dict[str, object]:
        return {
            "documentId": self.document_id,
            "chunkId": self.chunk_id,
            "title": self.title,
            "sourceUri": self.source_uri,
            "chunkIndex": self.chunk_index,
            "snippet": self.snippet,
            "score": self.score,
        }


@dataclass(frozen=True, slots=True)
class RagPlaygroundSource:
    document_id: str
    title: str
    source_uri: str | None
    kind: str | None
    chunk_count: int
    max_score: float

    def to_dict(self) -> dict[str, object]:
        return {
            "documentId": self.document_id,
            "title": self.title,
            "sourceUri": self.source_uri,
            "kind": self.kind,
            "chunkCount": self.chunk_count,
            "maxScore": round(self.max_score, 6),
        }


@dataclass(frozen=True, slots=True)
class RetrievedChunk:
    id: str
    document_id: str
    version: int | None
    chunk_index: int | None
    content: str
    score: float
    title: str
    source_uri: str | None
    kind: str | None
    metadata: Mapping[str, str | int | None]
    vector_score: float | None = None
    keyword_score: float | None = None

    def to_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "documentId": self.document_id,
            "version": self.version,
            "chunkIndex": self.chunk_index,
            "content": self.content,
            "score": round(float(self.score), 6),
            "vectorScore": None if self.vector_score is None else round(float(self.vector_score), 6),
            "keywordScore": None if self.keyword_score is None else round(float(self.keyword_score), 6),
            "title": self.title,
            "sourceUri": self.source_uri,
            "kind": self.kind,
        }


def clamp_top_k(value: int, *, max_value: int = MAX_TOP_K, min_value: int = MIN_TOP_K) -> int:
    if value < min_value:
        raise InvalidRetrievalInputError(f"topK must be at least {min_value}")
    return min(value, max_value)


def normalize_retrieval_filter(
    *,
    document_ids: tuple[str, ...] | list[str] = (),
    kinds: tuple[str, ...] | list[str] = (),
    source_uri: str | None = None,
    title_contains: str | None = None,
    metadata_equals: Mapping[str, str] | None = None,
    document_id: str | None = None,
) -> RetrievalFilter:
    ids = tuple(item.strip() for item in document_ids if item.strip())
    if document_id and document_id.strip():
        scoped = document_id.strip()
        ids = (scoped,) if not ids else tuple(item for item in ids if item == scoped)
        if not ids:
            ids = (scoped,)
    kind_values = tuple(item.strip() for item in kinds if item.strip())
    for kind in kind_values:
        if kind not in DOCUMENT_KINDS:
            raise InvalidRetrievalInputError("Document kind filter is invalid")
    uri = (source_uri or "").strip() or None
    title = (title_contains or "").strip() or None
    equals = {key: value for key, value in (metadata_equals or {}).items() if key and value}
    return RetrievalFilter(
        document_ids=ids,
        kinds=kind_values,
        source_uri=uri,
        title_contains=title,
        metadata_equals=equals,
    )
