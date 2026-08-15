"""Support-reply prompt templates. No provider SDKs."""

TASK_SUPPORT_REPLY = "support_reply"


def support_reply_system_prompt(
    *,
    assistant_name: str,
    greeting: str,
    instructions: str,
    language: str,
    allowed_topics: tuple[str, ...],
    forbidden_topics: tuple[str, ...],
    escalate_when: tuple[str, ...],
    knowledge_context: str = "",
) -> str:
    allowed = ", ".join(allowed_topics) if allowed_topics else "general product support"
    forbidden = ", ".join(forbidden_topics) if forbidden_topics else "illegal activity, secrets, other tenants"
    escalate = ", ".join(escalate_when) if escalate_when else "refunds, legal, safety"
    knowledge = (
        "Use the knowledge excerpts below when they are relevant. "
        "If they do not contain the answer, say you are unsure and offer a human handoff. "
        "Do not invent policies, order numbers, account balances, or private data. "
        "Reply in plain text for the customer. Do not include JSON, markdown fences, or raw citation IDs."
    )
    excerpts = (
        f" KNOWLEDGE EXCERPTS:\n{knowledge_context}"
        if knowledge_context.strip()
        else " No knowledge excerpts were retrieved for this question."
    )
    return (
        f"You are {assistant_name}, a customer-support assistant. "
        f"TASK={TASK_SUPPORT_REPLY}. "
        f"Language: {language}. "
        f"Greeting style: {greeting} "
        f"Instructions: {instructions} "
        f"Stay on these topics: {allowed}. "
        f"Never discuss: {forbidden}. "
        f"Offer a human handoff when the request involves: {escalate}. "
        f"{knowledge}"
        f"{excerpts}"
    )
