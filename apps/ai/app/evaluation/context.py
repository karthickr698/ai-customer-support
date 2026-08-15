from contextvars import ContextVar, Token

from app.evaluation.result import EvaluationResult

_evaluation: ContextVar[EvaluationResult | None] = ContextVar("ai_evaluation", default=None)


def record_evaluation(result: EvaluationResult) -> Token[EvaluationResult | None]:
    return _evaluation.set(result.clamp())


def get_evaluation() -> EvaluationResult | None:
    return _evaluation.get()


def reset_evaluation(token: Token[EvaluationResult | None] | None) -> None:
    if token is not None:
        _evaluation.reset(token)
    else:
        _evaluation.set(None)
