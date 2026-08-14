"""Onboarding prompt templates. No provider SDKs."""

from app.domain.onboarding import (
    SUPPORT_TONE_IDS,
    AgentSettings,
    BusinessProfile,
    KnowledgeSourceBrief,
    SupportToneId,
)

TASK_BUSINESS_PROFILE = "business_profile"
TASK_TONE_PRESETS = "tone_presets"
TASK_AGENT_SETTINGS = "agent_settings"

_JSON_ONLY = "Respond with a single JSON object. Do not include markdown or commentary."


def business_profile_system_prompt() -> str:
    return (
        "You are an onboarding assistant for an AI customer-support product. "
        f"TASK={TASK_BUSINESS_PROFILE}. "
        "Infer a structured business profile from the operator's description. "
        "Use only the supplied facts; do not invent legal claims, prices, or private data. "
        "If a field is unknown, use a conservative generic value. "
        "JSON keys: schemaVersion (number 1), companyName, industry, description, "
        "productsAndServices (string[]), targetAudience, supportChannels (string[]), "
        "commonIntents (string[]), escalationTopics (string[]), brandValues (string[]), "
        "languages (string[]), hoursOfOperation (string|null), websiteUrl (string|null). "
        f"{_JSON_ONLY}"
    )


def tone_presets_system_prompt() -> str:
    ids = ", ".join(SUPPORT_TONE_IDS)
    return (
        "You are an onboarding assistant for an AI customer-support product. "
        f"TASK={TASK_TONE_PRESETS}. "
        f"Return exactly one preset for each id: {ids}. "
        "Customize name, description, voiceGuidelines, and exampleReply for this business. "
        "Mark exactly one preset recommended=true (usually friendly or professional). "
        "Each item keys: id, name, description, voiceGuidelines, exampleReply, recommended. "
        "Wrap the array in {\"items\":[...]}. "
        f"{_JSON_ONLY}"
    )


def agent_settings_system_prompt() -> str:
    return (
        "You are an onboarding assistant for an AI customer-support product. "
        f"TASK={TASK_AGENT_SETTINGS}. "
        "Produce initial AI agent settings the TypeScript backend will persist. "
        "systemInstructions must tell the assistant to stay on-topic, refuse harmful requests, "
        "and hand off when escalateWhen matches. "
        "JSON keys: schemaVersion (number 1), assistantName, greeting, signature (string|null), "
        "selectedToneId, systemInstructions, allowedTopics (string[]), forbiddenTopics (string[]), "
        "escalateWhen (string[]), language, collectContactInfo (boolean), handoffToHuman (boolean), "
        "maxAutonomyTurns (integer 1-20). "
        f"{_JSON_ONLY}"
    )


def business_profile_user_prompt(
    *,
    company_name: str | None,
    description: str,
    website_url: str | None,
    industry: str | None,
    extra_notes: str | None,
) -> str:
    return _render(
        {
            "companyName": company_name,
            "description": description,
            "websiteUrl": website_url,
            "industry": industry,
            "extraNotes": extra_notes,
        }
    )


def tone_presets_user_prompt(profile: BusinessProfile) -> str:
    return _render({"businessProfile": profile.to_dict()})


def agent_settings_user_prompt(
    *,
    profile: BusinessProfile,
    selected_tone_id: SupportToneId,
    knowledge_sources: tuple[KnowledgeSourceBrief, ...],
) -> str:
    return _render(
        {
            "businessProfile": profile.to_dict(),
            "selectedToneId": selected_tone_id,
            "knowledgeSources": [
                {
                    "type": source.type,
                    "name": source.name,
                    "url": source.url,
                    "description": source.description,
                }
                for source in knowledge_sources
            ],
        }
    )


def repair_user_prompt(previous: str, error: str) -> str:
    return (
        "The previous JSON was invalid.\n"
        f"Error: {error}\n"
        "Return corrected JSON only.\n"
        f"Previous output:\n{previous[:4000]}"
    )


def _render(payload: dict[str, object]) -> str:
    import json

    return json.dumps(payload, ensure_ascii=False)


def default_assistant_name(profile: BusinessProfile) -> str:
    return f"{profile.company_name} Support"


def seed_agent_settings(profile: BusinessProfile, selected_tone_id: SupportToneId) -> AgentSettings:
    return AgentSettings.from_mapping(
        {
            "schemaVersion": 1,
            "assistantName": default_assistant_name(profile),
            "greeting": f"Hi — I'm the {profile.company_name} support assistant. How can I help?",
            "signature": None,
            "selectedToneId": selected_tone_id,
            "systemInstructions": (
                f"You support customers of {profile.company_name} in {profile.industry}. "
                "Answer from the business profile and registered knowledge sources. "
                "If you are unsure or the topic is in escalateWhen, hand off to a human."
            ),
            "allowedTopics": list(profile.common_intents) or list(profile.products_and_services),
            "forbiddenTopics": ["legal advice", "internal employee data"],
            "escalateWhen": list(profile.escalation_topics)
            or ["billing disputes", "legal threats", "safety issues"],
            "language": profile.languages[0] if profile.languages else "English",
            "collectContactInfo": True,
            "handoffToHuman": True,
            "maxAutonomyTurns": 6,
        },
        selected_tone_id=selected_tone_id,
    )
