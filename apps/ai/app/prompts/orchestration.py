"""Orchestration prompt templates. No provider SDKs."""

from app.domain.orchestration import SupportIntent
from app.prompts.support_reply import support_reply_system_prompt

TASK_DETECT_INTENT = "detect_intent"
TASK_ORCHESTRATE_TURN = "orchestrate_turn"

INTENT_GUIDANCE: dict[SupportIntent, str] = {
    "greeting": "Greet briefly and invite the customer's question.",
    "smalltalk": "Respond briefly and warmly, then offer to help with a support question.",
    "question": "Answer from knowledge excerpts. If they are insufficient, say you are unsure.",
    "account_help": "Give account-safe steps only. Never invent passwords, codes, or private data.",
    "order_status": "Explain how to check an order. Do not invent tracking numbers or balances.",
    "complaint": "Acknowledge frustration first, then solve or hand off.",
    "escalation": "Offer a human handoff immediately. Do not over-promise.",
    "unknown": "Ask one clarifying question, or hand off if the request is unsafe.",
}

_JSON_ONLY = (
    "Respond with a single JSON object. Keys: reply (string), shouldEscalate (boolean), "
    "escalationReason (string|null), confidence (number 0-1). "
    "Do not include markdown or commentary."
)


def orchestrate_turn_system_prompt(
    *,
    intent: SupportIntent,
    assistant_name: str,
    greeting: str,
    instructions: str,
    language: str,
    allowed_topics: tuple[str, ...],
    forbidden_topics: tuple[str, ...],
    escalate_when: tuple[str, ...],
    knowledge_context: str,
) -> str:
    base = support_reply_system_prompt(
        assistant_name=assistant_name,
        greeting=greeting,
        instructions=instructions,
        language=language,
        allowed_topics=allowed_topics,
        forbidden_topics=forbidden_topics,
        escalate_when=escalate_when,
        knowledge_context=knowledge_context,
    )
    return (
        f"{base} TASK={TASK_ORCHESTRATE_TURN}. Detected intent={intent}. "
        f"{INTENT_GUIDANCE[intent]} {_JSON_ONLY}"
    )


def detect_intent_system_prompt() -> str:
    return (
        "You classify a customer-support message. "
        f"TASK={TASK_DETECT_INTENT}. "
        "JSON keys: intent (greeting|smalltalk|question|account_help|order_status|complaint|escalation|unknown), "
        "confidence (number 0-1), shouldEscalate (boolean). "
        f"{_JSON_ONLY}"
    )
