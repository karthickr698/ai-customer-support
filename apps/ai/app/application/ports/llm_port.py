from collections.abc import AsyncIterator
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
    json_mode: bool = False
    temperature: float = 0.2
    model: str | None = None


@dataclass(frozen=True, slots=True)
class LLMCompletionResult:
    content: str
    model: str
    prompt_tokens: int
    completion_tokens: int


@dataclass(frozen=True, slots=True)
class LLMStreamChunk:
    delta: str
    done: bool = False
    result: LLMCompletionResult | None = None


class LLMPort(Protocol):
    """Outbound LLM capability. Provider SDKs implement this in adapters."""

    async def complete(self, request: LLMCompletionRequest) -> LLMCompletionResult: ...

    def stream(self, request: LLMCompletionRequest) -> AsyncIterator[LLMStreamChunk]: ...
