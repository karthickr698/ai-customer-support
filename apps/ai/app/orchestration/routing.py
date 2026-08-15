"""Model routing for support turns. No provider SDKs."""

from app.domain.orchestration import ModelRoute, SupportIntent

_RETRIEVE_INTENTS = frozenset(
    {"question", "account_help", "order_status", "complaint", "unknown"}
)
_QUALITY_INTENTS = frozenset({"complaint", "unknown"})
_LONG_MESSAGE_CHARS = 800


def route_support_turn(
    intent: SupportIntent,
    *,
    message: str,
    fast_model: str,
    quality_model: str,
    json_mode: bool = False,
) -> ModelRoute:
    retrieve = intent in _RETRIEVE_INTENTS
    use_quality = intent in _QUALITY_INTENTS or len(message.strip()) >= _LONG_MESSAGE_CHARS
    if json_mode:
        name = "structured"
        model = quality_model if use_quality else fast_model
        temperature = 0.0
    elif use_quality:
        name = "quality"
        model = quality_model
        temperature = 0.2
    else:
        name = "fast"
        model = fast_model
        temperature = 0.1 if intent == "escalation" else 0.3 if intent != "greeting" else 0.4
        retrieve = retrieve and intent != "greeting" and intent != "smalltalk"
    if intent in {"greeting", "smalltalk", "escalation"}:
        retrieve = False
    return ModelRoute(
        name=name,
        model=model.strip() or fast_model,
        temperature=temperature,
        retrieve=retrieve,
        json_mode=json_mode,
    )
