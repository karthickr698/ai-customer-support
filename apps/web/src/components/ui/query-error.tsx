import { RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export function QueryErrorAlert({
  title,
  message,
  onRetry,
  pending = false,
  requestId,
}: {
  readonly title: string;
  readonly message: string;
  readonly onRetry: () => void;
  readonly pending?: boolean;
  readonly requestId?: string;
}) {
  return (
    <Alert variant="destructive">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="space-y-1">
          <span className="block">{message}</span>
          {requestId ? (
            <span className="block font-mono text-xs text-muted-foreground">Request {requestId}</span>
          ) : null}
        </span>
        <Button onClick={onRetry} size="sm" type="button" variant="outline">
          {pending ? <Spinner label="Retrying" /> : <RefreshCw className="size-4" />}
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );
}
