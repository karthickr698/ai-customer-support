from dataclasses import dataclass
import logging

from app.application.ports.llm_port import LLMCompletionRequest
from app.application.use_cases.retrieve_knowledge_use_case import (
    RetrieveKnowledgeCommand,
    RetrieveKnowledgeUseCase,
    RetrievalResult,
)
from app.domain.agent_configuration import AgentRuntimeConfig, UNKNOWN_REPLY
from app.domain.errors import AIError, InvalidOrchestrationInputError, TenantContextRequiredError
from app.evaluation import record_evaluation, score_evaluation
from app.domain.onboarding import require_tenant_id
from app.domain.orchestration import (
    GuardrailVerdict,
    ModelRouteName,
    OrchestratedTurnPayload,
    OrchestrationResult,
    SupportChatMessage,
    SupportIntent,
    blocked_turn,
    fallback_turn,
    parse_orchestrated_turn,
)
from app.domain.retrieval import RetrievalFilter
from app.guardrails.input import screen_input
from app.guardrails.output import screen_output
from app.orchestration.context import assemble_support_messages
from app.orchestration.executor import CompletionExecutor
from app.orchestration.intents import detect_intent
from app.orchestration.routing import route_support_turn
from app.orchestration.templates import render_support_system_prompt


@dataclass(frozen=True, slots=True)
class OrchestrateSupportTurnCommand:
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
    runtime: AgentRuntimeConfig | None = None


class OrchestrateSupportTurnUseCase:
    def __init__(
        self,
        executor: CompletionExecutor,
        logger: logging.Logger,
        retrieve: RetrieveKnowledgeUseCase | None,
        fast_model: str,
        quality_model: str,
    ) -> None:
        self._executor = executor
        self._logger = logger
        self._retrieve = retrieve
        self._fast_model = fast_model
        self._quality_model = quality_model

    async def execute(self, command: OrchestrateSupportTurnCommand) -> OrchestrationResult:
        tenant_id = require_tenant_id(command.tenant_id)
        if not command.visitor_message.strip():
            raise InvalidOrchestrationInputError("Visitor message is required")

        screened = screen_input(command.visitor_message, forbidden_topics=command.forbidden_topics)
        if screened.verdict == "blocked":
            payload = blocked_turn(reason=screened.reason or "guardrail")
            detection = detect_intent(
                command.visitor_message,
                escalate_when=command.escalate_when,
                forbidden_topics=command.forbidden_topics,
            )
            return self._result(
                command=command,
                intent=detection.intent if detection.should_escalate else "escalation",
                intent_confidence=detection.confidence,
                route_name="fast",
                model="guardrail",
                payload=payload,
                used_fallback=False,
                retry_count=0,
                prompt_tokens=0,
                completion_tokens=0,
                citations=(),
                input_guardrail=screened.verdict,
                output_guardrail="passed",
            )

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
            json_mode=True,
        )
        if command.runtime is not None:
            route = command.runtime.apply_route(route)
        retrieved = await self._retrieve_knowledge(command, tenant_id, visitor_message, route.retrieve)
        if (
            command.runtime is not None
            and command.runtime.citation_policy == "required"
            and command.runtime.refuse_unknown
            and route.retrieve
            and not retrieved.citations
        ):
            payload = OrchestratedTurnPayload(
                reply=UNKNOWN_REPLY,
                should_escalate=True,
                escalation_reason="missing_citations",
                confidence=0.0,
            )
            return self._result(
                command=command,
                intent=detection.intent,
                intent_confidence=detection.confidence,
                route_name=route.name,
                model="policy",
                payload=payload,
                used_fallback=True,
                retry_count=0,
                prompt_tokens=0,
                completion_tokens=0,
                citations=(),
                input_guardrail=screened.verdict,
                output_guardrail="passed",
            )
        instructions = command.system_instructions
        policy = ""
        if command.runtime is not None:
            instructions = command.runtime.merged_instructions(instructions)
            policy = command.runtime.policy_instructions()
        system = render_support_system_prompt(
            intent=detection.intent,
            json_mode=True,
            assistant_name=command.assistant_name,
            greeting=command.widget_greeting or command.greeting,
            instructions=instructions,
            language=command.language,
            allowed_topics=command.allowed_topics,
            forbidden_topics=command.forbidden_topics,
            escalate_when=command.escalate_when,
            knowledge_context=retrieved.context,
            policy_instructions=policy,
        )
        request = LLMCompletionRequest(
            messages=assemble_support_messages(
                system_prompt=system,
                history=command.history,
                visitor_message=visitor_message,
            ),
            correlation_id=command.correlation_id,
            tenant_id=tenant_id,
            json_mode=True,
            temperature=route.temperature,
            model=route.model,
            max_tokens=command.runtime.max_output_tokens if command.runtime else None,
        )
        allow_fallback = command.runtime is None or command.runtime.fallback_mode == "provider_then_heuristic"
        try:
            payload, executed = await self._executor.complete_json(
                request,
                parse_orchestrated_turn,
                max_attempts=command.runtime.fallback_max_retries if command.runtime else None,
                allow_provider_fallback=allow_fallback,
            )
        except AIError as exc:
            self._logger.warning(
                "Orchestration completion failed; using safe fallback",
                extra={
                    "tenantId": tenant_id,
                    "conversationId": command.conversation_id,
                    "code": exc.code,
                    "correlationId": command.correlation_id,
                },
            )
            reply = command.runtime.safe_reply(reason="model_unavailable") if command.runtime else None
            payload = fallback_turn(reason="model_unavailable")
            if reply:
                payload = OrchestratedTurnPayload(
                    reply=reply,
                    should_escalate=True,
                    escalation_reason="model_unavailable",
                    confidence=0.0,
                )
            executed = None

        output = screen_output(
            payload.reply,
            forbidden_topics=command.forbidden_topics,
            redact_pii=command.runtime.redact_pii if command.runtime else False,
        )
        if output.verdict == "blocked":
            payload = fallback_turn(reason=output.reason or "output_guardrail")
            reply = payload.reply
        else:
            reply = output.content
            payload = OrchestratedTurnPayload(
                reply=reply,
                should_escalate=payload.should_escalate or output.should_escalate or detection.should_escalate,
                escalation_reason=payload.escalation_reason or output.reason,
                confidence=payload.confidence,
            )

        result_model = executed.result.model if executed is not None else "fallback"
        self._logger.info(
            "Support turn orchestrated",
            extra={
                "tenantId": tenant_id,
                "conversationId": command.conversation_id,
                "intent": detection.intent,
                "route": route.name,
                "model": result_model,
                "usedFallback": executed.used_fallback if executed is not None else True,
                "retryCount": executed.retry_count if executed is not None else 0,
                "citationCount": len(retrieved.citations),
            },
        )
        return self._result(
            command=command,
            intent=detection.intent,
            intent_confidence=detection.confidence,
            route_name=route.name,
            model=result_model,
            payload=payload,
            used_fallback=executed.used_fallback if executed is not None else True,
            retry_count=executed.retry_count if executed is not None else 0,
            prompt_tokens=executed.result.prompt_tokens if executed is not None else 0,
            completion_tokens=executed.result.completion_tokens if executed is not None else 0,
            citations=retrieved.citations,
            input_guardrail=screened.verdict,
            output_guardrail=output.verdict if output.verdict != "blocked" else "blocked",
        )

    async def _retrieve_knowledge(
        self,
        command: OrchestrateSupportTurnCommand,
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
                "Knowledge retrieval failed; orchestrating without citations",
                extra={
                    "tenantId": tenant_id,
                    "conversationId": command.conversation_id,
                    "code": exc.code,
                    "correlationId": command.correlation_id,
                },
            )
            return RetrievalResult.empty(query, command.top_k or 0)

    def _result(
        self,
        *,
        command: OrchestrateSupportTurnCommand,
        intent: SupportIntent,
        intent_confidence: float,
        route_name: ModelRouteName,
        model: str,
        payload: OrchestratedTurnPayload,
        used_fallback: bool,
        retry_count: int,
        prompt_tokens: int,
        completion_tokens: int,
        citations: tuple,
        input_guardrail: GuardrailVerdict,
        output_guardrail: GuardrailVerdict,
    ) -> OrchestrationResult:
        del command
        result = OrchestrationResult(
            intent=intent,
            intent_confidence=intent_confidence,
            route=route_name,
            model=model,
            reply=payload.reply,
            should_escalate=payload.should_escalate,
            escalation_reason=payload.escalation_reason,
            used_fallback=used_fallback,
            retry_count=retry_count,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            citations=citations,
            input_guardrail=input_guardrail,
            output_guardrail=output_guardrail,
        )
        record_evaluation(
            score_evaluation(
                operation="orchestrate_support_turn",
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                citation_count=len(citations),
                input_guardrail=input_guardrail,
                output_guardrail=output_guardrail,
                used_fallback=used_fallback,
                model=model,
            )
        )
        return result
