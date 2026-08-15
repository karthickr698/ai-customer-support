"""Conversation + knowledge context assembly. No provider SDKs."""

from app.application.ports.llm_port import LLMMessage
from app.domain.orchestration import SupportChatMessage

_HISTORY_LIMIT = 20


def assemble_support_messages(
    *,
    system_prompt: str,
    history: tuple[SupportChatMessage, ...],
    visitor_message: str,
) -> tuple[LLMMessage, ...]:
    messages: list[LLMMessage] = [LLMMessage(role="system", content=system_prompt)]
    for item in history[-_HISTORY_LIMIT:]:
        if item.role == "system":
            continue
        role = "user" if item.role == "customer" else "assistant"
        content = item.content.strip()
        if content:
            messages.append(LLMMessage(role=role, content=content))
    messages.append(LLMMessage(role="user", content=visitor_message.strip()))
    return tuple(messages)
