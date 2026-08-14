from collections.abc import AsyncIterator
from dataclasses import dataclass
import logging

from app.application.ports.llm_port import LLMCompletionRequest, LLMMessage, LLMPort, LLMStreamChunk
from app.domain.errors import InvalidAIOutputError, TenantContextRequiredError
from app.domain.onboarding import require_tenant_id
from app.guardrails.support_reply import sanitize_support_reply
from app.prompts.support_reply import support_reply_system_prompt


@dataclass(frozen=True, slots=True)
class SupportChatMessage:
    role: str
    content: str


@dataclass(frozen=True, slots=True)
class GenerateSupportReplyCommand:
    tenant_id: str
    correlation_id: str
    conversation_id: str
    visitor_message: str
    history: tuple[SupportChatMessage, ...]
    widget_greeting: str | None = None
    assistant_name: str = "Support assistant"
    greeting: str = "Hi — how can I help?"
    system_instructions: str = "Be helpful, accurate, and concise."
    language: str = "English"
    allowed_topics: tuple[str, ...] = ()
    forbidden_topics: tuple[str, ...] = ()
    escalate_when: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class SupportReplyResult:
    content: str
    model: str
    prompt_tokens: int
    completion_tokens: int

    def to_dict(self) -> dict[str, object]:
        return {
            "content": self.content,
            "model": self.model,
            "promptTokens": self.prompt_tokens,
            "completionTokens": self.completion_tokens,
        }


class GenerateSupportReplyUseCase:
    def __init__(self, llm: LLMPort, logger: logging.Logger) -> None:
        self._llm = llm
        self._logger = logger

    def stream(self, command: GenerateSupportReplyCommand) -> AsyncIterator[LLMStreamChunk]:
        tenant_id = require_tenant_id(command.tenant_id)
        if not command.visitor_message.strip():
            raise InvalidAIOutputError("Visitor message is required")
        request = LLMCompletionRequest(
            messages=self._messages(command),
            correlation_id=command.correlation_id,
            tenant_id=tenant_id,
            temperature=0.3,
        )
        return self._stream(request, tenant_id, command.conversation_id)

    async def _stream(
        self,
        request: LLMCompletionRequest,
        tenant_id: str,
        conversation_id: str,
    ) -> AsyncIterator[LLMStreamChunk]:
        assembled: list[str] = []
        async for chunk in self._llm.stream(request):
            if chunk.delta:
                assembled.append(chunk.delta)
                yield LLMStreamChunk(delta=chunk.delta)
            if chunk.done and chunk.result is not None:
                content = sanitize_support_reply("".join(assembled) or chunk.result.content)
                self._logger.info(
                    "Support reply generated",
                    extra={
                        "tenantId": tenant_id,
                        "conversationId": conversation_id,
                        "model": chunk.result.model,
                        "promptTokens": chunk.result.prompt_tokens,
                        "completionTokens": chunk.result.completion_tokens,
                    },
                )
                yield LLMStreamChunk(
                    delta="",
                    done=True,
                    result=chunk.result.__class__(
                        content=content,
                        model=chunk.result.model,
                        prompt_tokens=chunk.result.prompt_tokens,
                        completion_tokens=chunk.result.completion_tokens,
                    ),
                )

    def _messages(self, command: GenerateSupportReplyCommand) -> tuple[LLMMessage, ...]:
        system = support_reply_system_prompt(
            assistant_name=command.assistant_name,
            greeting=command.widget_greeting or command.greeting,
            instructions=command.system_instructions,
            language=command.language,
            allowed_topics=command.allowed_topics,
            forbidden_topics=command.forbidden_topics,
            escalate_when=command.escalate_when,
        )
        history: list[LLMMessage] = []
        for item in command.history[-20:]:
            role = "user" if item.role == "customer" else "assistant"
            if item.role == "system":
                continue
            content = item.content.strip()
            if content:
                history.append(LLMMessage(role=role, content=content))
        history.append(LLMMessage(role="user", content=command.visitor_message.strip()))
        return (LLMMessage(role="system", content=system), *tuple(history))
