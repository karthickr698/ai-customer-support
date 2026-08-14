import type { ApiErrorBody } from '@/types/api';

export class ApiError extends Error {
  public override readonly name = 'ApiError';
  readonly status: number;
  readonly code: string;
  readonly requestId: string | undefined;

  constructor(params: {
    message: string;
    status: number;
    code: string;
    requestId?: string;
  }) {
    super(params.message);
    this.status = params.status;
    this.code = params.code;
    this.requestId = params.requestId;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) {
    return false;
  }

  const body = value.error;
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  return (
    'code' in body &&
    'message' in body &&
    typeof body.code === 'string' &&
    typeof body.message === 'string'
  );
}
