import json
import logging
import re
from datetime import UTC, datetime
from typing import Any

from app.config import Settings
from app.context import get_request_context

_SECRET_KEY_PATTERN = re.compile(
    r"(api[_-]?key|password|secret|token|authorization|jwt)",
    re.IGNORECASE,
)

_STANDARD_RECORD_ATTRS = frozenset(
    {
        "name",
        "msg",
        "args",
        "created",
        "filename",
        "funcName",
        "levelname",
        "levelno",
        "lineno",
        "module",
        "msecs",
        "message",
        "pathname",
        "process",
        "processName",
        "relativeCreated",
        "stack_info",
        "exc_info",
        "exc_text",
        "thread",
        "threadName",
        "taskName",
        "request_id",
        "correlation_id",
        "tenant_id",
    }
)


class RequestContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        context = get_request_context()
        record.request_id = context.request_id if context else "-"
        record.correlation_id = context.correlation_id if context else "-"
        record.tenant_id = context.tenant_id if context and context.tenant_id else "-"
        return True


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname.lower(),
            "message": record.getMessage(),
            "logger": record.name,
            "service": "ai",
        }

        request_id = getattr(record, "request_id", "-")
        correlation_id = getattr(record, "correlation_id", "-")
        tenant_id = getattr(record, "tenant_id", "-")

        if request_id and request_id != "-":
            payload["requestId"] = request_id
        if correlation_id and correlation_id != "-":
            payload["correlationId"] = correlation_id
        if tenant_id and tenant_id != "-":
            payload["tenantId"] = tenant_id

        for key, value in record.__dict__.items():
            if key in _STANDARD_RECORD_ATTRS or key.startswith("_"):
                continue
            payload[key] = "[redacted]" if _SECRET_KEY_PATTERN.search(key) else value

        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)

        return json.dumps(payload, default=str)


class DevelopmentFormatter(logging.Formatter):
    def __init__(self) -> None:
        super().__init__(
            fmt="%(levelname)s %(name)s requestId=%(request_id)s %(message)s",
        )


_configured = False


def configure_logging(settings: Settings) -> None:
    global _configured

    logger = logging.getLogger("ai")
    logger.setLevel(settings.log_level.upper())
    logger.propagate = False

    if _configured:
        return

    handler = logging.StreamHandler()
    handler.addFilter(RequestContextFilter())
    if settings.env == "production":
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(DevelopmentFormatter())

    logger.addHandler(handler)
    _configured = True


def get_logger(name: str) -> logging.Logger:
    if name == "ai" or name.startswith("ai."):
        return logging.getLogger(name)
    return logging.getLogger(f"ai.{name}")
