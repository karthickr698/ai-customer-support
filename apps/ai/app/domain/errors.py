class AIError(Exception):
    """Base application/domain error for the AI service."""

    code: str = "AI_ERROR"
    status_code: int = 400

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class ConfigurationError(AIError):
    code = "CONFIGURATION_ERROR"
    status_code = 500


class AIProviderError(AIError):
    code = "AI_PROVIDER_ERROR"
    status_code = 502


class RateLimitExceededError(AIError):
    code = "RATE_LIMIT_EXCEEDED"
    status_code = 429
