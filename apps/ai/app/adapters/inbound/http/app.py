from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.adapters.inbound.http.errors import register_exception_handlers
from app.adapters.inbound.http.health import router as health_router
from app.adapters.inbound.http.ingestion import router as ingestion_router
from app.adapters.inbound.http.middleware import RequestContextMiddleware
from app.adapters.inbound.http.onboarding import router as onboarding_router
from app.adapters.inbound.http.support import router as support_router
from app.adapters.outbound.embeddings import create_embedding_port
from app.adapters.outbound.http.url_fetch_adapter import HttpUrlFetchAdapter
from app.adapters.outbound.llm import create_llm_port
from app.adapters.outbound.parsers.registry import default_document_parser
from app.adapters.outbound.vector_store import InMemoryVectorStoreAdapter
from app.application.use_cases.generate_onboarding_use_cases import (
    GenerateBusinessProfileUseCase,
    GenerateInitialAgentSettingsUseCase,
    GenerateSupportTonePresetsUseCase,
    RunOnboardingSetupUseCase,
)
from app.application.use_cases.generate_support_reply_use_case import GenerateSupportReplyUseCase
from app.application.use_cases.ingest_document_use_case import (
    DeleteIndexedDocumentUseCase,
    IngestDocumentUseCase,
)
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
    _wire_onboarding(application, resolved)
    _wire_ingestion(application, resolved)
    application.add_middleware(RequestContextMiddleware)
    register_exception_handlers(application)
    application.include_router(health_router)
    application.include_router(onboarding_router)
    application.include_router(support_router)
    application.include_router(ingestion_router)
    return application


def _wire_onboarding(application: FastAPI, settings: Settings) -> None:
    llm = create_llm_port(settings)
    logger = get_logger("onboarding")
    generate_profile = GenerateBusinessProfileUseCase(llm, logger)
    generate_tones = GenerateSupportTonePresetsUseCase(llm, logger)
    generate_settings = GenerateInitialAgentSettingsUseCase(llm, logger)
    application.state.llm = llm
    application.state.generate_business_profile = generate_profile
    application.state.generate_support_tone_presets = generate_tones
    application.state.generate_initial_agent_settings = generate_settings
    application.state.run_onboarding_setup = RunOnboardingSetupUseCase(
        generate_profile,
        generate_tones,
        generate_settings,
    )
    application.state.generate_support_reply = GenerateSupportReplyUseCase(llm, get_logger("support"))


def _wire_ingestion(application: FastAPI, settings: Settings) -> None:
    embeddings = create_embedding_port(settings)
    vectors = InMemoryVectorStoreAdapter()
    logger = get_logger("ingestion")
    application.state.embeddings = embeddings
    application.state.vector_index = vectors
    application.state.ingest_document = IngestDocumentUseCase(
        default_document_parser(),
        HttpUrlFetchAdapter(logger),
        embeddings,
        vectors,
        logger,
    )
    application.state.delete_indexed_document = DeleteIndexedDocumentUseCase(vectors, logger)
