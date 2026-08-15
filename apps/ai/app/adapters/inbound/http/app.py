from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.adapters.inbound.http.errors import register_exception_handlers
from app.adapters.inbound.http.health import router as health_router
from app.adapters.inbound.http.ingestion import router as ingestion_router
from app.adapters.inbound.http.middleware import RequestContextMiddleware
from app.adapters.inbound.http.observability_middleware import ObservabilityMiddleware
from app.adapters.inbound.http.onboarding import router as onboarding_router
from app.adapters.inbound.http.orchestration import router as orchestration_router
from app.adapters.inbound.http.support import router as support_router
from app.adapters.inbound.http.tools import router as tools_router
from app.adapters.outbound.embeddings import create_embedding_port
from app.adapters.outbound.http.url_fetch_adapter import HttpUrlFetchAdapter
from app.adapters.outbound.llm import create_fallback_llm_port, create_llm_port
from app.adapters.outbound.parsers.registry import default_document_parser
from app.adapters.outbound.rerank import create_rerank_port
from app.adapters.outbound.vector_store import close_vector_index_port, create_vector_index_port
from app.application.use_cases.detect_intent_use_case import DetectIntentUseCase
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
from app.application.use_cases.orchestrate_support_turn_use_case import OrchestrateSupportTurnUseCase
from app.application.use_cases.propose_tool_calls_use_case import ProposeToolCallsUseCase
from app.application.use_cases.apply_tool_results_use_case import ApplyToolResultsUseCase
from app.application.use_cases.retrieve_knowledge_use_case import RetrieveKnowledgeUseCase
from app.config import Settings, get_settings, override_settings
from app.domain.retrieval import RetrievalPolicy
from app.logging import configure_logging, get_logger
from app.orchestration.executor import CompletionExecutor


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    settings: Settings = application.state.settings
    logger = get_logger("startup")
    logger.info(
        "AI service starting",
        extra={
            "env": settings.env,
            "host": settings.host,
            "port": settings.port,
            "vectorStore": settings.vector_store_provider or "memory",
            "ragTopK": settings.rag_top_k,
        },
    )
    try:
        yield
    finally:
        await close_vector_index_port(application.state.vector_index)
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
    _wire_orchestration(application, resolved)
    application.add_middleware(ObservabilityMiddleware)
    application.add_middleware(RequestContextMiddleware)
    register_exception_handlers(application)
    application.include_router(health_router)
    application.include_router(onboarding_router)
    application.include_router(support_router)
    application.include_router(ingestion_router)
    application.include_router(orchestration_router)
    application.include_router(tools_router)
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


def _wire_ingestion(application: FastAPI, settings: Settings) -> None:
    embeddings = create_embedding_port(settings)
    vectors = create_vector_index_port(settings)
    logger = get_logger("ingestion")
    retrieve = RetrieveKnowledgeUseCase(
        embeddings,
        vectors,
        create_rerank_port(settings),
        RetrievalPolicy(
            default_top_k=settings.rag_top_k,
            max_top_k=settings.rag_max_top_k,
            candidate_k=settings.rag_candidate_k,
            vector_weight=settings.rag_vector_weight,
            keyword_weight=settings.rag_keyword_weight,
            rrf_k=settings.rag_rrf_k,
            rerank_enabled=settings.rag_rerank_enabled,
        ),
        get_logger("retrieval"),
    )
    application.state.embeddings = embeddings
    application.state.vector_index = vectors
    application.state.retrieve_knowledge = retrieve
    application.state.ingest_document = IngestDocumentUseCase(
        default_document_parser(),
        HttpUrlFetchAdapter(logger),
        embeddings,
        vectors,
        logger,
    )
    application.state.delete_indexed_document = DeleteIndexedDocumentUseCase(vectors, logger)


def _wire_orchestration(application: FastAPI, settings: Settings) -> None:
    executor = CompletionExecutor(
        application.state.llm,
        create_fallback_llm_port(settings),
        settings.llm_max_attempts,
        get_logger("orchestration"),
    )
    retrieve = application.state.retrieve_knowledge
    application.state.detect_intent = DetectIntentUseCase(get_logger("intent"))
    application.state.orchestrate_support_turn = OrchestrateSupportTurnUseCase(
        executor,
        get_logger("orchestration"),
        retrieve,
        settings.llm_model,
        settings.llm_quality_model,
    )
    application.state.generate_support_reply = GenerateSupportReplyUseCase(
        application.state.llm,
        get_logger("support"),
        retrieve,
        executor,
        settings.llm_model,
        settings.llm_quality_model,
    )
    application.state.propose_tool_calls = ProposeToolCallsUseCase(
        application.state.llm,
        get_logger("tools"),
    )
    application.state.apply_tool_results = ApplyToolResultsUseCase(
        application.state.llm,
        get_logger("tools"),
    )
