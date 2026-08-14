import { ApplicationError } from '@ai-customer-support/shared';

export class AIProviderError extends ApplicationError {
  readonly code = 'AI_PROVIDER_ERROR';
  readonly httpStatus = 502;

  constructor(message = 'The AI service failed to complete the request') {
    super(message);
  }
}

export class InvalidAIPayloadError extends ApplicationError {
  readonly code = 'INVALID_AI_PAYLOAD';
  readonly httpStatus = 502;

  constructor(message = 'The AI service returned an invalid payload') {
    super(message);
  }
}

export class AIServiceUnavailableError extends ApplicationError {
  readonly code = 'AI_SERVICE_UNAVAILABLE';
  readonly httpStatus = 503;

  constructor(message = 'The AI service is unavailable') {
    super(message);
  }
}
