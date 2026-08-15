from collections.abc import Awaitable, Callable
from time import perf_counter
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.context import get_request_context
from app.evaluation.context import get_evaluation, reset_evaluation
from app.evaluation.score import score_evaluation

_SKIP = {"/health", "/docs", "/redoc", "/openapi.json"}

_OPERATIONS = {
    "/v1/onboarding/business-profile": "generate_business_profile",
    "/v1/onboarding/tone-presets": "generate_support_tone_presets",
    "/v1/onboarding/agent-settings": "generate_initial_agent_settings",
    "/v1/onboarding/setup": "run_onboarding_setup",
    "/v1/support/reply/stream": "generate_support_reply",
    "/v1/knowledge/ingest": "ingest_knowledge_document",
    "/v1/knowledge/index/delete": "delete_indexed_document",
    "/v1/orchestration/intent": "detect_intent",
    "/v1/orchestration/run": "orchestrate_support_turn",
    "/v1/tools/propose": "propose_tool_calls",
    "/v1/tools/apply-results": "apply_tool_results",
}


class ObservabilityMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        if request.url.path in _SKIP or request.method == "OPTIONS":
            return await call_next(request)

        started = perf_counter()
        response = await call_next(request)
        latency_ms = int((perf_counter() - started) * 1000)
        evaluation = get_evaluation() or score_evaluation(
            operation=_OPERATIONS.get(request.url.path, "http_request"),
            latency_ms=latency_ms,
            http_status=response.status_code,
            error=response.status_code >= 500,
        )
        context = get_request_context()
        trace_id = (context.trace_id if context and context.trace_id else None) or str(uuid4())
        span_id = (context.span_id if context and context.span_id else None) or str(uuid4())
        response.headers["x-trace-id"] = trace_id
        response.headers["x-span-id"] = span_id
        response.headers["x-ai-latency-ms"] = str(evaluation.latency_ms or latency_ms)
        response.headers["x-ai-operation"] = evaluation.operation
        response.headers["x-ai-eval-verdict"] = evaluation.verdict
        response.headers["x-ai-eval-score"] = f"{evaluation.score:.2f}"
        if evaluation.reason:
            response.headers["x-ai-eval-reason"] = evaluation.reason[:80]
        if evaluation.model:
            response.headers["x-ai-model"] = evaluation.model
        if evaluation.prompt_tokens:
            response.headers["x-ai-prompt-tokens"] = str(evaluation.prompt_tokens)
        if evaluation.completion_tokens:
            response.headers["x-ai-completion-tokens"] = str(evaluation.completion_tokens)
        if evaluation.input_guardrail:
            response.headers["x-ai-guardrail-in"] = evaluation.input_guardrail
        if evaluation.output_guardrail:
            response.headers["x-ai-guardrail-out"] = evaluation.output_guardrail
        if evaluation.citation_count:
            response.headers["x-ai-citations"] = str(evaluation.citation_count)
        reset_evaluation(None)
        return response
