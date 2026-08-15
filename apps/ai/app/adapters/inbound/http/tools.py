from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from app.adapters.inbound.http.support import SupportChatMessageBody
from app.application.use_cases.apply_tool_results_use_case import (
    ApplyToolResultsCommand,
    ApplyToolResultsUseCase,
    parse_tool_results_payload,
)
from app.application.use_cases.generate_support_reply_use_case import SupportChatMessage
from app.application.use_cases.propose_tool_calls_use_case import (
    ProposeToolCallsCommand,
    ProposeToolCallsUseCase,
)
from app.context import get_request_context
from app.domain.errors import TenantContextRequiredError
from app.domain.onboarding import require_tenant_id
from app.domain.tools import ToolName, catalog_payload, parse_tool_name

router = APIRouter(prefix="/v1/tools", tags=["tools"])


class ProposeToolCallsBody(BaseModel):
    conversationId: str = Field(min_length=1, max_length=80)
    visitorMessage: str = Field(min_length=1, max_length=10_000)
    history: list[SupportChatMessageBody] = Field(default_factory=list)
    allowedTools: list[str] | None = None


class ToolCallResultBody(BaseModel):
    name: str
    ok: bool
    data: dict[str, Any] | None = None
    errorCode: str | None = None
    errorMessage: str | None = None


class ApplyToolResultsBody(BaseModel):
    conversationId: str = Field(min_length=1, max_length=80)
    visitorMessage: str = Field(min_length=1, max_length=10_000)
    history: list[SupportChatMessageBody] = Field(default_factory=list)
    results: list[ToolCallResultBody] = Field(min_length=1, max_length=10)


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


def propose_use_case(request: Request) -> ProposeToolCallsUseCase:
    return request.app.state.propose_tool_calls


def apply_use_case(request: Request) -> ApplyToolResultsUseCase:
    return request.app.state.apply_tool_results


@router.get("")
async def list_tools() -> dict[str, object]:
    return {"schemaVersion": 1, "items": catalog_payload()}


@router.post("/propose")
async def propose_tool_calls(
    body: ProposeToolCallsBody,
    use_case: Annotated[ProposeToolCallsUseCase, Depends(propose_use_case)],
) -> dict[str, object]:
    allowed: tuple[ToolName, ...] | None = None
    if body.allowedTools is not None:
        allowed = tuple(parse_tool_name(name) for name in body.allowedTools)
    result = await use_case.execute(
        ProposeToolCallsCommand(
            tenant_id=_tenant_id(),
            correlation_id=_correlation_id(),
            conversation_id=body.conversationId,
            visitor_message=body.visitorMessage,
            history=tuple(SupportChatMessage(role=item.role, content=item.content) for item in body.history),
            allowed_tools=allowed,
        )
    )
    return result.to_dict()


@router.post("/apply-results")
async def apply_tool_results(
    body: ApplyToolResultsBody,
    use_case: Annotated[ApplyToolResultsUseCase, Depends(apply_use_case)],
) -> dict[str, object]:
    results = parse_tool_results_payload(
        [
            {
                "name": item.name,
                "ok": item.ok,
                "data": item.data,
                "errorCode": item.errorCode,
                "errorMessage": item.errorMessage,
            }
            for item in body.results
        ]
    )
    outcome = await use_case.execute(
        ApplyToolResultsCommand(
            tenant_id=_tenant_id(),
            correlation_id=_correlation_id(),
            conversation_id=body.conversationId,
            visitor_message=body.visitorMessage,
            history=tuple(SupportChatMessage(role=item.role, content=item.content) for item in body.history),
            results=results,
        )
    )
    return outcome.to_dict()
