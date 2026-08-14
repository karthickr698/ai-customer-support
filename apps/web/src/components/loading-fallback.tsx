import { Spinner } from '@/components/ui/spinner';

export function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center gap-2 bg-background text-sm text-muted-foreground">
      <Spinner />
      Loading…
    </div>
  );
}
