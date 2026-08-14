import json
import re
from typing import Any

from app.domain.errors import InvalidAIOutputError

_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)


def parse_json_object(content: str) -> dict[str, Any]:
    text = _FENCE.sub("", content.strip()).strip()
    if not text:
        raise InvalidAIOutputError("AI output was empty")

    try:
        parsed: Any = json.loads(text)
    except json.JSONDecodeError as exc:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            try:
                parsed = json.loads(text[start : end + 1])
            except json.JSONDecodeError as inner:
                raise InvalidAIOutputError("AI output was not valid JSON") from inner
        else:
            raise InvalidAIOutputError("AI output was not valid JSON") from exc

    if not isinstance(parsed, dict):
        raise InvalidAIOutputError("AI output must be a JSON object")
    return parsed
