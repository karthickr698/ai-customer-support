"""Keyword plus vector fusion. No provider SDKs."""

from collections.abc import Sequence

from app.domain.retrieval import DEFAULT_KEYWORD_WEIGHT, DEFAULT_RRF_K, DEFAULT_VECTOR_WEIGHT


def reciprocal_rank_fusion(
    ranked_ids: Sequence[Sequence[str]],
    *,
    weights: Sequence[float] | None = None,
    k: int = DEFAULT_RRF_K,
) -> list[tuple[str, float]]:
    if k < 1:
        raise ValueError("rrf_k must be at least 1")
    if not ranked_ids:
        return []
    resolved_weights = _normalize_weights(weights, len(ranked_ids))
    scores: dict[str, float] = {}
    for weight, ranking in zip(resolved_weights, ranked_ids, strict=True):
        for rank, item_id in enumerate(ranking, start=1):
            scores[item_id] = scores.get(item_id, 0.0) + weight / (k + rank)
    return sorted(scores.items(), key=lambda item: item[1], reverse=True)


def hybrid_weights(
    vector_weight: float = DEFAULT_VECTOR_WEIGHT,
    keyword_weight: float = DEFAULT_KEYWORD_WEIGHT,
) -> tuple[float, float]:
    total = max(vector_weight, 0.0) + max(keyword_weight, 0.0)
    if total <= 0:
        return (0.5, 0.5)
    return (max(vector_weight, 0.0) / total, max(keyword_weight, 0.0) / total)


def _normalize_weights(weights: Sequence[float] | None, count: int) -> tuple[float, ...]:
    if weights is None:
        equal = 1.0 / count
        return tuple(equal for _ in range(count))
    if len(weights) != count:
        raise ValueError("fusion weight count must match ranked lists")
    clipped = tuple(max(weight, 0.0) for weight in weights)
    total = sum(clipped)
    if total <= 0:
        equal = 1.0 / count
        return tuple(equal for _ in range(count))
    return tuple(weight / total for weight in clipped)
