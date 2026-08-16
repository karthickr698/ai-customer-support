import { cn } from '@/lib/utils';
import type { AgentPresenceStatus } from '@ai-customer-support/contracts';

const COLORS: Record<AgentPresenceStatus, string> = {
  online: 'bg-emerald-500',
  away: 'bg-amber-500',
  busy: 'bg-rose-500',
  offline: 'bg-muted-foreground/50',
};

export function PresenceDot({
  status,
  className,
}: {
  readonly status: AgentPresenceStatus;
  readonly className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block size-2 shrink-0 rounded-full', COLORS[status], className)}
      title={status}
    />
  );
}
