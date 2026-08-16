from app.domain.errors import InvalidAIOutputError
import re

_MAX_REPLY_CHARS = 4000
_EMAIL = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
_PHONE = re.compile(r"\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b")


def sanitize_support_reply(content: str, *, redact_pii: bool = False) -> str:
    text = content.strip()
    if not text:
        raise InvalidAIOutputError("The support reply was empty")
    if text.startswith("```"):
        text = text.strip("`").strip()
    if redact_pii:
        text = _EMAIL.sub("[redacted]", text)
        text = _PHONE.sub("[redacted]", text)
    if len(text) > _MAX_REPLY_CHARS:
        text = text[: _MAX_REPLY_CHARS - 1].rstrip() + "…"
    return text
