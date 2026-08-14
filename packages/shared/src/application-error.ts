export abstract class ApplicationError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends ApplicationError {
  readonly code = 'VALIDATION_ERROR';
  readonly httpStatus = 400;
}

export class RateLimitExceededError extends ApplicationError {
  readonly code = 'RATE_LIMIT_EXCEEDED';
  readonly httpStatus = 429;
}

export class InfrastructureError extends ApplicationError {
  readonly code = 'INFRASTRUCTURE_ERROR';
  readonly httpStatus = 503;
}
