import { err, ok } from '@ai-customer-support/shared';
import { describe, expect, it } from 'vitest';

describe('Result', () => {
  it('creates an ok result', () => {
    const result = ok(42);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(42);
    }
  });

  it('creates an error result', () => {
    const result = err('failed');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('failed');
    }
  });
});
