from dataclasses import dataclass
import json
import logging

from app.application.ports.llm_port import LLMCompletionRequest, LLMMessage
from app.domain.errors import InvalidAIOutputError, InvalidToolCallError
from app.domain.onboarding import require_tenant_id
from app.domain.orchestration import SupportChatMessage
from app.domain.tools import (
    TOOL_CALL_SCHEMA_VERSION,
    TOOL_NAMES,
    ProposedToolCall,
    ToolName,
    parse_tool_name,
    validate_tool_arguments,
)
from app.guardrails.input import screen_input
from app.prompts.tools import propose_tools_system_prompt


@dataclass(frozen=True, slots=True)
class ProposeToolCallsCommand:
    tenant_id: str
    correlation_id: str
    conversation_id: str
    visitor_message: str
    history: tuple[SupportChatMessage, ...] = ()
    allowed_tools: tuple[ToolName, ...] | None = None


@dataclass(frozen=True, slots=True)
class ProposeToolCallsResult:
    calls: tuple[ProposedToolCall, ...]
    reason: str | None

    def to_dict(self) -> dict[str, object]:
        return {
            "schemaVersion": TOOL_CALL_SCHEMA_VERSION,
            "calls": [call.to_dict() for call in self.calls],
            "reason": self.reason,
        }


class ProposeToolCallsUseCase:
    def __init__(self, llm, logger: logging.Logger) -> None:
        self._llm = llm
        self._logger = logger

    async def execute(self, command: ProposeToolCallsCommand) -> ProposeToolCallsResult:
        tenant_id = require_tenant_id(command.tenant_id)
        message = command.visitor_message.strip()
        if not message:
            raise InvalidToolCallError("Visitor message is required")

        screened = screen_input(message)
        if screened.verdict == "blocked":
            return ProposeToolCallsResult(calls=(), reason=screened.reason or "guardrail")

        allowed = command.allowed_tools
        if allowed:
            for name in allowed:
                parse_tool_name(name)

        payload = {
            "conversationId": command.conversation_id,
            "visitorMessage": message,
            "history": [{"role": item.role, "content": item.content} for item in command.history],
            "allowedTools": list(allowed) if allowed else list(TOOL_NAMES),
        }
        completion = await self._llm.complete(
            LLMCompletionRequest(
                messages=(
                    LLMMessage(role="system", content=propose_tools_system_prompt(allowed_tools=allowed)),
                    LLMMessage(role="user", content=json.dumps(payload)),
                ),
                correlation_id=command.correlation_id,
                tenant_id=tenant_id,
                json_mode=True,
            )
        )
        calls, reason = parse_proposed_calls(completion.content, allowed)
        self._logger.info(
            "Proposed tool calls",
            extra={
                "tenantId": tenant_id,
                "conversationId": command.conversation_id,
                "toolCount": len(calls),
                "model": completion.model,
            },
        )
        return ProposeToolCallsResult(calls=calls, reason=reason)


def parse_proposed_calls(
    raw: str,
    allowed: tuple[ToolName, ...] | None,
) -> tuple[tuple[ProposedToolCall, ...], str | None]:
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise InvalidAIOutputError("Tool proposal was not valid JSON") from exc
    if not isinstance(parsed, dict):
        raise InvalidAIOutputError("Tool proposal must be an object")

    reason = parsed.get("reason")
    if reason is not None and not isinstance(reason, str):
        raise InvalidAIOutputError("Tool proposal reason must be a string or null")

    raw_calls = parsed.get("calls")
    if not isinstance(raw_calls, list):
        raise InvalidAIOutputError("Tool proposal calls must be an array")

    allowlist = set(allowed) if allowed else set(TOOL_NAMES)
    calls: list[ProposedToolCall] = []
    for item in raw_calls:
        if not isinstance(item, dict):
            raise InvalidToolCallError("Each proposed call must be an object")
        name = str(item.get("name") or "")
        if name not in allowlist:
            raise InvalidToolCallError(f"Tool is not allowlisted: {name}")
        arguments = item.get("arguments") or {}
        calls.append(validate_tool_arguments(name, arguments))
    return tuple(calls), reason
