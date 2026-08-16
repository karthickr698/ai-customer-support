"""Prompt template selection for orchestration. No provider SDKs."""

from app.domain.orchestration import SupportIntent
from app.prompts.orchestration import (
    INTENT_GUIDANCE,
    orchestrate_turn_system_prompt,
)
from app.prompts.support_reply import support_reply_system_prompt


def render_support_system_prompt(
    *,
    intent: SupportIntent,
    json_mode: bool,
    assistant_name: str,
    greeting: str,
    instructions: str,
    language: str,
    allowed_topics: tuple[str, ...],
    forbidden_topics: tuple[str, ...],
    escalate_when: tuple[str, ...],
    knowledge_context: str,
    policy_instructions: str = "",
) -> str:
    if json_mode:
        prompt = orchestrate_turn_system_prompt(
            intent=intent,
            assistant_name=assistant_name,
            greeting=greeting,
            instructions=instructions,
            language=language,
            allowed_topics=allowed_topics,
            forbidden_topics=forbidden_topics,
            escalate_when=escalate_when,
            knowledge_context=knowledge_context,
        )
    else:
        base = support_reply_system_prompt(
            assistant_name=assistant_name,
            greeting=greeting,
            instructions=instructions,
            language=language,
            allowed_topics=allowed_topics,
            forbidden_topics=forbidden_topics,
            escalate_when=escalate_when,
            knowledge_context=knowledge_context,
        )
        prompt = f"{base} Intent={intent}. {INTENT_GUIDANCE[intent]}"
    extra = policy_instructions.strip()
    if extra:
        return f"{prompt} Response policy: {extra}"
    return prompt
