from app.adapters.outbound.vector_store.pgvector_store import _filter_sql, _safe_ident, to_vector_literal
from app.domain.errors import VectorIndexError
from app.domain.retrieval import RetrievalFilter
import pytest


def test_vector_literal_format() -> None:
    assert to_vector_literal((0.1, -0.2, 0.0)).startswith("[")
    assert to_vector_literal((1.0, 2.0)).count(",") == 1


def test_filter_sql_is_parameterized() -> None:
    clause, args = _filter_sql(
        RetrievalFilter(
            document_ids=("doc-1",),
            kinds=("article",),
            source_uri="https://example.com/help",
            title_contains="Refund_policy",
            metadata_equals={"parser": "article"},
        ),
        start=3,
    )
    assert "$3" in clause
    assert "ILIKE" in clause
    assert "Refund\\_policy" in args[3]
    assert "doc-1" in args[0]
    assert args[-1] == "article"


def test_schema_ident_rejects_sql() -> None:
    with pytest.raises(VectorIndexError):
        _safe_ident("ai; drop table")
    assert _safe_ident("ai_vectors") == "ai_vectors"
