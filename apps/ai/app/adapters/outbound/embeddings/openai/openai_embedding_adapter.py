import logging
from typing import Any

import httpx

from app.application.ports.embedding_port import EmbeddingPort, EmbeddingRequest, EmbeddingResult
from app.domain.errors import AIProviderError, ConfigurationError, RateLimitExceededError

_TIMEOUT_SECONDS = 45.0
_BATCH_SIZE = 16


class OpenAIEmbeddingAdapter(EmbeddingPort):
    """OpenAI-compatible embeddings client. Uses HTTP only — no vendor SDK."""

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
            raise ConfigurationError("EMBEDDING_API_KEY is required for the OpenAI embedding adapter")
        self._api_key = api_key
        self._model = model
        self._base_url = base_url.rstrip("/")
        self._logger = logger
        self._client = client

    async def embed(self, request: EmbeddingRequest) -> EmbeddingResult:
        if not request.tenant_id.strip():
            raise ValueError("tenant_id is required")
        if not request.texts:
            return EmbeddingResult(vectors=(), model=self._model, dimensions=0, token_count=0)

        vectors: list[tuple[float, ...]] = []
        token_count = 0
        dimensions = 0
        for start in range(0, len(request.texts), _BATCH_SIZE):
            batch = request.texts[start : start + _BATCH_SIZE]
            payload = await self._embed_batch(batch, request.tenant_id)
            batch_vectors = payload["vectors"]
            if batch_vectors and dimensions == 0:
                dimensions = len(batch_vectors[0])
            vectors.extend(batch_vectors)
            token_count += payload["token_count"]

        return EmbeddingResult(
            vectors=tuple(vectors),
            model=self._model,
            dimensions=dimensions,
            token_count=token_count,
        )

    async def _embed_batch(self, texts: tuple[str, ...] | list[str], tenant_id: str) -> dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        client = self._client or httpx.AsyncClient(timeout=_TIMEOUT_SECONDS)
        owns_client = self._client is None
        try:
            response = await client.post(
                f"{self._base_url}/embeddings",
                headers=headers,
                json={"model": self._model, "input": list(texts)},
            )
        except httpx.TimeoutException as exc:
            raise AIProviderError("The embedding model timed out") from exc
        except httpx.HTTPError as exc:
            raise AIProviderError("The embedding model is unavailable") from exc
        finally:
            if owns_client:
                await client.aclose()

        if response.status_code == 429:
            raise RateLimitExceededError("Embedding model rate limit exceeded")
        if response.status_code >= 400:
            self._logger.warning(
                "Embedding provider returned an error",
                extra={"tenantId": tenant_id, "statusCode": response.status_code, "model": self._model},
            )
            raise AIProviderError("The embedding model failed")

        try:
            body = response.json()
        except ValueError as exc:
            raise AIProviderError("The embedding model returned a malformed response") from exc

        items = body.get("data") if isinstance(body, dict) else None
        if not isinstance(items, list) or len(items) != len(texts):
            raise AIProviderError("The embedding model returned an unexpected payload")

        ordered = sorted(items, key=lambda item: item.get("index", 0) if isinstance(item, dict) else 0)
        vectors: list[tuple[float, ...]] = []
        for item in ordered:
            if not isinstance(item, dict) or not isinstance(item.get("embedding"), list):
                raise AIProviderError("The embedding model returned an unexpected payload")
            vectors.append(tuple(float(value) for value in item["embedding"]))

        usage = body.get("usage") if isinstance(body, dict) else None
        token_count = 0
        if isinstance(usage, dict) and isinstance(usage.get("total_tokens"), int):
            token_count = usage["total_tokens"]

        return {"vectors": vectors, "token_count": token_count}
