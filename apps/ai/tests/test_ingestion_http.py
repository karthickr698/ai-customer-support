from fastapi.testclient import TestClient


def test_ingest_requires_tenant_context(client: TestClient) -> None:
    response = client.post(
        "/v1/knowledge/ingest",
        json={
            "schemaVersion": 1,
            "documentId": "doc-1",
            "kind": "article",
            "version": 1,
            "title": "Policy",
            "replacePreviousVersion": False,
            "content": "Refunds take five days.",
            "contentEncoding": "utf8",
        },
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "TENANT_CONTEXT_REQUIRED"


def test_ingest_article_returns_processed_contract(client: TestClient) -> None:
    response = client.post(
        "/v1/knowledge/ingest",
        headers={"x-tenant-id": "tenant-1", "x-correlation-id": "corr-1"},
        json={
            "schemaVersion": 1,
            "documentId": "doc-1",
            "kind": "article",
            "version": 1,
            "title": "Refund policy",
            "replacePreviousVersion": False,
            "content": "Refunds are issued within five business days.",
            "contentEncoding": "utf8",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["schemaVersion"] == 1
    assert body["status"] == "processed"
    assert body["documentId"] == "doc-1"
    assert body["chunkCount"] >= 1
    assert body["metadata"]["kind"] == "article"


def test_delete_index_returns_count(client: TestClient) -> None:
    client.post(
        "/v1/knowledge/ingest",
        headers={"x-tenant-id": "tenant-1"},
        json={
            "schemaVersion": 1,
            "documentId": "doc-2",
            "kind": "article",
            "version": 1,
            "title": "Hours",
            "replacePreviousVersion": False,
            "content": "We are open weekdays.",
            "contentEncoding": "utf8",
        },
    )
    response = client.post(
        "/v1/knowledge/index/delete",
        headers={"x-tenant-id": "tenant-1"},
        json={"documentId": "doc-2"},
    )
    assert response.status_code == 200
    assert response.json()["documentId"] == "doc-2"
    assert response.json()["deletedCount"] >= 1
