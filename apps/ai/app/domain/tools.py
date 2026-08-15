"""Allowlisted tool schemas. Python proposes and validates; TypeScript executes."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal, Mapping
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

from app.domain.errors import InvalidToolCallError, UnknownToolError

TOOL_CALL_SCHEMA_VERSION = 1
ToolName = Literal[
    "getCustomerDetails",
    "getOrderDetails",
    "createTicket",
    "updateTicket",
    "checkRefundStatus",
    "handoffToAgent",
]
TOOL_NAMES: tuple[ToolName, ...] = (
    "getCustomerDetails",
    "getOrderDetails",
    "createTicket",
    "updateTicket",
    "checkRefundStatus",
    "handoffToAgent",
)


class _StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class GetCustomerDetailsArgs(_StrictModel):
    customerId: str | None = Field(default=None)
    email: str | None = Field(default=None, max_length=254)

    @model_validator(mode="after")
    def require_identity(self) -> GetCustomerDetailsArgs:
        if not self.customerId and not self.email:
            raise ValueError("Provide customerId or email")
        if self.customerId:
            UUID(self.customerId)
        return self


class GetOrderDetailsArgs(_StrictModel):
    orderId: str = Field(min_length=1, max_length=80)


class CreateTicketArgs(_StrictModel):
    conversationId: str
    subject: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=8_000)
    priority: Literal["low", "normal", "high", "urgent"] | None = None

    @model_validator(mode="after")
    def require_uuid(self) -> CreateTicketArgs:
        UUID(self.conversationId)
        return self


class UpdateTicketArgs(_StrictModel):
    ticketId: str
    status: Literal["open", "pending", "resolved", "closed"] | None = None
    note: str | None = Field(default=None, min_length=1, max_length=4_000)

    @model_validator(mode="after")
    def require_change(self) -> UpdateTicketArgs:
        UUID(self.ticketId)
        if not self.status and not self.note:
            raise ValueError("Provide a status or note")
        return self


class CheckRefundStatusArgs(_StrictModel):
    orderId: str = Field(min_length=1, max_length=80)
    refundId: str | None = Field(default=None, min_length=1, max_length=80)


class HandoffToAgentArgs(_StrictModel):
    conversationId: str
    reason: str = Field(min_length=1, max_length=1_000)

    @model_validator(mode="after")
    def require_uuid(self) -> HandoffToAgentArgs:
        UUID(self.conversationId)
        return self


ARGUMENT_MODELS: dict[ToolName, type[BaseModel]] = {
    "getCustomerDetails": GetCustomerDetailsArgs,
    "getOrderDetails": GetOrderDetailsArgs,
    "createTicket": CreateTicketArgs,
    "updateTicket": UpdateTicketArgs,
    "checkRefundStatus": CheckRefundStatusArgs,
    "handoffToAgent": HandoffToAgentArgs,
}

TOOL_DESCRIPTIONS: dict[ToolName, str] = {
    "getCustomerDetails": "Look up a tenant-scoped customer by id or email.",
    "getOrderDetails": "Fetch order details from the tenant commerce connector.",
    "createTicket": "Open a support ticket. TypeScript executes this mutation.",
    "updateTicket": "Update ticket status or add a note. TypeScript executes this mutation.",
    "checkRefundStatus": "Check refund status through the tenant commerce connector.",
    "handoffToAgent": "Request a human handoff for the conversation.",
}


@dataclass(frozen=True, slots=True)
class ProposedToolCall:
    name: ToolName
    arguments: dict[str, Any]

    def to_dict(self) -> dict[str, object]:
        return {"name": self.name, "arguments": self.arguments}


@dataclass(frozen=True, slots=True)
class ToolCallResult:
    name: ToolName
    ok: bool
    data: dict[str, Any] | None
    error_code: str | None
    error_message: str | None

    def to_dict(self) -> dict[str, object]:
        return {
            "name": self.name,
            "ok": self.ok,
            "data": self.data,
            "errorCode": self.error_code,
            "errorMessage": self.error_message,
        }


def parse_tool_name(value: str) -> ToolName:
    if value not in TOOL_NAMES:
        raise UnknownToolError(f"Unknown tool: {value}")
    return value  # type: ignore[return-value]


def validate_tool_arguments(name: str, arguments: Mapping[str, Any] | object) -> ProposedToolCall:
    tool_name = parse_tool_name(name)
    if not isinstance(arguments, Mapping):
        raise InvalidToolCallError("Tool arguments must be an object")
    model = ARGUMENT_MODELS[tool_name]
    try:
        parsed = model.model_validate(dict(arguments))
    except (ValidationError, ValueError) as exc:
        raise InvalidToolCallError(f"Invalid arguments for {tool_name}") from exc
    return ProposedToolCall(name=tool_name, arguments=parsed.model_dump(exclude_none=True))


def parse_tool_result(payload: Mapping[str, Any]) -> ToolCallResult:
    name = parse_tool_name(str(payload.get("name") or ""))
    ok = payload.get("ok")
    if not isinstance(ok, bool):
        raise InvalidToolCallError("Tool result ok must be a boolean")
    data = payload.get("data")
    if data is not None and not isinstance(data, dict):
        raise InvalidToolCallError("Tool result data must be an object or null")
    error_code = payload.get("errorCode")
    error_message = payload.get("errorMessage")
    if error_code is not None and not isinstance(error_code, str):
        raise InvalidToolCallError("errorCode must be a string or null")
    if error_message is not None and not isinstance(error_message, str):
        raise InvalidToolCallError("errorMessage must be a string or null")
    return ToolCallResult(
        name=name,
        ok=ok,
        data=data,
        error_code=error_code,
        error_message=error_message,
    )


def catalog_payload() -> list[dict[str, object]]:
    items: list[dict[str, object]] = []
    for name in TOOL_NAMES:
        items.append(
            {
                "name": name,
                "description": TOOL_DESCRIPTIONS[name],
                "argumentSchema": ARGUMENT_MODELS[name].model_json_schema(),
            }
        )
    return items
