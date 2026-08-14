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

        token = bind_request_context(
            RequestContext(
                request_id=request_id,
                correlation_id=correlation_id,
                tenant_id=tenant_id,
            )
        )
        try:
            response = await call_next(request)
        finally:
            reset_request_context(token)

        response.headers["x-request-id"] = request_id
        response.headers["x-correlation-id"] = correlation_id
        return response
