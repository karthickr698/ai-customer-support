import {
  DomainError,
  RateLimitExceededError,
  ValidationError,
} from '@ai-customer-support/shared';
import { describe, expect, it } from 'vitest';
import { mapErrorToHttpResponse } from '../../../apps/api/src/shared/adapters/inbound/http/error-handler.ts';

class ExampleDomainError extends DomainError {
  readonly code = 'EXAMPLE_ERROR';
}

describe('mapErrorToHttpResponse', () => {
  it('maps domain errors using their HTTP status and code', () => {
    const mapped = mapErrorToHttpResponse(new ExampleDomainError('invalid state', 409));

    expect(mapped.statusCode).toBe(409);
    expect(mapped.body).toEqual({
      error: { code: 'EXAMPLE_ERROR', message: 'invalid state' },
    });
  });

  it('maps application errors using their HTTP status and code', () => {
    expect(mapErrorToHttpResponse(new ValidationError('bad input'))).toMatchObject({
      statusCode: 400,
      body: { error: { code: 'VALIDATION_ERROR' } },
    });
    expect(mapErrorToHttpResponse(new RateLimitExceededError('slow down'))).toMatchObject({
      statusCode: 429,
      body: { error: { code: 'RATE_LIMIT_EXCEEDED' } },
    });
  });

  it('does not leak internal details for unexpected errors', () => {
    const mapped = mapErrorToHttpResponse(new Error('prisma connection secret=abc'));

    expect(mapped.statusCode).toBe(500);
    expect(mapped.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  });
});
