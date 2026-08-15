from app.rag.hybrid import hybrid_weights, reciprocal_rank_fusion


def test_reciprocal_rank_fusion_prefers_consensus() -> None:
    fused = reciprocal_rank_fusion(
        (("a", "b", "c"), ("c", "a", "d")),
        weights=(0.5, 0.5),
        k=60,
    )
    ordered = [item_id for item_id, _score in fused]
    assert ordered[0] == "a"
    assert "c" in ordered
    assert "d" in ordered


def test_hybrid_weights_normalize() -> None:
    assert hybrid_weights(0.6, 0.4) == (0.6, 0.4)
    left, right = hybrid_weights(3, 1)
    assert abs(left - 0.75) < 1e-9
    assert abs(right - 0.25) < 1e-9


def test_equal_weights_when_both_zero() -> None:
    assert hybrid_weights(0, 0) == (0.5, 0.5)
