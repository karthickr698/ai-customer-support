"""Support-turn orchestration types. No FastAPI or provider SDKs."""

from dataclasses import dataclass
from typing import Literal, Mapping

from app.domain.errors import InvalidAIOutputError
from app.domain.retrieval import Citation

SupportIntent = Literal[
    "greeting",
    "smalltalk",
    "question",
    "account_help",
    "order_status",
    "complaint",
    "escalation",
    "unknown",
]
ModelRouteName = Literal["fast", "quality", "structured"]
GuardrailVerdict = Literal["passed", "blocked", "sanitized"]

SUPPORT_INTENTS: tuple[SupportIntent, ...] = (
    "greeting",
    "smalltalk",
    "question",
    "account_help",
    "order_status",
    "complaint",
    "escalation",
    "unknown",
)
MODEL_ROUTE_NAMES: tuple[ModelRouteName, ...] = ("fast", "quality", "structured")
ORCHESTRATION_SCHEMA_VERSION = 1


@dataclass(frozen=True, slots=True)
class SupportChatMessage:
    role: str
    content: str
SAFE_FALLBACK_REPLY = (
    "I'm having trouble answering right now. I can connect you with a teammate who can help."
)
BLOCKED_INPUT_REPLY = (
    "I can't help with that request. I can connect you with a teammate who can assist."
)


@dataclass(frozen=True, slots=True)
class IntentDetection:
    intent: SupportIntent
    confidence: float
    should_escalate: bool
    reasons: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, object]:
        return {
            "intent": self.intent,
            "confidence": self.confidence,
            "shouldEscalate": self.should_escalate,
            "reasons": list(self.reasons),
        }


@dataclass(frozen=True, slots=True)
class ModelRoute:
    name: ModelRouteName
    model: str
    temperature: float
    retrieve: bool
    json_mode: bool = False


@dataclass(frozen=True, slots=True)
class InputGuardrailResult:
    verdict: GuardrailVerdict
    message: str
    should_escalate: bool
    reason: str | None = None


@dataclass(frozen=True, slots=True)
class OutputGuardrailResult:
    verdict: GuardrailVerdict
    content: str
    should_escalate: bool
    reason: str | None = None


@dataclass(frozen=True, slots=True)
class OrchestratedTurnPayload:
    reply: str
    should_escalate: bool
    escalation_reason: str | None
    confidence: float


@dataclass(frozen=True, slots=True)
class OrchestrationResult:
    intent: SupportIntent
    intent_confidence: float
    route: ModelRouteName
    model: str
    reply: str
    should_escalate: bool
    escalation_reason: str | None
    used_fallback: bool
    retry_count: int
    prompt_tokens: int
    completion_tokens: int
    citations: tuple[Citation, ...]
    input_guardrail: GuardrailVerdict
    output_guardrail: GuardrailVerdict

    def to_dict(self) -> dict[str, object]:
        return {
            "schemaVersion": ORCHESTRATION_SCHEMA_VERSION,
            "intent": self.intent,
            "intentConfidence": self.intent_confidence,
            "route": self.route,
            "model": self.model,
            "reply": self.reply,
            "shouldEscalate": self.should_escalate,
            "escalationReason": self.escalation_reason,
            "usedFallback": self.used_fallback,
            "retryCount": self.retry_count,
            "promptTokens": self.prompt_tokens,
            "completionTokens": self.completion_tokens,
            "citations": [citation.to_dict() for citation in self.citations],
            "guardrails": {
                "input": self.input_guardrail,
                "output": self.output_guardrail,
            },
        }


def parse_orchestrated_turn(raw: Mapping[str, object]) -> OrchestratedTurnPayload:
    reply = str(raw.get("reply") or "").strip()
    if not reply:
        raise InvalidAIOutputError("Orchestrated reply was empty")
    reason = raw.get("escalationReason")
    escalation_reason = str(reason).strip() if isinstance(reason, str) and reason.strip() else None
    confidence_raw = raw.get("confidence")
    try:
        confidence = float(confidence_raw) if confidence_raw is not None else 0.0
    except (TypeError, ValueError) as exc:
        raise InvalidAIOutputError("Orchestrated confidence was invalid") from exc
    return OrchestratedTurnPayload(
        reply=reply,
        should_escalate=bool(raw.get("shouldEscalate")),
        escalation_reason=escalation_reason,
        confidence=max(0.0, min(confidence, 1.0)),
    )


def fallback_turn(*, reason: str) -> OrchestratedTurnPayload:
    return OrchestratedTurnPayload(
        reply=SAFE_FALLBACK_REPLY,
        should_escalate=True,
        escalation_reason=reason,
        confidence=0.0,
    )


def blocked_turn(*, reason: str) -> OrchestratedTurnPayload:
    return OrchestratedTurnPayload(
        reply=BLOCKED_INPUT_REPLY,
        should_escalate=True,
        escalation_reason=reason,
        confidence=1.0,
    )
