import { Spinner } from '@/components/ui/spinner';

export function SessionLoading({ label = 'Checking your session' }: { readonly label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner label={label} />
        {label}…
      </p>
    </div>
  );
}
