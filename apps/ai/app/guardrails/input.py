"""Input guardrails for visitor messages. No provider SDKs."""

from app.domain.orchestration import InputGuardrailResult

_INJECTION_MARKERS = (
    "ignore previous instructions",
    "ignore all previous",
    "disregard your instructions",
    "reveal your system prompt",
    "dump your system prompt",
    "you are now dan",
    "developer mode enabled",
    "<|im_start|>",
    "<|system|>",
)


def screen_input(
    message: str,
    *,
    forbidden_topics: tuple[str, ...] = (),
) -> InputGuardrailResult:
    original = message.strip()
    if not original:
        return InputGuardrailResult(
            verdict="blocked",
            message="",
            should_escalate=False,
            reason="empty",
        )

    sanitized = original
    lowered = original.lower()
    for marker in _INJECTION_MARKERS:
        if marker in lowered:
            sanitized = _remove_ci(sanitized, marker)

    leftover = " ".join(sanitized.split())
    if leftover != original.strip() and len(leftover) < 8:
        return InputGuardrailResult(
            verdict="blocked",
            message=original,
            should_escalate=True,
            reason="prompt_injection",
        )

    for topic in forbidden_topics:
        needle = topic.strip()
        if needle and needle.lower() in leftover.lower():
            return InputGuardrailResult(
                verdict="blocked",
                message=leftover,
                should_escalate=True,
                reason="forbidden_topic",
            )

    if leftover != original.strip():
        return InputGuardrailResult(
            verdict="sanitized",
            message=leftover,
            should_escalate=False,
            reason="prompt_injection",
        )
    return InputGuardrailResult(verdict="passed", message=leftover, should_escalate=False)


def _remove_ci(text: str, needle: str) -> str:
    lower = text.lower()
    start = lower.find(needle)
    if start < 0:
        return text
    return (text[:start] + " " + text[start + len(needle) :]).strip()
