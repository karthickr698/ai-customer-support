from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class RequestContext:
    request_id: str
    correlation_id: str
    tenant_id: str | None = None
