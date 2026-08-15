from collections.abc import AsyncIterator
import json
import logging
from typing import Any

import httpx

from app.application.ports.llm_port import (
    LLMCompletionRequest,
    LLMCompletionResult,
    LLMPort,
    LLMStreamChunk,
)
from app.domain.errors import AIProviderError, ConfigurationError, RateLimitExceededError

_TIMEOUT_SECONDS = 45.0


class OpenAILLMAdapter(LLMPort):
    """OpenAI-compatible Chat Completions client. Uses HTTP only — no vendor SDK."""

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        base_url: str,
        logger: logging.Logger,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        if not api_key.strip():
            raise ConfigurationError("LLM_API_KEY is required for the OpenAI adapter")
        self._api_key = api_key
        self._model = model
        self._base_url = base_url.rstrip("/")
        self._logger = logger
        self._client = client

    def _model_id(self, request: LLMCompletionRequest) -> str:
        return (request.model or self._model).strip() or self._model

    async def complete(self, request: LLMCompletionRequest) -> LLMCompletionResult:
        model = self._model_id(request)
        payload: dict[str, Any] = {
            "model": model,
            "messages": [{"role": message.role, "content": message.content} for message in request.messages],
            "temperature": request.temperature,
        }
        if request.json_mode:
            payload["response_format"] = {"type": "json_object"}

        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
            "x-correlation-id": request.correlation_id,
        }

        client = self._client or httpx.AsyncClient(timeout=_TIMEOUT_SECONDS)
        owns_client = self._client is None
        try:
            response = await client.post(
                f"{self._base_url}/chat/completions",
                headers=headers,
                json=payload,
            )
        except httpx.TimeoutException as exc:
            raise AIProviderError("The language model timed out") from exc
        except httpx.HTTPError as exc:
            raise AIProviderError("The language model is unavailable") from exc
        finally:
            if owns_client:
                await client.aclose()

        if response.status_code == 429:
            raise RateLimitExceededError("Language model rate limit exceeded")
        if response.status_code >= 400:
            self._logger.warning(
                "LLM provider returned an error",
                extra={
                    "tenantId": request.tenant_id,
                    "statusCode": response.status_code,
                    "model": model,
                },
            )
            raise AIProviderError("The language model failed to complete the request")

        try:
            body = response.json()
        except json.JSONDecodeError as exc:
            raise AIProviderError("The language model returned a malformed response") from exc

        try:
            choice = body["choices"][0]["message"]["content"]
            usage = body.get("usage") or {}
            model = body.get("model") or model
        except (KeyError, IndexError, TypeError) as exc:
            raise AIProviderError("The language model returned an unexpected payload") from exc

        if not isinstance(choice, str) or not choice.strip():
            raise AIProviderError("The language model returned an empty completion")

        return LLMCompletionResult(
            content=choice,
            model=str(model),
            prompt_tokens=int(usage.get("prompt_tokens") or 0),
            completion_tokens=int(usage.get("completion_tokens") or 0),
        )

    async def stream(self, request: LLMCompletionRequest) -> AsyncIterator[LLMStreamChunk]:
        model = self._model_id(request)
        payload: dict[str, Any] = {
            "model": model,
            "messages": [{"role": message.role, "content": message.content} for message in request.messages],
            "temperature": request.temperature,
            "stream": True,
            "stream_options": {"include_usage": True},
        }
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
            "x-correlation-id": request.correlation_id,
        }
        client = self._client or httpx.AsyncClient(timeout=_TIMEOUT_SECONDS)
        owns_client = self._client is None
        assembled: list[str] = []
        prompt_tokens = 0
        completion_tokens = 0
        try:
            async with client.stream(
                "POST",
                f"{self._base_url}/chat/completions",
                headers=headers,
                json=payload,
            ) as response:
                if response.status_code == 429:
                    raise RateLimitExceededError("Language model rate limit exceeded")
                if response.status_code >= 400:
                    raise AIProviderError("The language model failed to complete the request")
                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        body = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    usage = body.get("usage") or {}
                    if usage:
                        prompt_tokens = int(usage.get("prompt_tokens") or prompt_tokens)
                        completion_tokens = int(usage.get("completion_tokens") or completion_tokens)
                    if body.get("model"):
                        model = str(body["model"])
                    choices = body.get("choices") or []
                    if not choices:
                        continue
                    delta = (choices[0].get("delta") or {}).get("content")
                    if isinstance(delta, str) and delta:
                        assembled.append(delta)
                        yield LLMStreamChunk(delta=delta)
        except httpx.TimeoutException as exc:
            raise AIProviderError("The language model timed out") from exc
        except httpx.HTTPError as exc:
            raise AIProviderError("The language model is unavailable") from exc
        finally:
            if owns_client:
                await client.aclose()

        content = "".join(assembled).strip()
        if not content:
            raise AIProviderError("The language model returned an empty completion")
        result = LLMCompletionResult(
            content=content,
            model=str(model),
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
        )
        yield LLMStreamChunk(delta="", done=True, result=result)
