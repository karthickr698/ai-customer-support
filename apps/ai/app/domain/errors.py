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


class TenantContextRequiredError(AIError):
    code = "TENANT_CONTEXT_REQUIRED"
    status_code = 400

    def __init__(self, message: str = "Tenant context is required") -> None:
        super().__init__(message)


class InvalidAIOutputError(AIError):
    code = "INVALID_AI_OUTPUT"
    status_code = 502

    def __init__(self, message: str = "The AI service returned an invalid payload") -> None:
        super().__init__(message)


class InvalidOnboardingInputError(AIError):
    code = "INVALID_ONBOARDING_INPUT"
    status_code = 400


class DocumentParseError(AIError):
    code = "DOCUMENT_PARSE_ERROR"
    status_code = 400

    def __init__(self, message: str = "The document could not be parsed") -> None:
        super().__init__(message)


class UnsupportedDocumentKindError(AIError):
    code = "UNSUPPORTED_DOCUMENT_KIND"
    status_code = 400

    def __init__(self, message: str = "This document type is not supported") -> None:
        super().__init__(message)


class EmptyDocumentError(AIError):
    code = "EMPTY_DOCUMENT"
    status_code = 400

    def __init__(self, message: str = "The document did not contain extractable text") -> None:
        super().__init__(message)


class UnsafeUrlError(AIError):
    code = "UNSAFE_URL"
    status_code = 400

    def __init__(self, message: str = "This URL cannot be fetched for ingestion") -> None:
        super().__init__(message)


class InvalidIngestionInputError(AIError):
    code = "INVALID_INGESTION_INPUT"
    status_code = 400


class InvalidRetrievalInputError(AIError):
    code = "INVALID_RETRIEVAL_INPUT"
    status_code = 400


class InvalidOrchestrationInputError(AIError):
    code = "INVALID_ORCHESTRATION_INPUT"
    status_code = 400


class VectorIndexError(AIError):
    code = "VECTOR_INDEX_ERROR"
    status_code = 502

    def __init__(self, message: str = "The vector index is unavailable") -> None:
        super().__init__(message)


class InvalidToolCallError(AIError):
    code = "INVALID_TOOL_CALL"
    status_code = 400


class UnknownToolError(AIError):
    code = "UNKNOWN_TOOL"
    status_code = 400

    def __init__(self, message: str = "Unknown tool") -> None:
        super().__init__(message)
