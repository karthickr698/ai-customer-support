from app.adapters.outbound.llm.heuristic_llm_adapter import HeuristicLLMAdapter
from app.adapters.outbound.llm.openai.openai_llm_adapter import OpenAILLMAdapter
from app.application.ports.llm_port import LLMPort
from app.config import Settings
from app.domain.errors import ConfigurationError
from app.logging import get_logger


def create_llm_port(settings: Settings) -> LLMPort:
    provider = (settings.llm_provider or "").strip().lower()
    has_key = bool(settings.llm_api_key.strip())

    if provider in ("heuristic", "none"):
        return HeuristicLLMAdapter()

    if provider in ("openai", "openai_compatible") or (provider == "" and has_key):
        if not has_key:
            if settings.env == "production":
                raise ConfigurationError("LLM_API_KEY is required when LLM_PROVIDER is openai")
            return HeuristicLLMAdapter()
        return OpenAILLMAdapter(
            api_key=settings.llm_api_key,
            model=settings.llm_model,
            base_url=settings.llm_base_url,
            logger=get_logger("llm.openai"),
        )

    if provider == "" and not has_key:
        return HeuristicLLMAdapter()

    raise ConfigurationError(f"Unsupported LLM_PROVIDER: {settings.llm_provider}")


def create_fallback_llm_port(settings: Settings) -> LLMPort | None:
    """Heuristic fallback when the primary provider is a live model."""
    provider = (settings.llm_provider or "").strip().lower()
    has_key = bool(settings.llm_api_key.strip())
    if provider in ("heuristic", "none"):
        return None
    if provider == "" and not has_key:
        return None
    return HeuristicLLMAdapter()
