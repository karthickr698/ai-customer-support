export class WidgetApiError extends Error {
  public override readonly name = 'WidgetApiError';

  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function isWidgetApiError(error: unknown): error is WidgetApiError {
  return error instanceof WidgetApiError;
}

export function isErrorBody(value: unknown): value is { error: { code: string; message: string } } {
  if (typeof value !== 'object' || value === null || !('error' in value)) {
    return false;
  }

  const body = (value as { error: unknown }).error;
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  return (
    'code' in body &&
    'message' in body &&
    typeof (body as { code: unknown }).code === 'string' &&
    typeof (body as { message: unknown }).message === 'string'
  );
}
