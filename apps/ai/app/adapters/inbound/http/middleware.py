from collections.abc import Awaitable, Callable
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.context import bind_request_context, reset_request_context
from app.domain.request_context import RequestContext


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        request_id = request.headers.get("x-request-id") or str(uuid4())
        correlation_id = request.headers.get("x-correlation-id") or request_id
        tenant_id = request.headers.get("x-tenant-id")
        trace_id = request.headers.get("x-trace-id") or correlation_id
        parent_span_id = request.headers.get("x-parent-span-id")
        span_id = str(uuid4())
        # Tenant context is supplied by the TypeScript API, not by browsers.

        token = bind_request_context(
            RequestContext(
                request_id=request_id,
                correlation_id=correlation_id,
                tenant_id=tenant_id,
                trace_id=trace_id,
                span_id=span_id,
                parent_span_id=parent_span_id,
            )
        )
        try:
            response = await call_next(request)
        finally:
            reset_request_context(token)

        response.headers["x-request-id"] = request_id
        response.headers["x-correlation-id"] = correlation_id
        response.headers["x-trace-id"] = trace_id
        response.headers["x-span-id"] = span_id
        return response
