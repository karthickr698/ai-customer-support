"""Heuristic intent detection for a support turn. No provider SDKs."""

import re

from app.domain.orchestration import IntentDetection, SupportIntent

_WORD = re.compile(r"[a-z0-9']+")

_INTENT_PHRASES: tuple[tuple[SupportIntent, float, tuple[str, ...]], ...] = (
    (
        "escalation",
        0.92,
        (
            "speak to a human",
            "talk to a human",
            "talk to a person",
            "real person",
            "human agent",
            "human please",
            "supervisor",
            "manager please",
            "handoff",
            "hand off",
            "escalate",
        ),
    ),
    (
        "complaint",
        0.88,
        (
            "unacceptable",
            "terrible service",
            "worst experience",
            "i am furious",
            "i'm furious",
            "this is ridiculous",
            "file a complaint",
            "lawsuit",
        ),
    ),
    (
        "order_status",
        0.86,
        (
            "order status",
            "where is my order",
            "where's my order",
            "tracking number",
            "shipment",
            "package",
            "delivery status",
        ),
    ),
    (
        "account_help",
        0.86,
        (
            "reset my password",
            "forgot password",
            "cannot log in",
            "can't log in",
            "account locked",
            "sign in",
            "two factor",
            "2fa",
        ),
    ),
    (
        "greeting",
        0.8,
        ("hello", "hi", "hey", "good morning", "good afternoon", "good evening"),
    ),
    (
        "smalltalk",
        0.78,
        ("how are you", "thanks", "thank you", "bye", "goodbye", "that's all"),
    ),
)

_QUESTION_PREFIXES = ("how ", "what ", "when ", "where ", "why ", "can ", "do ", "does ", "is ")


def detect_intent(
    message: str,
    *,
    escalate_when: tuple[str, ...] = (),
    forbidden_topics: tuple[str, ...] = (),
) -> IntentDetection:
    text = " ".join(message.lower().split())
    if not text:
        return IntentDetection(intent="unknown", confidence=0.0, should_escalate=False, reasons=("empty",))

    if _matches_any(text, forbidden_topics):
        return IntentDetection(
            intent="escalation",
            confidence=0.95,
            should_escalate=True,
            reasons=("forbidden_topic",),
        )
    if _matches_any(text, escalate_when):
        return IntentDetection(
            intent="escalation",
            confidence=0.9,
            should_escalate=True,
            reasons=("escalate_when",),
        )

    for intent, confidence, phrases in _INTENT_PHRASES:
        matched = next((phrase for phrase in phrases if phrase in text), None)
        if matched is None:
            continue
        if intent == "greeting" and (len(text) > 48 or "?" in text):
            continue
        if intent == "smalltalk" and len(text) > 80:
            continue
        should_escalate = intent in {"escalation", "complaint"}
        return IntentDetection(
            intent=intent,
            confidence=confidence,
            should_escalate=should_escalate,
            reasons=(matched.replace(" ", "_"),),
        )

    if "?" in text or text.startswith(_QUESTION_PREFIXES):
        return IntentDetection(
            intent="question",
            confidence=0.7,
            should_escalate=False,
            reasons=("question_form",),
        )

    tokens = _WORD.findall(text)
    if len(tokens) <= 4:
        return IntentDetection(intent="unknown", confidence=0.4, should_escalate=False, reasons=("short",))
    return IntentDetection(intent="question", confidence=0.55, should_escalate=False, reasons=("default_question",))


def _matches_any(text: str, topics: tuple[str, ...]) -> bool:
    return any(topic.strip() and topic.strip().lower() in text for topic in topics)
