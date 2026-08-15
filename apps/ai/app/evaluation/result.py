from dataclasses import dataclass
from typing import Literal

EvaluationVerdict = Literal["passed", "degraded", "failed"]


@dataclass(frozen=True, slots=True)
class EvaluationResult:
    verdict: EvaluationVerdict
    score: float
    reason: str | None = None
    operation: str = "http_request"
    model: str | None = None
    latency_ms: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    input_guardrail: str | None = None
    output_guardrail: str | None = None
    citation_count: int = 0

    def clamp(self) -> "EvaluationResult":
        score = 0.0 if self.score < 0 else 1.0 if self.score > 1 else self.score
        if score == self.score:
            return self
        return EvaluationResult(
            verdict=self.verdict,
            score=score,
            reason=self.reason,
            operation=self.operation,
            model=self.model,
            latency_ms=self.latency_ms,
            prompt_tokens=self.prompt_tokens,
            completion_tokens=self.completion_tokens,
            input_guardrail=self.input_guardrail,
            output_guardrail=self.output_guardrail,
            citation_count=self.citation_count,
        )
