"""Lexical scoring for hybrid retrieval. No provider SDKs."""

import math
import re

_TOKEN = re.compile(r"[a-z0-9]+")
_BM25_K1 = 1.2
_BM25_B = 0.75


def tokenize(text: str) -> tuple[str, ...]:
    return tuple(_TOKEN.findall(text.lower()))


def keyword_overlap_score(query_tokens: tuple[str, ...] | set[str], doc_tokens: tuple[str, ...] | set[str]) -> float:
    query = set(query_tokens)
    document = set(doc_tokens)
    if not query or not document:
        return 0.0
    overlap = len(query & document)
    if overlap == 0:
        return 0.0
    return overlap / math.sqrt(len(query) * len(document))


def bm25_scores(
    query_tokens: tuple[str, ...],
    documents: tuple[tuple[str, ...], ...],
    *,
    k1: float = _BM25_K1,
    b: float = _BM25_B,
) -> tuple[float, ...]:
    if not query_tokens or not documents:
        return tuple(0.0 for _ in documents)

    unique_query = tuple(dict.fromkeys(query_tokens))
    doc_count = len(documents)
    avg_len = sum(len(doc) for doc in documents) / doc_count
    df: dict[str, int] = {}
    for token in unique_query:
        df[token] = sum(1 for doc in documents if token in doc)

    scores: list[float] = []
    for doc in documents:
        length = len(doc) or 1
        tf: dict[str, int] = {}
        for token in doc:
            tf[token] = tf.get(token, 0) + 1
        score = 0.0
        for token in unique_query:
            frequency = tf.get(token, 0)
            if frequency == 0:
                continue
            idf = math.log(1.0 + (doc_count - df[token] + 0.5) / (df[token] + 0.5))
            denom = frequency + k1 * (1.0 - b + b * (length / (avg_len or 1.0)))
            score += idf * (frequency * (k1 + 1.0) / denom)
        scores.append(score)
    return tuple(scores)
