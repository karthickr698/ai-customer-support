"""LLM retries, fallbacks, and structured-output completion. No provider SDKs."""

from collections.abc import AsyncIterator, Callable
from dataclasses import dataclass
import logging

from app.application.ports.llm_port import (
    LLMCompletionRequest,
    LLMCompletionResult,
    LLMMessage,
    LLMPort,
    LLMStreamChunk,
)
from app.domain.errors import AIProviderError, InvalidAIOutputError, RateLimitExceededError
from app.guardrails.json_output import parse_json_object
from app.prompts.onboarding import repair_user_prompt

_RETRYABLE = (AIProviderError, RateLimitExceededError)


@dataclass(frozen=True, slots=True)
class ExecutedCompletion:
    result: LLMCompletionResult
    retry_count: int
    used_fallback: bool


class CompletionExecutor:
    def __init__(
        self,
        primary: LLMPort,
        fallback: LLMPort | None,
        max_attempts: int,
        logger: logging.Logger,
    ) -> None:
        self._primary = primary
        self._fallback = fallback
        self._max_attempts = max(1, max_attempts)
        self._logger = logger

    async def complete(self, request: LLMCompletionRequest) -> ExecutedCompletion:
        last_error: Exception | None = None
        for attempt in range(1, self._max_attempts + 1):
            try:
                result = await self._primary.complete(request)
                return ExecutedCompletion(result=result, retry_count=attempt - 1, used_fallback=False)
            except _RETRYABLE as exc:
                last_error = exc
                self._logger.warning(
                    "LLM completion failed; retrying",
                    extra={
                        "tenantId": request.tenant_id,
                        "attempt": attempt,
                        "maxAttempts": self._max_attempts,
                        "code": exc.code,
                    },
                )
        if self._fallback is not None:
            result = await self._fallback.complete(request)
            return ExecutedCompletion(
                result=result,
                retry_count=self._max_attempts,
                used_fallback=True,
            )
        if last_error is not None:
            raise last_error
        raise AIProviderError("The language model failed to complete the request")

    async def complete_json[T](
        self,
        request: LLMCompletionRequest,
        parse: Callable[[dict[str, object]], T],
    ) -> tuple[T, ExecutedCompletion]:
        executed = await self.complete(request)
        try:
            parsed = parse(parse_json_object(executed.result.content))
            return parsed, executed
        except InvalidAIOutputError as exc:
            repaired = await self._repair(request, executed, str(exc), parse)
            return repaired

    async def stream(self, request: LLMCompletionRequest) -> AsyncIterator[LLMStreamChunk]:
        yielded = False
        try:
            async for chunk in self._primary.stream(request):
                yielded = True
                yield chunk
            return
        except _RETRYABLE:
            if yielded or self._fallback is None:
                raise
            self._logger.warning(
                "LLM stream failed before tokens; using fallback",
                extra={"tenantId": request.tenant_id},
            )
        async for chunk in self._fallback.stream(request):
            yield chunk

    async def _repair[T](
        self,
        request: LLMCompletionRequest,
        executed: ExecutedCompletion,
        error: str,
        parse: Callable[[dict[str, object]], T],
    ) -> tuple[T, ExecutedCompletion]:
        repair_request = LLMCompletionRequest(
            messages=(
                *request.messages,
                LLMMessage(role="assistant", content=executed.result.content),
                LLMMessage(role="user", content=repair_user_prompt(executed.result.content, error)),
            ),
            correlation_id=request.correlation_id,
            tenant_id=request.tenant_id,
            json_mode=True,
            temperature=0,
            model=request.model,
        )
        try:
            result = await self._primary.complete(repair_request)
            parsed = parse(parse_json_object(result.content))
            return parsed, ExecutedCompletion(
                result=result,
                retry_count=executed.retry_count + 1,
                used_fallback=executed.used_fallback,
            )
        except (InvalidAIOutputError, *_RETRYABLE):
            if self._fallback is not None and not executed.used_fallback:
                result = await self._fallback.complete(request)
                parsed = parse(parse_json_object(result.content))
                return parsed, ExecutedCompletion(
                    result=result,
                    retry_count=executed.retry_count + 1,
                    used_fallback=True,
                )
            raise
