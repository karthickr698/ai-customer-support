from dataclasses import dataclass
from typing import Literal, Protocol


@dataclass(frozen=True, slots=True)
class LLMMessage:
    role: Literal["system", "user", "assistant"]
    content: str


@dataclass(frozen=True, slots=True)
class LLMCompletionRequest:
    messages: tuple[LLMMessage, ...]
    correlation_id: str
    tenant_id: str


@dataclass(frozen=True, slots=True)
class LLMCompletionResult:
    content: str
    model: str
    prompt_tokens: int
    completion_tokens: int


class LLMPort(Protocol):
    """Outbound LLM capability. Provider SDKs implement this in adapters."""

    async def complete(self, request: LLMCompletionRequest) -> LLMCompletionResult: ...
