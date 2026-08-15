"""Tool-calling prompt templates. No provider SDKs."""

from app.domain.tools import TOOL_DESCRIPTIONS, TOOL_NAMES, catalog_payload

TASK_PROPOSE_TOOLS = "propose_tools"
TASK_APPLY_TOOL_RESULTS = "apply_tool_results"


def propose_tools_system_prompt(*, allowed_tools: tuple[str, ...] | None = None) -> str:
    names = allowed_tools if allowed_tools else TOOL_NAMES
    lines = [f"- {name}: {TOOL_DESCRIPTIONS[name]}" for name in names if name in TOOL_DESCRIPTIONS]
    schemas = catalog_payload()
    allowed = [item for item in schemas if item["name"] in names]
    return (
        "You propose customer-support tool calls. Never invent secrets or cross-tenant ids. "
        f"TASK={TASK_PROPOSE_TOOLS}. "
        "Return JSON: {\"calls\": [{\"name\": string, \"arguments\": object}], \"reason\": string|null}. "
        "If no tool is needed, return an empty calls array. "
        "Only use allowlisted tools:\n"
        + "\n".join(lines)
        + f" Schemas={allowed}"
    )


def apply_tool_results_system_prompt() -> str:
    return (
        "You write a customer-facing support reply after authorized tool results. "
        f"TASK={TASK_APPLY_TOOL_RESULTS}. "
        "Use only the supplied tool results. Never invent order numbers, balances, or private data. "
        "JSON keys: reply (string). Do not include markdown commentary."
    )
