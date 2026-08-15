import json

from fastapi.testclient import TestClient


def _ingest(client: TestClient, document_id: str, title: str, content: str) -> None:
    response = client.post(
        "/v1/knowledge/ingest",
        headers={"x-tenant-id": "tenant-1", "x-correlation-id": "corr-1"},
        json={
            "schemaVersion": 1,
            "documentId": document_id,
            "kind": "article",
            "version": 1,
            "title": title,
            "replacePreviousVersion": False,
            "content": content,
            "contentEncoding": "utf8",
        },
    )
    assert response.status_code == 200
    assert response.json()["status"] == "processed"


def test_retrieve_requires_tenant_context(client: TestClient) -> None:
    response = client.post("/v1/knowledge/retrieve", json={"query": "refunds"})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "TENANT_CONTEXT_REQUIRED"


def test_retrieve_returns_citations_and_respects_top_k(client: TestClient) -> None:
    _ingest(client, "doc-1", "Refund policy", "Refunds are issued within five business days.")
    _ingest(client, "doc-2", "Shipping policy", "Shipping takes three days to Canada.")
    response = client.post(
        "/v1/knowledge/retrieve",
        headers={"x-tenant-id": "tenant-1", "x-correlation-id": "corr-1"},
        json={"query": "refunds", "topK": 1},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["topK"] == 1
    assert len(body["citations"]) == 1
    assert body["citations"][0]["documentId"] == "doc-1"
    assert body["citations"][0]["title"] == "Refund policy"
    assert body["chunks"][0]["documentId"] == "doc-1"


def test_retrieve_filters_by_document_id(client: TestClient) -> None:
    _ingest(client, "doc-1", "Refund policy", "Refunds are issued within five business days.")
    _ingest(client, "doc-2", "Shipping policy", "Shipping takes three days to Canada.")
    response = client.post(
        "/v1/knowledge/retrieve",
        headers={"x-tenant-id": "tenant-1"},
        json={"query": "policy", "filters": {"documentIds": ["doc-2"]}},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["chunks"]
    assert all(chunk["documentId"] == "doc-2" for chunk in body["chunks"])


def test_support_reply_includes_citations(client: TestClient) -> None:
    _ingest(client, "doc-1", "Refund policy", "Refunds are issued within five business days.")
    with client.stream(
        "POST",
        "/v1/support/reply/stream",
        headers={"x-tenant-id": "tenant-1", "x-correlation-id": "corr-1"},
        json={
            "conversationId": "conv-1",
            "visitorMessage": "How long do refunds take?",
            "history": [],
            "topK": 3,
        },
    ) as stream:
        events: list[dict[str, object]] = []
        for line in stream.iter_lines():
            if line.startswith("data: "):
                events.append(json.loads(line[6:]))
    done = next(event for event in events if event.get("type") == "done")
    reply = done["reply"]
    assert isinstance(reply["content"], str) and reply["content"]
    assert reply["citations"]
    assert reply["citations"][0]["documentId"] == "doc-1"
