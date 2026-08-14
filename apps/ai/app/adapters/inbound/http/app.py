from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.adapters.inbound.http.errors import register_exception_handlers
from app.adapters.inbound.http.health import router as health_router
from app.adapters.inbound.http.middleware import RequestContextMiddleware
from app.config import Settings, get_settings, override_settings
from app.logging import configure_logging, get_logger


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    settings: Settings = application.state.settings
    logger = get_logger("startup")
    logger.info(
        "AI service starting",
        extra={"env": settings.env, "host": settings.host, "port": settings.port},
    )
    try:
        yield
    finally:
        logger.info("AI service shutting down")


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved = override_settings(settings) if settings is not None else get_settings()
    configure_logging(resolved)

    docs_url = None if resolved.env == "production" else "/docs"
    redoc_url = None if resolved.env == "production" else "/redoc"

    application = FastAPI(
        title="AI Customer Support — AI Service",
        version="0.0.1",
        lifespan=lifespan,
        docs_url=docs_url,
        redoc_url=redoc_url,
    )
    application.state.settings = resolved
    application.add_middleware(RequestContextMiddleware)
    register_exception_handlers(application)
    application.include_router(health_router)
    return application
