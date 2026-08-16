import { Button } from '@/components/ui/button';
import { DiagnosticDetails } from '@/components/ui/query-states';
import { diagnosticFromError } from '@/hooks/use-frontend-observability';
import { isApiError } from '@/services/api-error';

type ErrorFallbackProps = {
  readonly error: Error;
  readonly onRetry: () => void;
};

function errorMessage(error: Error): string {
  if (isApiError(error)) {
    return error.message;
  }

  return error.message || 'An unexpected error occurred';
}

export function ErrorFallback({ error, onRetry }: ErrorFallbackProps) {
  const diagnostic = diagnosticFromError(error, typeof window === 'undefined' ? undefined : window.location.pathname);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-foreground">
      <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="max-w-md text-center text-sm text-muted-foreground">{errorMessage(error)}</p>
      <DiagnosticDetails requestId={diagnostic.requestId} route={diagnostic.route} />
      <Button type="button" onClick={onRetry}>
        Try again
      </Button>
    </main>
  );
}
