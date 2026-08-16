from __future__ import annotations

from dataclasses import dataclass
import logging
import time

from app.application.ports.llm_port import LLMCompletionRequest, LLMMessage
from app.application.use_cases.retrieve_knowledge_use_case import (
    RetrieveKnowledgeCommand,
    RetrieveKnowledgeUseCase,
)
from app.domain.onboarding import require_tenant_id
from app.domain.retrieval import (
    Citation,
    RagPlaygroundSource,
    RetrievalFilter,
    RetrievedChunk,
    normalize_retrieval_filter,
)
from app.guardrails.support_reply import sanitize_support_reply
from app.orchestration.executor import CompletionExecutor
from app.prompts.support_reply import support_reply_system_prompt
from app.rag.citations import sources_from_chunks

RAG_PLAYGROUND_SCHEMA_VERSION = 1


@dataclass(frozen=True, slots=True)
class RunRagPlaygroundCommand:
    tenant_id: str
    correlation_id: str
    query: str
    top_k: int | None = None
    filters: RetrievalFilter | None = None
    document_id: str | None = None
    generate: bool = True


@dataclass(frozen=True, slots=True)
class RagPlaygroundGeneration:
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


@dataclass(frozen=True, slots=True)
class RagPlaygroundResult:
    query: str
    top_k: int
    generate: bool
    latency_ms: int
    retrieve_ms: int
    generate_ms: int | None
    filters: RetrievalFilter
    chunks: tuple[RetrievedChunk, ...]
    sources: tuple[RagPlaygroundSource, ...]
    citations: tuple[Citation, ...]
    generation: RagPlaygroundGeneration | None

    def to_dict(self) -> dict[str, object]:
        return {
            "schemaVersion": RAG_PLAYGROUND_SCHEMA_VERSION,
            "query": self.query,
            "topK": self.top_k,
            "generate": self.generate,
            "latencyMs": self.latency_ms,
            "retrieveMs": self.retrieve_ms,
            "generateMs": self.generate_ms,
            "filters": self.filters.to_dict(),
            "chunks": [chunk.to_dict() for chunk in self.chunks],
            "sources": [source.to_dict() for source in self.sources],
            "citations": [citation.to_dict() for citation in self.citations],
            "generation": None if self.generation is None else self.generation.to_dict(),
        }


class RunRagPlaygroundUseCase:
    def __init__(
        self,
        retrieve: RetrieveKnowledgeUseCase,
        executor: CompletionExecutor,
        logger: logging.Logger,
        model: str,
    ) -> None:
        self._retrieve = retrieve
        self._executor = executor
        self._logger = logger
        self._model = model

    async def execute(self, command: RunRagPlaygroundCommand) -> RagPlaygroundResult:
        started = time.perf_counter()
        tenant_id = require_tenant_id(command.tenant_id)
        query = command.query.strip()
        filters = normalize_retrieval_filter(
            document_ids=command.filters.document_ids if command.filters else (),
            kinds=command.filters.kinds if command.filters else (),
            source_uri=command.filters.source_uri if command.filters else None,
            title_contains=command.filters.title_contains if command.filters else None,
            document_id=command.document_id,
        )
        retrieve_started = time.perf_counter()
        retrieved = await self._retrieve.execute(
            RetrieveKnowledgeCommand(
                tenant_id=tenant_id,
                correlation_id=command.correlation_id,
                query=query,
                top_k=command.top_k,
                filters=filters,
                document_id=command.document_id,
            )
        )
        retrieve_ms = int((time.perf_counter() - retrieve_started) * 1000)
        generation: RagPlaygroundGeneration | None = None
        generate_ms: int | None = None
        if command.generate:
            generate_started = time.perf_counter()
            generation = await self._generate(command, tenant_id, query, retrieved.context)
            generate_ms = int((time.perf_counter() - generate_started) * 1000)
        latency_ms = int((time.perf_counter() - started) * 1000)
        self._logger.info(
            "RAG playground ran",
            extra={
                "tenantId": tenant_id,
                "topK": retrieved.top_k,
                "hitCount": len(retrieved.chunks),
                "generate": command.generate,
                "latencyMs": latency_ms,
                "retrieveMs": retrieve_ms,
                "generateMs": generate_ms,
                "correlationId": command.correlation_id,
            },
        )
        return RagPlaygroundResult(
            query=retrieved.query,
            top_k=retrieved.top_k,
            generate=command.generate,
            latency_ms=latency_ms,
            retrieve_ms=retrieve_ms,
            generate_ms=generate_ms,
            filters=filters,
            chunks=retrieved.chunks,
            sources=sources_from_chunks(retrieved.chunks),
            citations=retrieved.citations,
            generation=generation,
        )

    async def _generate(
        self,
        command: RunRagPlaygroundCommand,
        tenant_id: str,
        query: str,
        knowledge_context: str,
    ) -> RagPlaygroundGeneration:
        system = support_reply_system_prompt(
            assistant_name="Support assistant",
            greeting="Hi — how can I help?",
            instructions="Be helpful, accurate, and concise. This is an admin playground query.",
            language="English",
            allowed_topics=(),
            forbidden_topics=(),
            escalate_when=(),
            knowledge_context=knowledge_context,
        )
        executed = await self._executor.complete(
            LLMCompletionRequest(
                messages=(
                    LLMMessage(role="system", content=system),
                    LLMMessage(role="user", content=query),
                ),
                correlation_id=command.correlation_id,
                tenant_id=tenant_id,
                temperature=0.2,
                model=self._model,
            )
        )
        return RagPlaygroundGeneration(
            content=sanitize_support_reply(executed.result.content),
            model=executed.result.model,
            prompt_tokens=executed.result.prompt_tokens,
            completion_tokens=executed.result.completion_tokens,
        )
