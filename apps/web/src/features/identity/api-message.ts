import { ApiError } from '@/services/api-error';

export function toApiMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}
