import { isApiError } from '@/services/api-error';

export type FrontendDiagnostic = {
  readonly message: string;
  readonly requestId?: string;
  readonly route?: string;
  readonly occurredAt: string;
};

export function diagnosticFromError(error: unknown, route?: string): FrontendDiagnostic {
  return {
    message: error instanceof Error ? error.message : 'Unknown error',
    requestId: isApiError(error) ? error.requestId : undefined,
    route,
    occurredAt: new Date().toISOString(),
  };
}

export function reportFrontendIssue(error: unknown, context?: { readonly route?: string }): FrontendDiagnostic {
  const diagnostic = diagnosticFromError(error, context?.route);
  console.error('Frontend observability', diagnostic);
  return diagnostic;
}
