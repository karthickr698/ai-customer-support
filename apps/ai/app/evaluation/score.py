from app.evaluation.result import EvaluationResult, EvaluationVerdict


def score_evaluation(
    *,
    operation: str,
    latency_ms: int = 0,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    citation_count: int = 0,
    input_guardrail: str | None = None,
    output_guardrail: str | None = None,
    used_fallback: bool = False,
    model: str | None = None,
    http_status: int | None = None,
    error: bool = False,
) -> EvaluationResult:
    if error or (http_status is not None and http_status >= 500):
        return EvaluationResult(
            verdict="failed",
            score=0.0,
            reason="provider_or_http_error",
            operation=operation,
            model=model,
            latency_ms=latency_ms,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            input_guardrail=input_guardrail,
            output_guardrail=output_guardrail,
            citation_count=citation_count,
        ).clamp()

    if input_guardrail == "blocked":
        return EvaluationResult(
            verdict="failed",
            score=0.0,
            reason="input_guardrail_blocked",
            operation=operation,
            model=model or "guardrail",
            latency_ms=latency_ms,
            input_guardrail=input_guardrail,
            output_guardrail=output_guardrail,
        ).clamp()

    if output_guardrail == "blocked":
        return EvaluationResult(
            verdict="failed",
            score=0.2,
            reason="output_guardrail_blocked",
            operation=operation,
            model=model,
            latency_ms=latency_ms,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            input_guardrail=input_guardrail,
            output_guardrail=output_guardrail,
            citation_count=citation_count,
        ).clamp()

    score = 1.0
    reason: str | None = None
    verdict: EvaluationVerdict = "passed"
    if used_fallback:
        score -= 0.4
        reason = "fallback_reply"
        verdict = "degraded"
    if citation_count == 0 and completion_tokens > 0 and operation in {
        "generate_support_reply",
        "orchestrate_support_turn",
    }:
        score -= 0.15
        reason = reason or "ungrounded_reply"
        if score < 0.7:
            verdict = "degraded"
    if latency_ms > 8000:
        score -= 0.2
        reason = reason or "high_latency"
        verdict = "degraded" if verdict == "passed" else verdict
    elif latency_ms > 3000:
        score -= 0.1

    if score < 0.4:
        verdict = "failed"
    elif score < 0.7:
        verdict = "degraded"

    return EvaluationResult(
        verdict=verdict,
        score=score,
        reason=reason,
        operation=operation,
        model=model,
        latency_ms=latency_ms,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        input_guardrail=input_guardrail,
        output_guardrail=output_guardrail,
        citation_count=citation_count,
    ).clamp()
