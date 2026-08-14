from contextvars import ContextVar, Token

from app.domain.request_context import RequestContext

_request_context: ContextVar[RequestContext | None] = ContextVar(
    "request_context",
    default=None,
)


def get_request_context() -> RequestContext | None:
    return _request_context.get()


def bind_request_context(context: RequestContext) -> Token[RequestContext | None]:
    return _request_context.set(context)


def reset_request_context(token: Token[RequestContext | None]) -> None:
    _request_context.reset(token)
