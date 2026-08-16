import { Skeleton } from './skeleton';

export function QueryLoading({ className = 'h-40 w-full' }: { readonly className?: string }) {
  return <Skeleton className={className} />;
}

export function DiagnosticDetails({
  requestId,
  route,
}: {
  readonly requestId?: string;
  readonly route?: string;
}) {
  if (!requestId && !route) {
    return null;
  }

  return (
    <p className="font-mono text-xs text-muted-foreground">
      {requestId ? `Request ${requestId}` : null}
      {requestId && route ? ' · ' : null}
      {route ? `Route ${route}` : null}
    </p>
  );
}
