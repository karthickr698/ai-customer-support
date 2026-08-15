from dataclasses import dataclass
import logging

from app.domain.errors import InvalidOrchestrationInputError
from app.domain.onboarding import require_tenant_id
from app.domain.orchestration import (
    GuardrailVerdict,
    IntentDetection,
    ORCHESTRATION_SCHEMA_VERSION,
    SupportChatMessage,
)
from app.guardrails.input import screen_input
from app.orchestration.intents import detect_intent


@dataclass(frozen=True, slots=True)
class DetectIntentCommand:
    tenant_id: str
    correlation_id: str
    visitor_message: str
    history: tuple[SupportChatMessage, ...] = ()
    escalate_when: tuple[str, ...] = ()
    forbidden_topics: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class DetectIntentResult:
    detection: IntentDetection
    input_guardrail: GuardrailVerdict

    def to_dict(self) -> dict[str, object]:
        return {
            "schemaVersion": ORCHESTRATION_SCHEMA_VERSION,
            **self.detection.to_dict(),
            "guardrails": {"input": self.input_guardrail},
        }


class DetectIntentUseCase:
    def __init__(self, logger: logging.Logger) -> None:
        self._logger = logger

    async def execute(self, command: DetectIntentCommand) -> DetectIntentResult:
        tenant_id = require_tenant_id(command.tenant_id)
        if not command.visitor_message.strip():
            raise InvalidOrchestrationInputError("Visitor message is required")
        screened = screen_input(command.visitor_message, forbidden_topics=command.forbidden_topics)
        if screened.verdict == "blocked" and screened.reason == "empty":
            raise InvalidOrchestrationInputError("Visitor message is required")
        message = screened.message or command.visitor_message
        detection = detect_intent(
            message,
            escalate_when=command.escalate_when,
            forbidden_topics=command.forbidden_topics,
        )
        if screened.should_escalate and not detection.should_escalate:
            detection = IntentDetection(
                intent="escalation",
                confidence=max(detection.confidence, 0.9),
                should_escalate=True,
                reasons=(*detection.reasons, screened.reason or "guardrail"),
            )
        self._logger.info(
            "Support intent detected",
            extra={
                "tenantId": tenant_id,
                "intent": detection.intent,
                "confidence": detection.confidence,
                "inputGuardrail": screened.verdict,
                "correlationId": command.correlation_id,
            },
        )
        return DetectIntentResult(detection=detection, input_guardrail=screened.verdict)
