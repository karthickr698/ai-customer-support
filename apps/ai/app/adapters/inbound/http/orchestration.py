from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from app.adapters.inbound.http.support import (
    GenerateSupportReplyBody,
    SupportChatMessageBody,
    SupportReplyAgentSettingsBody,
    build_support_reply_command,
)
from app.application.use_cases.detect_intent_use_case import DetectIntentCommand, DetectIntentUseCase
from app.application.use_cases.orchestrate_support_turn_use_case import (
    OrchestrateSupportTurnCommand,
    OrchestrateSupportTurnUseCase,
)
from app.application.use_cases.generate_support_reply_use_case import SupportChatMessage
from app.context import get_request_context
from app.domain.errors import TenantContextRequiredError
from app.domain.onboarding import require_tenant_id

router = APIRouter(prefix="/v1/orchestration", tags=["orchestration"])


class DetectIntentBody(BaseModel):
    visitorMessage: str = Field(min_length=1, max_length=10_000)
    history: list[SupportChatMessageBody] = Field(default_factory=list)
    agentSettings: SupportReplyAgentSettingsBody | None = None


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


def detect_intent_use_case(request: Request) -> DetectIntentUseCase:
    return request.app.state.detect_intent


def orchestrate_support_turn_use_case(request: Request) -> OrchestrateSupportTurnUseCase:
    return request.app.state.orchestrate_support_turn


@router.post("/intent")
async def detect_support_intent(
    body: DetectIntentBody,
    use_case: Annotated[DetectIntentUseCase, Depends(detect_intent_use_case)],
) -> dict[str, object]:
    settings = body.agentSettings
    result = await use_case.execute(
        DetectIntentCommand(
            tenant_id=_tenant_id(),
            correlation_id=_correlation_id(),
            visitor_message=body.visitorMessage,
            history=tuple(SupportChatMessage(role=item.role, content=item.content) for item in body.history),
            escalate_when=tuple(settings.escalateWhen) if settings else (),
            forbidden_topics=tuple(settings.forbiddenTopics) if settings else (),
        )
    )
    return result.to_dict()


@router.post("/run")
async def orchestrate_support_turn(
    body: GenerateSupportReplyBody,
    use_case: Annotated[OrchestrateSupportTurnUseCase, Depends(orchestrate_support_turn_use_case)],
) -> dict[str, object]:
    support = build_support_reply_command(body)
    result = await use_case.execute(
        OrchestrateSupportTurnCommand(
            tenant_id=support.tenant_id,
            correlation_id=support.correlation_id,
            conversation_id=support.conversation_id,
            visitor_message=support.visitor_message,
            history=support.history,
            widget_greeting=support.widget_greeting,
            assistant_name=support.assistant_name,
            greeting=support.greeting,
            system_instructions=support.system_instructions,
            language=support.language,
            allowed_topics=support.allowed_topics,
            forbidden_topics=support.forbidden_topics,
            escalate_when=support.escalate_when,
            top_k=support.top_k,
            retrieval_filters=support.retrieval_filters,
        )
    )
    return result.to_dict()