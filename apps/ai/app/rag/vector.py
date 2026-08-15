"""Vector similarity helpers. No provider SDKs."""

import math


def cosine_similarity(left: tuple[float, ...], right: tuple[float, ...]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    dot = 0.0
    left_norm = 0.0
    right_norm = 0.0
    for a, b in zip(left, right, strict=True):
        dot += a * b
        left_norm += a * a
        right_norm += b * b
    denom = math.sqrt(left_norm) * math.sqrt(right_norm)
    if denom == 0:
        return 0.0
    return max(-1.0, min(1.0, dot / denom))
