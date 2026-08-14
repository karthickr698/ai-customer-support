"""Deterministic onboarding completions for local development without an LLM key."""

from __future__ import annotations

import json
import re

from app.application.ports.llm_port import (
    LLMCompletionRequest,
    LLMCompletionResult,
    LLMPort,
    LLMStreamChunk,
)
from app.domain.onboarding import (
    SUPPORT_TONE_IDS,
    AgentSettings,
    BusinessProfile,
    SupportTonePreset,
    recommended_tone_id,
)
from app.prompts.onboarding import (
    TASK_AGENT_SETTINGS,
    TASK_BUSINESS_PROFILE,
    TASK_TONE_PRESETS,
    seed_agent_settings,
)

_TASK = re.compile(r"TASK=([a-z_]+)")

_TONE_COPY: dict[str, tuple[str, str, str]] = {
    "professional": (
        "Professional",
        "Clear, formal, and precise. Avoid slang.",
        "Thank you for contacting us. I can help you with that right away.",
    ),
    "friendly": (
        "Friendly",
        "Warm and approachable while remaining helpful.",
        "Happy to help! Let me take a look at that for you.",
    ),
    "empathetic": (
        "Empathetic",
        "Acknowledge frustration first, then solve the issue.",
        "I'm sorry this has been frustrating. Let's get it sorted together.",
    ),
    "concise": (
        "Concise",
        "Short answers with the next action first.",
        "Got it. Here's the fastest way to fix this:",
    ),
    "playful": (
        "Playful",
        "Light personality without undermining trust or safety.",
        "On it! We'll have this wrapped up in a moment.",
    ),
}


class HeuristicLLMAdapter(LLMPort):
    async def complete(self, request: LLMCompletionRequest) -> LLMCompletionResult:
        system = next((message.content for message in request.messages if message.role == "system"), "")
        user = next((message.content for message in reversed(request.messages) if message.role == "user"), "{}")
        task_match = _TASK.search(system)
        task = task_match.group(1) if task_match else TASK_BUSINESS_PROFILE
        payload = _parse_user(user)

        if task == TASK_TONE_PRESETS:
            profile = _profile_from_payload(payload)
            content = json.dumps({"items": [preset.to_dict() for preset in _tones_for(profile)]})
        elif task == TASK_AGENT_SETTINGS:
            profile = _profile_from_payload(payload)
            selected = payload.get("selectedToneId")
            tone = selected if selected in SUPPORT_TONE_IDS else recommended_tone_id(_tones_for(profile))
            settings = seed_agent_settings(profile, tone)  # type: ignore[arg-type]
            content = json.dumps(_with_knowledge(settings, payload))
        else:
            content = json.dumps(_profile_from_payload(payload).to_dict())

        return LLMCompletionResult(
            content=content,
            model="heuristic",
            prompt_tokens=0,
            completion_tokens=0,
        )

    async def stream(self, request: LLMCompletionRequest):
        system = next((message.content for message in request.messages if message.role == "system"), "")
        if "TASK=support_reply" in system:
            user = next(
                (message.content for message in reversed(request.messages) if message.role == "user"),
                "Hello",
            )
            content = _support_reply(user)
            words = content.split(" ")
            assembled: list[str] = []
            for index, word in enumerate(words):
                piece = word if index == 0 else f" {word}"
                assembled.append(piece)
                yield LLMStreamChunk(delta=piece)
            result = LLMCompletionResult(
                content="".join(assembled),
                model="heuristic",
                prompt_tokens=0,
                completion_tokens=0,
            )
            yield LLMStreamChunk(delta="", done=True, result=result)
            return

        result = await self.complete(request)
        yield LLMStreamChunk(delta=result.content, done=True, result=result)


def _support_reply(user: str) -> str:
    snippet = user.strip().split("\n")[-1][:120]
    return (
        "Thanks for reaching out. I can help with that. "
        f"I received: {snippet or 'your message'}. "
        "If this needs a human teammate, say the word and I'll hand it off."
    )


def _parse_user(raw: str) -> dict[str, object]:
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {"description": raw}
    return parsed if isinstance(parsed, dict) else {"description": raw}


def _profile_from_payload(payload: dict[str, object]) -> BusinessProfile:
    nested = payload.get("businessProfile")
    if isinstance(nested, dict):
        source = nested
    else:
        source = payload
    description = str(source.get("description") or payload.get("description") or "Customer support for this business.")
    company = str(source.get("companyName") or payload.get("companyName") or "Your company")
    industry = str(source.get("industry") or payload.get("industry") or "General")
    website = source.get("websiteUrl") or payload.get("websiteUrl")
    return BusinessProfile.from_mapping(
        {
            "schemaVersion": 1,
            "companyName": company,
            "industry": industry,
            "description": description,
            "productsAndServices": source.get("productsAndServices") or ["Support"],
            "targetAudience": source.get("targetAudience") or "Customers",
            "supportChannels": source.get("supportChannels") or ["chat", "email"],
            "commonIntents": source.get("commonIntents")
            or ["order status", "account help", "product questions"],
            "escalationTopics": source.get("escalationTopics")
            or ["refunds", "legal requests", "safety issues"],
            "brandValues": source.get("brandValues") or ["helpfulness", "clarity"],
            "languages": source.get("languages") or ["English"],
            "hoursOfOperation": source.get("hoursOfOperation"),
            "websiteUrl": website,
        }
    )


def _tones_for(profile: BusinessProfile) -> tuple[SupportTonePreset, ...]:
    example_topic = profile.products_and_services[0] if profile.products_and_services else "your request"
    presets: list[SupportTonePreset] = []
    for tone_id in SUPPORT_TONE_IDS:
        name, guidelines, reply = _TONE_COPY[tone_id]
        presets.append(
            SupportTonePreset(
                id=tone_id,
                name=name,
                description=f"{name} support voice for {profile.company_name}.",
                voice_guidelines=guidelines,
                example_reply=f"{reply} I can help with {example_topic}.",
                recommended=tone_id == "friendly",
            )
        )
    return tuple(presets)


def _with_knowledge(settings: AgentSettings, payload: dict[str, object]) -> dict[str, object]:
    data = settings.to_dict()
    sources = payload.get("knowledgeSources")
    if isinstance(sources, list) and sources:
        names = [
            str(item.get("name"))
            for item in sources
            if isinstance(item, dict) and item.get("name")
        ]
        if names:
            data["systemInstructions"] = (
                f"{data['systemInstructions']} Prefer registered knowledge sources: {', '.join(names)}."
            )
    return data
