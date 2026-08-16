import base64
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field, HttpUrl

from app.application.use_cases.ingest_document_use_case import (
    DeleteIndexedDocumentCommand,
    DeleteIndexedDocumentUseCase,
    IngestDocumentCommand,
    IngestDocumentUseCase,
)
from app.application.use_cases.retrieve_knowledge_use_case import (
    RetrieveKnowledgeCommand,
    RetrieveKnowledgeUseCase,
)
from app.application.use_cases.run_rag_playground_use_case import (
    RunRagPlaygroundCommand,
    RunRagPlaygroundUseCase,
)
from app.context import get_request_context
from app.domain.errors import InvalidIngestionInputError, TenantContextRequiredError
from app.domain.ingestion import INGEST_SCHEMA_VERSION, MAX_BINARY_BYTES
from app.domain.onboarding import require_tenant_id
from app.domain.retrieval import MAX_TOP_K, MIN_TOP_K, normalize_retrieval_filter

router = APIRouter(prefix="/v1/knowledge", tags=["knowledge"])

DocumentKind = Literal["pdf", "docx", "url", "article"]
ContentEncoding = Literal["utf8", "base64"]


class IngestDocumentBody(BaseModel):
    schemaVersion: Literal[1] = 1
    documentId: str = Field(min_length=1, max_length=80)
    kind: DocumentKind
    version: int = Field(ge=1, le=1_000_000)
    title: str = Field(min_length=1, max_length=200)
    replacePreviousVersion: bool = False
    sourceUri: HttpUrl | None = None
    mediaType: str | None = Field(default=None, max_length=200)
    checksum: str | None = Field(default=None, max_length=128)
    content: str | None = None
    contentEncoding: ContentEncoding | None = None


class DeleteIndexedDocumentBody(BaseModel):
    documentId: str = Field(min_length=1, max_length=80)


class RetrievalFilterBody(BaseModel):
    documentIds: list[str] = Field(default_factory=list)
    kinds: list[DocumentKind] = Field(default_factory=list)
    sourceUri: str | None = Field(default=None, max_length=2000)
    titleContains: str | None = Field(default=None, max_length=200)


class RetrieveKnowledgeBody(BaseModel):
    query: str = Field(min_length=1, max_length=10_000)
    topK: int | None = Field(default=None, ge=MIN_TOP_K, le=MAX_TOP_K)
    documentId: str | None = Field(default=None, min_length=1, max_length=80)
    filters: RetrievalFilterBody | None = None


class RagPlaygroundBody(RetrieveKnowledgeBody):
    generate: bool = True


def _tenant_id() -> str:
    context = get_request_context()
    if context is None or not context.tenant_id:
        raise TenantContextRequiredError()
    return require_tenant_id(context.tenant_id)


def _correlation_id() -> str:
    context = get_request_context()
    if context is None:
        raise TenantContextRequiredError()
    return context.correlation_id


def ingest_use_case(request: Request) -> IngestDocumentUseCase:
    return request.app.state.ingest_document


def delete_index_use_case(request: Request) -> DeleteIndexedDocumentUseCase:
    return request.app.state.delete_indexed_document


def retrieve_knowledge_use_case(request: Request) -> RetrieveKnowledgeUseCase:
    return request.app.state.retrieve_knowledge


def rag_playground_use_case(request: Request) -> RunRagPlaygroundUseCase:
    return request.app.state.run_rag_playground


@router.post("/ingest")
async def ingest_document(
    body: IngestDocumentBody,
    use_case: Annotated[IngestDocumentUseCase, Depends(ingest_use_case)],
) -> dict[str, Any]:
    content, content_text = _decode_content(body)
    result = await use_case.execute(
        IngestDocumentCommand(
            tenant_id=_tenant_id(),
            correlation_id=_correlation_id(),
            document_id=body.documentId,
            kind=body.kind,
            version=body.version,
            title=body.title,
            replace_previous_version=body.replacePreviousVersion,
            source_uri=str(body.sourceUri) if body.sourceUri else None,
            media_type=body.mediaType,
            checksum=body.checksum,
            content=content,
            content_text=content_text,
        )
    )
    payload = result.to_dict()
    payload["schemaVersion"] = INGEST_SCHEMA_VERSION
    return payload


@router.post("/index/delete")
async def delete_indexed_document(
    body: DeleteIndexedDocumentBody,
    use_case: Annotated[DeleteIndexedDocumentUseCase, Depends(delete_index_use_case)],
) -> dict[str, Any]:
    deleted = await use_case.execute(
        DeleteIndexedDocumentCommand(
            tenant_id=_tenant_id(),
            document_id=body.documentId,
            correlation_id=_correlation_id(),
        )
    )
    return {"documentId": body.documentId, "deletedCount": deleted}


@router.post("/retrieve")
async def retrieve_knowledge(
    body: RetrieveKnowledgeBody,
    use_case: Annotated[RetrieveKnowledgeUseCase, Depends(retrieve_knowledge_use_case)],
) -> dict[str, Any]:
    filters = None
    if body.filters is not None:
        filters = normalize_retrieval_filter(
            document_ids=tuple(body.filters.documentIds),
            kinds=tuple(body.filters.kinds),
            source_uri=body.filters.sourceUri,
            title_contains=body.filters.titleContains,
            document_id=body.documentId,
        )
    result = await use_case.execute(
        RetrieveKnowledgeCommand(
            tenant_id=_tenant_id(),
            correlation_id=_correlation_id(),
            query=body.query,
            top_k=body.topK,
            filters=filters,
            document_id=body.documentId,
        )
    )
    return result.to_dict()


@router.post("/playground")
async def run_rag_playground(
    body: RagPlaygroundBody,
    use_case: Annotated[RunRagPlaygroundUseCase, Depends(rag_playground_use_case)],
) -> dict[str, Any]:
    filters = None
    if body.filters is not None:
        filters = normalize_retrieval_filter(
            document_ids=tuple(body.filters.documentIds),
            kinds=tuple(body.filters.kinds),
            source_uri=body.filters.sourceUri,
            title_contains=body.filters.titleContains,
            document_id=body.documentId,
        )
    result = await use_case.execute(
        RunRagPlaygroundCommand(
            tenant_id=_tenant_id(),
            correlation_id=_correlation_id(),
            query=body.query,
            top_k=body.topK,
            filters=filters,
            document_id=body.documentId,
            generate=body.generate,
        )
    )
    return result.to_dict()


def _decode_content(body: IngestDocumentBody) -> tuple[bytes | None, str | None]:
    if body.content is None:
        return None, None
    encoding = body.contentEncoding or ("base64" if body.kind in ("pdf", "docx") else "utf8")
    if encoding == "utf8":
        return None, body.content
    try:
        binary = base64.b64decode(body.content, validate=True)
    except Exception as exc:  # noqa: BLE001
        raise InvalidIngestionInputError("File content is not valid base64") from exc
    if len(binary) > MAX_BINARY_BYTES:
        raise InvalidIngestionInputError("The document is too large")
    return binary, None
