import { ValidationError } from '@ai-customer-support/shared';
import type { z } from 'zod';

export function parseBody<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ValidationError(issue?.message ?? 'Request validation failed');
  }
  return result.data;
}
