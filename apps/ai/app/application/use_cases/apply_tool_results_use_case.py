from dataclasses import dataclass
import json
import logging

from app.application.ports.llm_port import LLMCompletionRequest, LLMCompletionResult, LLMMessage
from app.domain.errors import InvalidAIOutputError, InvalidToolCallError
from app.domain.onboarding import require_tenant_id
from app.domain.orchestration import SupportChatMessage
from app.domain.tools import TOOL_CALL_SCHEMA_VERSION, ToolCallResult, parse_tool_result
from app.guardrails.output import screen_output
from app.prompts.tools import apply_tool_results_system_prompt


@dataclass(frozen=True, slots=True)
class ApplyToolResultsCommand:
    tenant_id: str
    correlation_id: str
    conversation_id: str
    visitor_message: str
    results: tuple[ToolCallResult, ...]
    history: tuple[SupportChatMessage, ...] = ()


@dataclass(frozen=True, slots=True)
class ApplyToolResultsOutcome:
    reply: str
    model: str
    prompt_tokens: int
    completion_tokens: int

    def to_dict(self) -> dict[str, object]:
        return {
            "schemaVersion": TOOL_CALL_SCHEMA_VERSION,
            "reply": self.reply,
            "model": self.model,
            "promptTokens": self.prompt_tokens,
            "completionTokens": self.completion_tokens,
        }


class ApplyToolResultsUseCase:
    def __init__(self, llm, logger: logging.Logger) -> None:
        self._llm = llm
        self._logger = logger

    async def execute(self, command: ApplyToolResultsCommand) -> ApplyToolResultsOutcome:
        tenant_id = require_tenant_id(command.tenant_id)
        if not command.visitor_message.strip():
            raise InvalidToolCallError("Visitor message is required")
        if not command.results:
            raise InvalidToolCallError("At least one tool result is required")

        payload = {
            "conversationId": command.conversation_id,
            "visitorMessage": command.visitor_message,
            "history": [{"role": item.role, "content": item.content} for item in command.history],
            "results": [item.to_dict() for item in command.results],
        }
        completion: LLMCompletionResult = await self._llm.complete(
            LLMCompletionRequest(
                messages=(
                    LLMMessage(role="system", content=apply_tool_results_system_prompt()),
                    LLMMessage(role="user", content=json.dumps(payload)),
                ),
                correlation_id=command.correlation_id,
                tenant_id=tenant_id,
                json_mode=True,
            )
        )
        reply = _parse_reply(completion.content)
        screened = screen_output(reply)
        final_reply = screened.content.strip() or (
            "I received the tool result but need a teammate to continue from here."
        )
        self._logger.info(
            "Applied tool results",
            extra={
                "tenantId": tenant_id,
                "conversationId": command.conversation_id,
                "model": completion.model,
                "promptTokens": completion.prompt_tokens,
                "completionTokens": completion.completion_tokens,
            },
        )
        return ApplyToolResultsOutcome(
            reply=final_reply,
            model=completion.model,
            prompt_tokens=completion.prompt_tokens,
            completion_tokens=completion.completion_tokens,
        )


def parse_tool_results_payload(raw: list[object]) -> tuple[ToolCallResult, ...]:
    results: list[ToolCallResult] = []
    for item in raw:
        if not isinstance(item, dict):
            raise InvalidToolCallError("Each tool result must be an object")
        results.append(parse_tool_result(item))
    return tuple(results)


def _parse_reply(raw: str) -> str:
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        text = raw.strip()
        if not text:
            raise InvalidAIOutputError("Tool follow-up reply was empty")
        return text
    if isinstance(parsed, dict):
        reply = parsed.get("reply")
        if isinstance(reply, str) and reply.strip():
            return reply.strip()
    if isinstance(parsed, str) and parsed.strip():
        return parsed.strip()
    raise InvalidAIOutputError("Tool follow-up reply was invalid")
