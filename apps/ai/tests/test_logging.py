import json
import logging

from app.logging import JsonFormatter, RequestContextFilter


def test_json_formatter_includes_service_and_redacts_secrets() -> None:
    formatter = JsonFormatter()
    record = logging.LogRecord(
        name="ai.http",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="provider call",
        args=(),
        exc_info=None,
    )
    record.request_id = "req-1"
    record.correlation_id = "corr-1"
    record.tenant_id = "tenant-1"
    record.api_key = "sk-secret"
    record.model = "placeholder"

    payload = json.loads(formatter.format(record))

    assert payload["service"] == "ai"
    assert payload["requestId"] == "req-1"
    assert payload["correlationId"] == "corr-1"
    assert payload["tenantId"] == "tenant-1"
    assert payload["api_key"] == "[redacted]"
    assert payload["model"] == "placeholder"


def test_request_context_filter_uses_placeholders_without_context() -> None:
    record = logging.LogRecord(
        name="ai",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="hello",
        args=(),
        exc_info=None,
    )

    assert RequestContextFilter().filter(record) is True
    assert record.request_id == "-"
    assert record.correlation_id == "-"
    assert record.tenant_id == "-"
