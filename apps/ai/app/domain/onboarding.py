from dataclasses import dataclass
from typing import Literal

from app.domain.errors import InvalidAIOutputError, InvalidOnboardingInputError

SupportToneId = Literal["professional", "friendly", "empathetic", "concise", "playful"]
KnowledgeSourceType = Literal["url", "help_center", "sitemap", "text", "file"]

SUPPORT_TONE_IDS: tuple[SupportToneId, ...] = (
    "professional",
    "friendly",
    "empathetic",
    "concise",
    "playful",
)
KNOWLEDGE_SOURCE_TYPES: tuple[KnowledgeSourceType, ...] = (
    "url",
    "help_center",
    "sitemap",
    "text",
    "file",
)
BUSINESS_PROFILE_SCHEMA_VERSION = 1
AGENT_SETTINGS_SCHEMA_VERSION = 1

_MAX_TEXT = 4000
_MAX_SHORT = 200
_MAX_LIST = 20
_MAX_LIST_ITEM = 200


def require_tenant_id(tenant_id: str | None) -> str:
    from app.domain.errors import TenantContextRequiredError

    value = (tenant_id or "").strip()
    if not value:
        raise TenantContextRequiredError()
    return value


def _clean_text(value: object, field: str, *, allow_empty: bool = False, max_len: int = _MAX_TEXT) -> str:
    if not isinstance(value, str):
        raise InvalidAIOutputError(f"{field} must be a string")
    text = " ".join(value.split()).strip()
    if not text and not allow_empty:
        raise InvalidAIOutputError(f"{field} is required")
    if len(text) > max_len:
        return text[:max_len]
    return text


def _optional_text(value: object, field: str, *, max_len: int = _MAX_SHORT) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise InvalidAIOutputError(f"{field} must be a string or null")
    text = value.strip()
    if not text:
        return None
    return text[:max_len]


def _string_list(value: object, field: str) -> tuple[str, ...]:
    if not isinstance(value, list):
        raise InvalidAIOutputError(f"{field} must be an array of strings")
    items: list[str] = []
    for item in value[:_MAX_LIST]:
        if not isinstance(item, str):
            continue
        cleaned = " ".join(item.split()).strip()
        if cleaned:
            items.append(cleaned[:_MAX_LIST_ITEM])
    return tuple(items)


def _tone_id(value: object) -> SupportToneId:
    if value in SUPPORT_TONE_IDS:
        return value  # type: ignore[return-value]
    raise InvalidAIOutputError("selectedToneId must be a supported tone preset")


@dataclass(frozen=True, slots=True)
class KnowledgeSourceBrief:
    type: KnowledgeSourceType
    name: str
    url: str | None
    description: str | None

    @staticmethod
    def from_mapping(raw: object) -> "KnowledgeSourceBrief":
        if not isinstance(raw, dict):
            raise InvalidOnboardingInputError("Each knowledge source must be an object")
        source_type = raw.get("type")
        if source_type not in KNOWLEDGE_SOURCE_TYPES:
            raise InvalidOnboardingInputError("Knowledge source type is invalid")
        name = raw.get("name")
        if not isinstance(name, str) or not name.strip():
            raise InvalidOnboardingInputError("Knowledge source name is required")
        url = raw.get("url")
        description = raw.get("description")
        return KnowledgeSourceBrief(
            type=source_type,  # type: ignore[arg-type]
            name=name.strip()[:_MAX_SHORT],
            url=_optional_text(url, "url", max_len=2000) if url is not None else None,
            description=_optional_text(description, "description", max_len=2000)
            if description is not None
            else None,
        )


@dataclass(frozen=True, slots=True)
class BusinessProfile:
    schema_version: int
    company_name: str
    industry: str
    description: str
    products_and_services: tuple[str, ...]
    target_audience: str
    support_channels: tuple[str, ...]
    common_intents: tuple[str, ...]
    escalation_topics: tuple[str, ...]
    brand_values: tuple[str, ...]
    languages: tuple[str, ...]
    hours_of_operation: str | None
    website_url: str | None

    def to_dict(self) -> dict[str, object]:
        return {
            "schemaVersion": self.schema_version,
            "companyName": self.company_name,
            "industry": self.industry,
            "description": self.description,
            "productsAndServices": list(self.products_and_services),
            "targetAudience": self.target_audience,
            "supportChannels": list(self.support_channels),
            "commonIntents": list(self.common_intents),
            "escalationTopics": list(self.escalation_topics),
            "brandValues": list(self.brand_values),
            "languages": list(self.languages),
            "hoursOfOperation": self.hours_of_operation,
            "websiteUrl": self.website_url,
        }

    @staticmethod
    def from_mapping(raw: object) -> "BusinessProfile":
        if not isinstance(raw, dict):
            raise InvalidAIOutputError("Business profile must be an object")
        languages = _string_list(raw.get("languages", ["English"]), "languages")
        return BusinessProfile(
            schema_version=BUSINESS_PROFILE_SCHEMA_VERSION,
            company_name=_clean_text(raw.get("companyName"), "companyName", max_len=_MAX_SHORT),
            industry=_clean_text(raw.get("industry"), "industry", max_len=_MAX_SHORT),
            description=_clean_text(raw.get("description"), "description"),
            products_and_services=_string_list(raw.get("productsAndServices", []), "productsAndServices"),
            target_audience=_clean_text(raw.get("targetAudience"), "targetAudience"),
            support_channels=_string_list(raw.get("supportChannels", ["chat"]), "supportChannels")
            or ("chat",),
            common_intents=_string_list(raw.get("commonIntents", []), "commonIntents"),
            escalation_topics=_string_list(raw.get("escalationTopics", []), "escalationTopics"),
            brand_values=_string_list(raw.get("brandValues", []), "brandValues"),
            languages=languages or ("English",),
            hours_of_operation=_optional_text(raw.get("hoursOfOperation"), "hoursOfOperation"),
            website_url=_optional_text(raw.get("websiteUrl"), "websiteUrl", max_len=2000),
        )


@dataclass(frozen=True, slots=True)
class SupportTonePreset:
    id: SupportToneId
    name: str
    description: str
    voice_guidelines: str
    example_reply: str
    recommended: bool

    def to_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "voiceGuidelines": self.voice_guidelines,
            "exampleReply": self.example_reply,
            "recommended": self.recommended,
        }

    @staticmethod
    def from_mapping(raw: object) -> "SupportTonePreset":
        if not isinstance(raw, dict):
            raise InvalidAIOutputError("Tone preset must be an object")
        return SupportTonePreset(
            id=_tone_id(raw.get("id")),
            name=_clean_text(raw.get("name"), "name", max_len=_MAX_SHORT),
            description=_clean_text(raw.get("description"), "description"),
            voice_guidelines=_clean_text(raw.get("voiceGuidelines"), "voiceGuidelines"),
            example_reply=_clean_text(raw.get("exampleReply"), "exampleReply"),
            recommended=bool(raw.get("recommended", False)),
        )


def normalize_tone_presets(raw: object) -> tuple[SupportTonePreset, ...]:
    if isinstance(raw, dict) and "items" in raw:
        raw = raw["items"]
    if not isinstance(raw, list):
        raise InvalidAIOutputError("Tone presets must be an array")

    by_id: dict[SupportToneId, SupportTonePreset] = {}
    for item in raw:
        try:
            preset = SupportTonePreset.from_mapping(item)
        except InvalidAIOutputError:
            continue
        by_id[preset.id] = preset

    recommended_id: SupportToneId | None = next(
        (preset.id for preset in by_id.values() if preset.recommended),
        None,
    )
    if recommended_id is None:
        recommended_id = "friendly" if "friendly" in by_id else next(iter(SUPPORT_TONE_IDS))

    presets: list[SupportTonePreset] = []
    for tone_id in SUPPORT_TONE_IDS:
        existing = by_id.get(tone_id)
        if existing is None:
            raise InvalidAIOutputError("Tone presets must include every supported tone")
        presets.append(
            SupportTonePreset(
                id=existing.id,
                name=existing.name,
                description=existing.description,
                voice_guidelines=existing.voice_guidelines,
                example_reply=existing.example_reply,
                recommended=existing.id == recommended_id,
            )
        )
    return tuple(presets)


def recommended_tone_id(presets: tuple[SupportTonePreset, ...]) -> SupportToneId:
    for preset in presets:
        if preset.recommended:
            return preset.id
    return presets[0].id if presets else "friendly"


@dataclass(frozen=True, slots=True)
class AgentSettings:
    schema_version: int
    assistant_name: str
    greeting: str
    signature: str | None
    selected_tone_id: SupportToneId
    system_instructions: str
    allowed_topics: tuple[str, ...]
    forbidden_topics: tuple[str, ...]
    escalate_when: tuple[str, ...]
    language: str
    collect_contact_info: bool
    handoff_to_human: bool
    max_autonomy_turns: int

    def to_dict(self) -> dict[str, object]:
        return {
            "schemaVersion": self.schema_version,
            "assistantName": self.assistant_name,
            "greeting": self.greeting,
            "signature": self.signature,
            "selectedToneId": self.selected_tone_id,
            "systemInstructions": self.system_instructions,
            "allowedTopics": list(self.allowed_topics),
            "forbiddenTopics": list(self.forbidden_topics),
            "escalateWhen": list(self.escalate_when),
            "language": self.language,
            "collectContactInfo": self.collect_contact_info,
            "handoffToHuman": self.handoff_to_human,
            "maxAutonomyTurns": self.max_autonomy_turns,
        }

    @staticmethod
    def from_mapping(raw: object, *, selected_tone_id: SupportToneId | None = None) -> "AgentSettings":
        if not isinstance(raw, dict):
            raise InvalidAIOutputError("Agent settings must be an object")
        tone = _tone_id(selected_tone_id or raw.get("selectedToneId"))
        turns = raw.get("maxAutonomyTurns", 6)
        if not isinstance(turns, int) or turns < 1 or turns > 20:
            turns = 6
        return AgentSettings(
            schema_version=AGENT_SETTINGS_SCHEMA_VERSION,
            assistant_name=_clean_text(raw.get("assistantName"), "assistantName", max_len=_MAX_SHORT),
            greeting=_clean_text(raw.get("greeting"), "greeting"),
            signature=_optional_text(raw.get("signature"), "signature", max_len=_MAX_SHORT),
            selected_tone_id=tone,
            system_instructions=_clean_text(raw.get("systemInstructions"), "systemInstructions"),
            allowed_topics=_string_list(raw.get("allowedTopics", []), "allowedTopics"),
            forbidden_topics=_string_list(raw.get("forbiddenTopics", []), "forbiddenTopics"),
            escalate_when=_string_list(raw.get("escalateWhen", []), "escalateWhen"),
            language=_clean_text(raw.get("language", "English"), "language", max_len=64),
            collect_contact_info=bool(raw.get("collectContactInfo", True)),
            handoff_to_human=bool(raw.get("handoffToHuman", True)),
            max_autonomy_turns=turns,
        )


@dataclass(frozen=True, slots=True)
class OnboardingSetupDraft:
    business_profile: BusinessProfile
    tone_presets: tuple[SupportTonePreset, ...]
    selected_tone_id: SupportToneId
    agent_settings: AgentSettings

    def to_dict(self) -> dict[str, object]:
        return {
            "businessProfile": self.business_profile.to_dict(),
            "tonePresets": [preset.to_dict() for preset in self.tone_presets],
            "selectedToneId": self.selected_tone_id,
            "agentSettings": self.agent_settings.to_dict(),
        }
