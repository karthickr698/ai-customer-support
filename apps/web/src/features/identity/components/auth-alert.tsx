import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function AuthAlert({
  title,
  message,
  variant = 'destructive',
}: {
  readonly title?: string;
  readonly message?: string;
  readonly variant?: 'destructive' | 'success' | 'info';
}) {
  if (!message) {
    return null;
  }

  return (
    <Alert variant={variant}>
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
