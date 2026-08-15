"""Output guardrails for orchestrated replies. No provider SDKs."""

from app.domain.errors import InvalidAIOutputError
from app.domain.orchestration import OutputGuardrailResult
from app.guardrails.support_reply import sanitize_support_reply

_LEAK_MARKERS = (
    "system prompt",
    "ignore previous instructions",
    "<|im_start|>",
)


def screen_output(
    content: str,
    *,
    forbidden_topics: tuple[str, ...] = (),
) -> OutputGuardrailResult:
    try:
        text = sanitize_support_reply(content)
    except InvalidAIOutputError:
        return OutputGuardrailResult(
            verdict="blocked",
            content="",
            should_escalate=True,
            reason="empty_or_invalid",
        )

    lowered = text.lower()
    if any(marker in lowered for marker in _LEAK_MARKERS):
        return OutputGuardrailResult(
            verdict="blocked",
            content="",
            should_escalate=True,
            reason="prompt_leak",
        )
    for topic in forbidden_topics:
        needle = topic.strip()
        if needle and needle.lower() in lowered:
            return OutputGuardrailResult(
                verdict="sanitized",
                content=text,
                should_escalate=True,
                reason="forbidden_topic",
            )
    verdict = "sanitized" if text != content.strip() else "passed"
    return OutputGuardrailResult(verdict=verdict, content=text, should_escalate=False)
