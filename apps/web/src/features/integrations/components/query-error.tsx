import { RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export function QueryErrorAlert({
  title,
  message,
  onRetry,
  pending = false,
}: {
  readonly title: string;
  readonly message: string;
  readonly onRetry: () => void;
  readonly pending?: boolean;
}) {
  return (
    <Alert variant="destructive">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>{message}</span>
        <Button onClick={onRetry} size="sm" type="button" variant="outline">
          {pending ? <Spinner label="Retrying" /> : <RefreshCw className="size-4" />}
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );
}
