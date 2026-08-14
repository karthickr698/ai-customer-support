from app.rag.chunking import chunk_text, normalize_document_text


def test_normalize_strips_nul_and_collapses_whitespace() -> None:
    text = normalize_document_text("Hello\x00  world\n\n\n\nnext")
    assert "\x00" not in text
    assert "Hello world" in text


def test_chunk_text_splits_long_content_with_overlap() -> None:
    text = "alpha " * 200
    chunks = chunk_text(text, chunk_size=80, overlap=20)
    assert len(chunks) > 1
    assert chunks[0].index == 0
    assert chunks[1].start_offset < chunks[0].end_offset
    assert all(chunk.content.strip() for chunk in chunks)


def test_chunk_text_returns_empty_for_blank_input() -> None:
    assert chunk_text("   \n") == ()
