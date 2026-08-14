import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { ErrorFallback } from '@/components/error-fallback';

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (isRouteErrorResponse(error)) {
    return new Error(error.statusText || `Request failed (${String(error.status)})`);
  }

  return new Error('An unexpected error occurred');
}

export function RouteError() {
  const error = useRouteError();

  return (
    <ErrorFallback
      error={toError(error)}
      onRetry={() => {
        window.location.assign('/');
      }}
    />
  );
}
