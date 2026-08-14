import { DomainError } from '@ai-customer-support/shared';
import { describe, expect, it } from 'vitest';

class ExampleError extends DomainError {
  readonly code = 'EXAMPLE_ERROR';
}

class ConflictExampleError extends DomainError {
  readonly code = 'EXAMPLE_CONFLICT';

  constructor(message: string) {
    super(message, 409);
  }
}

describe('DomainError', () => {
  it('exposes a stable code and message', () => {
    const error = new ExampleError('something went wrong');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('EXAMPLE_ERROR');
    expect(error.message).toBe('something went wrong');
    expect(error.name).toBe('ExampleError');
    expect(error.httpStatus).toBe(400);
  });

  it('allows subclasses to set an HTTP status', () => {
    const error = new ConflictExampleError('already exists');

    expect(error.httpStatus).toBe(409);
  });
});
