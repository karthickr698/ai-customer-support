from collections.abc import AsyncIterator
from dataclasses import dataclass
import logging

from app.application.ports.llm_port import (
    LLMCompletionRequest,
    LLMCompletionResult,
    LLMPort,
)
from app.application.use_cases.retrieve_knowledge_use_case import (
    RetrieveKnowledgeCommand,
    RetrieveKnowledgeUseCase,
    RetrievalResult,
)
from app.domain.errors import AIError, InvalidAIOutputError, TenantContextRequiredError
from app.evaluation import record_evaluation, score_evaluation
from app.domain.onboarding import require_tenant_id
from app.domain.orchestration import BLOCKED_INPUT_REPLY, SupportChatMessage
from app.domain.retrieval import Citation, RetrievalFilter
from app.guardrails.input import screen_input
from app.guardrails.support_reply import sanitize_support_reply
from app.orchestration.context import assemble_support_messages
from app.orchestration.executor import CompletionExecutor
from app.orchestration.intents import detect_intent
from app.orchestration.routing import route_support_turn
from app.orchestration.templates import render_support_system_prompt


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
    top_k: int | None = None
    retrieval_filters: RetrievalFilter | None = None


@dataclass(frozen=True, slots=True)
class SupportReplyStreamChunk:
    delta: str
    done: bool = False
    result: LLMCompletionResult | None = None
    citations: tuple[Citation, ...] = ()


@dataclass(frozen=True, slots=True)
class SupportReplyResult:
    content: str
    model: str
    prompt_tokens: int
    completion_tokens: int
    citations: tuple[Citation, ...] = ()

    def to_dict(self) -> dict[str, object]:
        return {
            "content": self.content,
            "model": self.model,
            "promptTokens": self.prompt_tokens,
            "completionTokens": self.completion_tokens,
            "citations": [citation.to_dict() for citation in self.citations],
        }


class GenerateSupportReplyUseCase:
    def __init__(
        self,
        llm: LLMPort,
        logger: logging.Logger,
        retrieve: RetrieveKnowledgeUseCase | None = None,
        executor: CompletionExecutor | None = None,
        fast_model: str = "gpt-4o-mini",
        quality_model: str = "gpt-4o",
    ) -> None:
        self._llm = llm
        self._logger = logger
        self._retrieve = retrieve
        self._executor = executor or CompletionExecutor(llm, None, 1, logger)
        self._fast_model = fast_model
        self._quality_model = quality_model

    async def stream(self, command: GenerateSupportReplyCommand) -> AsyncIterator[SupportReplyStreamChunk]:
        tenant_id = require_tenant_id(command.tenant_id)
        if not command.visitor_message.strip():
            raise InvalidAIOutputError("Visitor message is required")
        screened = screen_input(command.visitor_message, forbidden_topics=command.forbidden_topics)
        if screened.verdict == "blocked":
            async for chunk in self._blocked_stream(screened.reason or "guardrail"):
                yield chunk
            return

        visitor_message = screened.message
        detection = detect_intent(
            visitor_message,
            escalate_when=command.escalate_when,
            forbidden_topics=command.forbidden_topics,
        )
        route = route_support_turn(
            detection.intent,
            message=visitor_message,
            fast_model=self._fast_model,
            quality_model=self._quality_model,
            json_mode=False,
        )
        retrieved = await self._retrieve_knowledge(command, tenant_id, visitor_message, route.retrieve)
        system = render_support_system_prompt(
            intent=detection.intent,
            json_mode=False,
            assistant_name=command.assistant_name,
            greeting=command.widget_greeting or command.greeting,
            instructions=command.system_instructions,
            language=command.language,
            allowed_topics=command.allowed_topics,
            forbidden_topics=command.forbidden_topics,
            escalate_when=command.escalate_when,
            knowledge_context=retrieved.context,
        )
        request = LLMCompletionRequest(
            messages=assemble_support_messages(
                system_prompt=system,
                history=command.history,
                visitor_message=visitor_message,
            ),
            correlation_id=command.correlation_id,
            tenant_id=tenant_id,
            temperature=route.temperature,
            model=route.model,
        )
        async for chunk in self._stream(request, tenant_id, command.conversation_id, retrieved.citations):
            yield chunk

    async def _retrieve_knowledge(
        self,
        command: GenerateSupportReplyCommand,
        tenant_id: str,
        query: str,
        retrieve: bool,
    ) -> RetrievalResult:
        if not retrieve or self._retrieve is None:
            return RetrievalResult.empty(query)
        try:
            return await self._retrieve.execute(
                RetrieveKnowledgeCommand(
                    tenant_id=tenant_id,
                    correlation_id=command.correlation_id,
                    query=query,
                    top_k=command.top_k,
                    filters=command.retrieval_filters,
                )
            )
        except TenantContextRequiredError:
            raise
        except AIError as exc:
            self._logger.warning(
                "Knowledge retrieval failed; generating without citations",
                extra={
                    "tenantId": tenant_id,
                    "conversationId": command.conversation_id,
                    "code": exc.code,
                    "correlationId": command.correlation_id,
                },
            )
            return RetrievalResult.empty(query, command.top_k or 0)

    async def _stream(
        self,
        request: LLMCompletionRequest,
        tenant_id: str,
        conversation_id: str,
        citations: tuple[Citation, ...],
    ) -> AsyncIterator[SupportReplyStreamChunk]:
        assembled: list[str] = []
        async for chunk in self._executor.stream(request):
            if chunk.delta:
                assembled.append(chunk.delta)
                yield SupportReplyStreamChunk(delta=chunk.delta)
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
                        "citationCount": len(citations),
                    },
                )
                record_evaluation(
                    score_evaluation(
                        operation="generate_support_reply",
                        prompt_tokens=chunk.result.prompt_tokens,
                        completion_tokens=chunk.result.completion_tokens,
                        citation_count=len(citations),
                        model=chunk.result.model,
                    )
                )
                yield SupportReplyStreamChunk(
                    delta="",
                    done=True,
                    result=LLMCompletionResult(
                        content=content,
                        model=chunk.result.model,
                        prompt_tokens=chunk.result.prompt_tokens,
                        completion_tokens=chunk.result.completion_tokens,
                    ),
                    citations=citations,
                )

    async def _blocked_stream(self, reason: str) -> AsyncIterator[SupportReplyStreamChunk]:
        del reason
        record_evaluation(
            score_evaluation(
                operation="generate_support_reply",
                input_guardrail="blocked",
                model="guardrail",
            )
        )
        yield SupportReplyStreamChunk(delta=BLOCKED_INPUT_REPLY)
        yield SupportReplyStreamChunk(
            delta="",
            done=True,
            result=LLMCompletionResult(
                content=BLOCKED_INPUT_REPLY,
                model="guardrail",
                prompt_tokens=0,
                completion_tokens=0,
            ),
        )
