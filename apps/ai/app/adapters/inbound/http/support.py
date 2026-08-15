from collections.abc import AsyncIterator
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.application.use_cases.generate_support_reply_use_case import (
    GenerateSupportReplyCommand,
    GenerateSupportReplyUseCase,
    SupportChatMessage,
)
from app.context import get_request_context
from app.domain.errors import TenantContextRequiredError
from app.domain.onboarding import require_tenant_id
from app.domain.retrieval import MAX_TOP_K, MIN_TOP_K, normalize_retrieval_filter

router = APIRouter(prefix="/v1/support", tags=["support"])

Role = Literal["customer", "agent", "ai", "system"]


class SupportChatMessageBody(BaseModel):
    role: Role
    content: str = Field(min_length=1, max_length=10_000)


class SupportReplyAgentSettingsBody(BaseModel):
    assistantName: str = Field(min_length=1, max_length=80)
    greeting: str = Field(min_length=1, max_length=280)
    systemInstructions: str = Field(min_length=1, max_length=8000)
    allowedTopics: list[str] = Field(default_factory=list)
    forbiddenTopics: list[str] = Field(default_factory=list)
    language: str = Field(min_length=1, max_length=80)
    escalateWhen: list[str] = Field(default_factory=list)


class SupportRetrievalFilterBody(BaseModel):
    documentIds: list[str] = Field(default_factory=list)
    kinds: list[Literal["pdf", "docx", "url", "article"]] = Field(default_factory=list)
    sourceUri: str | None = Field(default=None, max_length=2000)


class GenerateSupportReplyBody(BaseModel):
    conversationId: str = Field(min_length=1, max_length=80)
    visitorMessage: str = Field(min_length=1, max_length=10_000)
    history: list[SupportChatMessageBody] = Field(default_factory=list)
    widgetGreeting: str | None = Field(default=None, max_length=280)
    agentSettings: SupportReplyAgentSettingsBody | None = None
    topK: int | None = Field(default=None, ge=MIN_TOP_K, le=MAX_TOP_K)
    retrieval: SupportRetrievalFilterBody | None = None


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


def generate_support_reply_use_case(request: Request) -> GenerateSupportReplyUseCase:
    return request.app.state.generate_support_reply


def build_support_reply_command(body: GenerateSupportReplyBody) -> GenerateSupportReplyCommand:
    settings = body.agentSettings
    filters = None
    if body.retrieval is not None:
        filters = normalize_retrieval_filter(
            document_ids=tuple(body.retrieval.documentIds),
            kinds=tuple(body.retrieval.kinds),
            source_uri=body.retrieval.sourceUri,
        )
    return GenerateSupportReplyCommand(
        tenant_id=_tenant_id(),
        correlation_id=_correlation_id(),
        conversation_id=body.conversationId,
        visitor_message=body.visitorMessage,
        history=tuple(SupportChatMessage(role=item.role, content=item.content) for item in body.history),
        widget_greeting=body.widgetGreeting,
        assistant_name=settings.assistantName if settings else "Support assistant",
        greeting=settings.greeting if settings else "Hi — how can I help?",
        system_instructions=settings.systemInstructions if settings else "Be helpful, accurate, and concise.",
        language=settings.language if settings else "English",
        allowed_topics=tuple(settings.allowedTopics) if settings else (),
        forbidden_topics=tuple(settings.forbiddenTopics) if settings else (),
        escalate_when=tuple(settings.escalateWhen) if settings else (),
        top_k=body.topK,
        retrieval_filters=filters,
    )


@router.post("/reply/stream")
async def stream_support_reply(
    body: GenerateSupportReplyBody,
    use_case: Annotated[GenerateSupportReplyUseCase, Depends(generate_support_reply_use_case)],
) -> StreamingResponse:
    command = build_support_reply_command(body)

    async def events() -> AsyncIterator[str]:
        async for chunk in use_case.stream(command):
            if chunk.delta:
                yield _sse({"type": "delta", "text": chunk.delta})
            if chunk.done and chunk.result is not None:
                yield _sse(
                    {
                        "type": "done",
                        "reply": {
                            "content": chunk.result.content,
                            "model": chunk.result.model,
                            "promptTokens": chunk.result.prompt_tokens,
                            "completionTokens": chunk.result.completion_tokens,
                            "citations": [citation.to_dict() for citation in chunk.citations],
                        },
                    }
                )

    return StreamingResponse(events(), media_type="text/event-stream")


def _sse(payload: dict[str, Any]) -> str:
    import json

    return f"data: {json.dumps(payload)}\n\n"
