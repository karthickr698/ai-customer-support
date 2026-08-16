"""Tenant-owned AI agent runtime configuration. No FastAPI or provider SDKs."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Mapping

from app.domain.orchestration import ModelRoute, SAFE_FALLBACK_REPLY
from app.domain.tools import TOOL_NAMES, ToolName, parse_tool_name

FallbackMode = Literal["provider_then_heuristic", "canned_reply", "handoff"]
CitationPolicy = Literal["required", "preferred", "off"]

FALLBACK_MODES: tuple[FallbackMode, ...] = (
    "provider_then_heuristic",
    "canned_reply",
    "handoff",
)
CITATION_POLICIES: tuple[CitationPolicy, ...] = ("required", "preferred", "off")
HANDOFF_REPLY = "I am connecting you with a teammate who can help with this."
UNKNOWN_REPLY = (
    "I do not have enough information in the knowledge base to answer that. "
    "I can connect you with a teammate."
)


@dataclass(frozen=True, slots=True)
class AgentRuntimeConfig:
    model: str | None = None
    quality_model: str | None = None
    temperature: float | None = None
    max_output_tokens: int | None = None
    max_input_tokens: int | None = None
    system_prompt: str = ""
    enabled_tools: tuple[ToolName, ...] | None = None
    fallback_mode: FallbackMode = "provider_then_heuristic"
    fallback_reply: str | None = None
    fallback_max_retries: int | None = None
    citation_policy: CitationPolicy = "preferred"
    refuse_unknown: bool = True
    refuse_off_topic: bool = True
    language_lock: bool = True
    redact_pii: bool = False

    def merged_instructions(self, instructions: str) -> str:
        extra = self.system_prompt.strip()
        if not extra:
            return instructions
        return f"{instructions}\n\nOperator prompt:\n{extra}"

    def policy_instructions(self) -> str:
        parts: list[str] = []
        if self.citation_policy == "required":
            parts.append(
                "Only answer from the knowledge excerpts. If they do not contain the answer, say you are unsure."
            )
        elif self.citation_policy == "off":
            parts.append("Do not mention sources or citations in the customer-facing reply.")
        else:
            parts.append("Prefer knowledge excerpts when they are relevant.")
        if self.refuse_unknown:
            parts.append("Do not invent policies, prices, order numbers, or account data.")
        if self.refuse_off_topic:
            parts.append("Decline off-topic requests and offer a human handoff.")
        if self.language_lock:
            parts.append("Reply only in the configured language.")
        if self.redact_pii:
            parts.append("Do not echo emails, phone numbers, or other personal identifiers.")
        return " ".join(parts)

    def apply_route(self, route: ModelRoute) -> ModelRoute:
        model = route.model
        if route.name == "quality":
            chosen = (self.quality_model or self.model or "").strip()
            if chosen:
                model = chosen
        else:
            chosen = (self.model or "").strip()
            if chosen:
                model = chosen
        temperature = self.temperature if self.temperature is not None else route.temperature
        return ModelRoute(
            name=route.name,
            model=model,
            temperature=temperature,
            retrieve=route.retrieve,
            json_mode=route.json_mode,
        )

    def safe_reply(self, *, reason: str) -> str:
        del reason
        if self.fallback_mode == "handoff":
            return HANDOFF_REPLY
        canned = (self.fallback_reply or "").strip()
        if canned:
            return canned
        return SAFE_FALLBACK_REPLY


def parse_agent_runtime_config(raw: Mapping[str, object] | None) -> AgentRuntimeConfig | None:
    if raw is None:
        return None
    tools_raw = raw.get("enabledTools")
    enabled: tuple[ToolName, ...] | None = None
    if isinstance(tools_raw, list):
        enabled = tuple(parse_tool_name(str(item)) for item in tools_raw)
    elif tools_raw is None:
        enabled = TOOL_NAMES
    fallback_mode = raw.get("fallbackMode")
    citation_policy = raw.get("citationPolicy")
    return AgentRuntimeConfig(
        model=_optional_str(raw.get("model")),
        quality_model=_optional_str(raw.get("qualityModel")),
        temperature=_optional_float(raw.get("temperature")),
        max_output_tokens=_optional_int(raw.get("maxOutputTokens")),
        max_input_tokens=_optional_int(raw.get("maxInputTokens")),
        system_prompt=str(raw.get("systemPrompt") or ""),
        enabled_tools=enabled,
        fallback_mode=fallback_mode if fallback_mode in FALLBACK_MODES else "provider_then_heuristic",
        fallback_reply=_optional_str(raw.get("fallbackReply")),
        fallback_max_retries=_optional_int(raw.get("fallbackMaxRetries")),
        citation_policy=citation_policy if citation_policy in CITATION_POLICIES else "preferred",
        refuse_unknown=_optional_bool(raw.get("refuseUnknown"), True),
        refuse_off_topic=_optional_bool(raw.get("refuseOffTopic"), True),
        language_lock=_optional_bool(raw.get("languageLock"), True),
        redact_pii=_optional_bool(raw.get("redactPii"), False),
    )


def _optional_str(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    trimmed = value.strip()
    return trimmed or None


def _optional_float(value: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    number = float(value)
    if number < 0 or number > 2:
        return None
    return number


def _optional_int(value: object) -> int | None:
    if isinstance(value, bool) or not isinstance(value, int):
        return None
    return value


def _optional_bool(value: object, default: bool) -> bool:
    if isinstance(value, bool):
        return value
    return default
