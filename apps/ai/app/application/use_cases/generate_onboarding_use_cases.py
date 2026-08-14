import logging
import time
from dataclasses import dataclass

from app.application.ports.llm_port import LLMCompletionRequest, LLMMessage, LLMPort
from app.domain.errors import InvalidAIOutputError
from app.domain.onboarding import (
    AgentSettings,
    BusinessProfile,
    KnowledgeSourceBrief,
    OnboardingSetupDraft,
    SupportToneId,
    SupportTonePreset,
    normalize_tone_presets,
    recommended_tone_id,
    require_tenant_id,
)
from app.guardrails.json_output import parse_json_object
from app.prompts import onboarding as prompts


@dataclass(frozen=True, slots=True)
class GenerateBusinessProfileCommand:
    tenant_id: str
    correlation_id: str
    description: str
    company_name: str | None = None
    website_url: str | None = None
    industry: str | None = None
    extra_notes: str | None = None


@dataclass(frozen=True, slots=True)
class GenerateTonePresetsCommand:
    tenant_id: str
    correlation_id: str
    business_profile: BusinessProfile


@dataclass(frozen=True, slots=True)
class GenerateAgentSettingsCommand:
    tenant_id: str
    correlation_id: str
    business_profile: BusinessProfile
    selected_tone_id: SupportToneId
    knowledge_sources: tuple[KnowledgeSourceBrief, ...] = ()


@dataclass(frozen=True, slots=True)
class RunOnboardingSetupCommand:
    tenant_id: str
    correlation_id: str
    description: str
    company_name: str | None = None
    website_url: str | None = None
    industry: str | None = None
    extra_notes: str | None = None
    selected_tone_id: SupportToneId | None = None
    knowledge_sources: tuple[KnowledgeSourceBrief, ...] = ()


class _StructuredLlm:
    def __init__(self, llm: LLMPort, logger: logging.Logger) -> None:
        self._llm = llm
        self._logger = logger

    async def complete_json(
        self,
        *,
        tenant_id: str,
        correlation_id: str,
        system_prompt: str,
        user_prompt: str,
        operation: str,
    ) -> dict[str, object]:
        started = time.perf_counter()
        first = await self._llm.complete(
            LLMCompletionRequest(
                messages=(
                    LLMMessage(role="system", content=system_prompt),
                    LLMMessage(role="user", content=user_prompt),
                ),
                correlation_id=correlation_id,
                tenant_id=tenant_id,
                json_mode=True,
            )
        )
        try:
            parsed = parse_json_object(first.content)
        except InvalidAIOutputError as exc:
            repair = await self._llm.complete(
                LLMCompletionRequest(
                    messages=(
                        LLMMessage(role="system", content=system_prompt),
                        LLMMessage(role="user", content=user_prompt),
                        LLMMessage(role="assistant", content=first.content),
                        LLMMessage(
                            role="user",
                            content=prompts.repair_user_prompt(first.content, str(exc)),
                        ),
                    ),
                    correlation_id=correlation_id,
                    tenant_id=tenant_id,
                    json_mode=True,
                    temperature=0,
                )
            )
            parsed = parse_json_object(repair.content)
            first = repair

        latency_ms = int((time.perf_counter() - started) * 1000)
        self._logger.info(
            "Onboarding LLM call completed",
            extra={
                "tenantId": tenant_id,
                "operation": operation,
                "model": first.model,
                "promptTokens": first.prompt_tokens,
                "completionTokens": first.completion_tokens,
                "latencyMs": latency_ms,
            },
        )
        return parsed


class GenerateBusinessProfileUseCase:
    def __init__(self, llm: LLMPort, logger: logging.Logger) -> None:
        self._structured = _StructuredLlm(llm, logger)

    async def execute(self, command: GenerateBusinessProfileCommand) -> BusinessProfile:
        tenant_id = require_tenant_id(command.tenant_id)
        raw = await self._structured.complete_json(
            tenant_id=tenant_id,
            correlation_id=command.correlation_id,
            system_prompt=prompts.business_profile_system_prompt(),
            user_prompt=prompts.business_profile_user_prompt(
                company_name=command.company_name,
                description=command.description,
                website_url=command.website_url,
                industry=command.industry,
                extra_notes=command.extra_notes,
            ),
            operation="generate_business_profile",
        )
        return BusinessProfile.from_mapping(raw)


class GenerateSupportTonePresetsUseCase:
    def __init__(self, llm: LLMPort, logger: logging.Logger) -> None:
        self._structured = _StructuredLlm(llm, logger)

    async def execute(
        self,
        command: GenerateTonePresetsCommand,
    ) -> tuple[SupportTonePreset, ...]:
        tenant_id = require_tenant_id(command.tenant_id)
        raw = await self._structured.complete_json(
            tenant_id=tenant_id,
            correlation_id=command.correlation_id,
            system_prompt=prompts.tone_presets_system_prompt(),
            user_prompt=prompts.tone_presets_user_prompt(command.business_profile),
            operation="generate_support_tone_presets",
        )
        return normalize_tone_presets(raw)


class GenerateInitialAgentSettingsUseCase:
    def __init__(self, llm: LLMPort, logger: logging.Logger) -> None:
        self._structured = _StructuredLlm(llm, logger)

    async def execute(self, command: GenerateAgentSettingsCommand) -> AgentSettings:
        tenant_id = require_tenant_id(command.tenant_id)
        raw = await self._structured.complete_json(
            tenant_id=tenant_id,
            correlation_id=command.correlation_id,
            system_prompt=prompts.agent_settings_system_prompt(),
            user_prompt=prompts.agent_settings_user_prompt(
                profile=command.business_profile,
                selected_tone_id=command.selected_tone_id,
                knowledge_sources=command.knowledge_sources,
            ),
            operation="generate_initial_agent_settings",
        )
        return AgentSettings.from_mapping(raw, selected_tone_id=command.selected_tone_id)


class RunOnboardingSetupUseCase:
    def __init__(
        self,
        generate_profile: GenerateBusinessProfileUseCase,
        generate_tones: GenerateSupportTonePresetsUseCase,
        generate_settings: GenerateInitialAgentSettingsUseCase,
    ) -> None:
        self._generate_profile = generate_profile
        self._generate_tones = generate_tones
        self._generate_settings = generate_settings

    async def execute(self, command: RunOnboardingSetupCommand) -> OnboardingSetupDraft:
        tenant_id = require_tenant_id(command.tenant_id)
        profile = await self._generate_profile.execute(
            GenerateBusinessProfileCommand(
                tenant_id=tenant_id,
                correlation_id=command.correlation_id,
                description=command.description,
                company_name=command.company_name,
                website_url=command.website_url,
                industry=command.industry,
                extra_notes=command.extra_notes,
            )
        )
        tones = await self._generate_tones.execute(
            GenerateTonePresetsCommand(
                tenant_id=tenant_id,
                correlation_id=command.correlation_id,
                business_profile=profile,
            )
        )
        selected = command.selected_tone_id or recommended_tone_id(tones)
        if selected not in {preset.id for preset in tones}:
            selected = recommended_tone_id(tones)
        settings = await self._generate_settings.execute(
            GenerateAgentSettingsCommand(
                tenant_id=tenant_id,
                correlation_id=command.correlation_id,
                business_profile=profile,
                selected_tone_id=selected,
                knowledge_sources=command.knowledge_sources,
            )
        )
        return OnboardingSetupDraft(
            business_profile=profile,
            tone_presets=tones,
            selected_tone_id=selected,
            agent_settings=settings,
        )
