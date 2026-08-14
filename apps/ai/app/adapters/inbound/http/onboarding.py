from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field, HttpUrl

from app.application.use_cases.generate_onboarding_use_cases import (
    GenerateAgentSettingsCommand,
    GenerateBusinessProfileCommand,
    GenerateBusinessProfileUseCase,
    GenerateInitialAgentSettingsUseCase,
    GenerateSupportTonePresetsUseCase,
    GenerateTonePresetsCommand,
    RunOnboardingSetupCommand,
    RunOnboardingSetupUseCase,
)
from app.context import get_request_context
from app.domain.errors import InvalidOnboardingInputError, TenantContextRequiredError
from app.domain.onboarding import (
    SUPPORT_TONE_IDS,
    BusinessProfile,
    KnowledgeSourceBrief,
    SupportToneId,
    recommended_tone_id,
    require_tenant_id,
)

router = APIRouter(prefix="/v1/onboarding", tags=["onboarding"])

ToneId = Literal["professional", "friendly", "empathetic", "concise", "playful"]
SourceType = Literal["url", "help_center", "sitemap", "text", "file"]


class KnowledgeSourceBriefBody(BaseModel):
    type: SourceType
    name: str = Field(min_length=1, max_length=200)
    url: HttpUrl | None = None
    description: str | None = Field(default=None, max_length=2000)


class BusinessProfileBody(BaseModel):
    schemaVersion: Literal[1]
    companyName: str
    industry: str
    description: str
    productsAndServices: list[str]
    targetAudience: str
    supportChannels: list[str]
    commonIntents: list[str]
    escalationTopics: list[str]
    brandValues: list[str]
    languages: list[str]
    hoursOfOperation: str | None = None
    websiteUrl: str | None = None


class GenerateBusinessProfileBody(BaseModel):
    description: str = Field(min_length=1, max_length=8000)
    companyName: str | None = Field(default=None, max_length=200)
    websiteUrl: HttpUrl | None = None
    industry: str | None = Field(default=None, max_length=200)
    extraNotes: str | None = Field(default=None, max_length=4000)


class GenerateTonePresetsBody(BaseModel):
    businessProfile: BusinessProfileBody


class GenerateAgentSettingsBody(BaseModel):
    businessProfile: BusinessProfileBody
    selectedToneId: ToneId | None = None
    knowledgeSources: list[KnowledgeSourceBriefBody] = Field(default_factory=list)


class RunOnboardingSetupBody(GenerateBusinessProfileBody):
    selectedToneId: ToneId | None = None
    knowledgeSources: list[KnowledgeSourceBriefBody] = Field(default_factory=list)


def _tenant_id() -> str:
    context = get_request_context()
    if context is None or not context.tenant_id:
        raise TenantContextRequiredError()
    return require_tenant_id(context.tenant_id)


def _correlation_id() -> str:
    context = get_request_context()
    if context is None:
        raise TenantContextRequiredError()
    return context.correlation_id


def _sources(items: list[KnowledgeSourceBriefBody]) -> tuple[KnowledgeSourceBrief, ...]:
    return tuple(
        KnowledgeSourceBrief(
            type=item.type,
            name=item.name.strip(),
            url=str(item.url) if item.url else None,
            description=item.description.strip() if item.description else None,
        )
        for item in items
    )


def _profile(body: BusinessProfileBody) -> BusinessProfile:
    return BusinessProfile.from_mapping(body.model_dump())


def generate_profile_use_case(request: Request) -> GenerateBusinessProfileUseCase:
    return request.app.state.generate_business_profile


def generate_tones_use_case(request: Request) -> GenerateSupportTonePresetsUseCase:
    return request.app.state.generate_support_tone_presets


def generate_settings_use_case(request: Request) -> GenerateInitialAgentSettingsUseCase:
    return request.app.state.generate_initial_agent_settings


def run_setup_use_case(request: Request) -> RunOnboardingSetupUseCase:
    return request.app.state.run_onboarding_setup


@router.post("/business-profile")
async def generate_business_profile(
    body: GenerateBusinessProfileBody,
    use_case: Annotated[GenerateBusinessProfileUseCase, Depends(generate_profile_use_case)],
) -> dict[str, Any]:
    profile = await use_case.execute(
        GenerateBusinessProfileCommand(
            tenant_id=_tenant_id(),
            correlation_id=_correlation_id(),
            description=body.description,
            company_name=body.companyName,
            website_url=str(body.websiteUrl) if body.websiteUrl else None,
            industry=body.industry,
            extra_notes=body.extraNotes,
        )
    )
    return {"businessProfile": profile.to_dict()}


@router.post("/tone-presets")
async def generate_tone_presets(
    body: GenerateTonePresetsBody,
    use_case: Annotated[GenerateSupportTonePresetsUseCase, Depends(generate_tones_use_case)],
) -> dict[str, Any]:
    presets = await use_case.execute(
        GenerateTonePresetsCommand(
            tenant_id=_tenant_id(),
            correlation_id=_correlation_id(),
            business_profile=_profile(body.businessProfile),
        )
    )
    return {
        "items": [preset.to_dict() for preset in presets],
        "selectedToneId": recommended_tone_id(presets),
    }


@router.post("/agent-settings")
async def generate_agent_settings(
    body: GenerateAgentSettingsBody,
    use_case: Annotated[GenerateInitialAgentSettingsUseCase, Depends(generate_settings_use_case)],
) -> dict[str, Any]:
    profile = _profile(body.businessProfile)
    selected: SupportToneId = body.selectedToneId or "friendly"
    if selected not in SUPPORT_TONE_IDS:
        raise InvalidOnboardingInputError("selectedToneId is invalid")
    settings = await use_case.execute(
        GenerateAgentSettingsCommand(
            tenant_id=_tenant_id(),
            correlation_id=_correlation_id(),
            business_profile=profile,
            selected_tone_id=selected,
            knowledge_sources=_sources(body.knowledgeSources),
        )
    )
    return {"agentSettings": settings.to_dict()}


@router.post("/setup")
async def run_onboarding_setup(
    body: RunOnboardingSetupBody,
    use_case: Annotated[RunOnboardingSetupUseCase, Depends(run_setup_use_case)],
) -> dict[str, Any]:
    draft = await use_case.execute(
        RunOnboardingSetupCommand(
            tenant_id=_tenant_id(),
            correlation_id=_correlation_id(),
            description=body.description,
            company_name=body.companyName,
            website_url=str(body.websiteUrl) if body.websiteUrl else None,
            industry=body.industry,
            extra_notes=body.extraNotes,
            selected_tone_id=body.selectedToneId,
            knowledge_sources=_sources(body.knowledgeSources),
        )
    )
    return draft.to_dict()
