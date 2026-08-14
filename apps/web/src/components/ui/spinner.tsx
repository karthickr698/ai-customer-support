import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type SpinnerProps = {
  readonly className?: string;
  readonly label?: string;
};

export function Spinner({ className, label = 'Loading' }: SpinnerProps) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2 text-muted-foreground', className)}>
      <Loader2 className="size-4 animate-spin" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
