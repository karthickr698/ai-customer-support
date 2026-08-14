import {
  ApplicationError,
  InfrastructureError,
  RateLimitExceededError,
  ValidationError,
} from '@ai-customer-support/shared';
import { describe, expect, it } from 'vitest';

describe('ApplicationError', () => {
  it('maps validation failures to HTTP 400', () => {
    const error = new ValidationError('invalid payload');

    expect(error).toBeInstanceOf(ApplicationError);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.httpStatus).toBe(400);
    expect(error.name).toBe('ValidationError');
  });

  it('maps rate limit failures to HTTP 429', () => {
    const error = new RateLimitExceededError('too many requests');

    expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(error.httpStatus).toBe(429);
    expect(new RateLimitExceededError('slow down', 30).retryAfterSeconds).toBe(30);
  });

  it('maps infrastructure failures to HTTP 503', () => {
    const error = new InfrastructureError('database unavailable');

    expect(error.code).toBe('INFRASTRUCTURE_ERROR');
    expect(error.httpStatus).toBe(503);
  });
});
