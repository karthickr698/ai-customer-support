from app.domain.errors import InvalidToolCallError, UnknownToolError
from app.domain.tools import validate_tool_arguments
from app.application.use_cases.propose_tool_calls_use_case import parse_proposed_calls


def test_validates_allowlisted_tool_arguments() -> None:
    call = validate_tool_arguments(
        "handoffToAgent",
        {
            "conversationId": "11111111-1111-1111-1111-111111111111",
            "reason": "Customer asked for a human",
        },
    )
    assert call.name == "handoffToAgent"
    assert call.arguments["reason"] == "Customer asked for a human"


def test_rejects_unknown_tools_and_extra_properties() -> None:
    try:
        validate_tool_arguments("dropDatabase", {})
        raise AssertionError("expected UnknownToolError")
    except UnknownToolError:
        pass

    try:
        validate_tool_arguments("getOrderDetails", {"orderId": "ORD-1", "inject": True})
        raise AssertionError("expected InvalidToolCallError")
    except InvalidToolCallError:
        pass


def test_parse_proposed_calls_filters_allowlist() -> None:
    calls, reason = parse_proposed_calls(
        '{"calls":[{"name":"getOrderDetails","arguments":{"orderId":"A-1"}}],"reason":null}',
        ("getOrderDetails",),
    )
    assert len(calls) == 1
    assert calls[0].name == "getOrderDetails"
    assert reason is None

    try:
        parse_proposed_calls(
            '{"calls":[{"name":"createTicket","arguments":{}}],"reason":null}',
            ("getOrderDetails",),
        )
        raise AssertionError("expected InvalidToolCallError")
    except InvalidToolCallError:
        pass
