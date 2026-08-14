from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.domain.errors import AIError
from app.logging import get_logger


def _error_body(
    code: str,
    message: str,
    details: list[Any] | None = None,
) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code, "message": message}
    if details is not None:
        error["details"] = details
    return {"error": error}


def register_exception_handlers(application: FastAPI) -> None:
    logger = get_logger("http")

    @application.exception_handler(AIError)
    async def handle_ai_error(_request: Request, exc: AIError) -> JSONResponse:
        logger.warning(
            "AI service error",
            extra={"code": exc.code, "status_code": exc.status_code},
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_body(exc.code, exc.message),
        )

    @application.exception_handler(RequestValidationError)
    async def handle_validation_error(
        _request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=_error_body(
                "VALIDATION_ERROR",
                "Request validation failed",
                details=exc.errors(),
            ),
        )

    @application.exception_handler(StarletteHTTPException)
    async def handle_http_exception(
        _request: Request,
        exc: StarletteHTTPException,
    ) -> JSONResponse:
        code = "NOT_FOUND" if exc.status_code == 404 else "HTTP_ERROR"
        message = "Not found" if exc.status_code == 404 else "HTTP error"
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_body(code, message),
        )

    @application.exception_handler(Exception)
    async def handle_unhandled_error(_request: Request, exc: Exception) -> JSONResponse:
        logger.error(
            "Unhandled error",
            extra={"error_type": type(exc).__name__},
            exc_info=exc,
        )
        return JSONResponse(
            status_code=500,
            content=_error_body("INTERNAL_ERROR", "An unexpected error occurred"),
        )
