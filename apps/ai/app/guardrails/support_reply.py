from app.domain.errors import InvalidAIOutputError

_MAX_REPLY_CHARS = 4000


def sanitize_support_reply(content: str) -> str:
    text = content.strip()
    if not text:
        raise InvalidAIOutputError("The support reply was empty")
    if text.startswith("```"):
        text = text.strip("`").strip()
    if len(text) > _MAX_REPLY_CHARS:
        text = text[: _MAX_REPLY_CHARS - 1].rstrip() + "…"
    return text
