import { useEffect, useState } from 'react';
import type { TicketSlaDto } from '@ai-customer-support/contracts';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SlaTimers({ sla }: { readonly sla: TicketSlaDto }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTick((value) => value + 1);
    }, 30_000);
    return () => {
      window.clearInterval(id);
    };
  }, []);

  return (
    <div className="flex flex-col gap-1.5 text-xs">
      <SlaRow
        dueAt={sla.firstResponseDueAt}
        doneAt={sla.firstRespondedAt}
        label="First response"
        paused={Boolean(sla.pausedAt)}
        breached={sla.breachKind === 'first_response'}
      />
      <SlaRow
        dueAt={sla.resolutionDueAt}
        doneAt={null}
        label="Resolution"
        paused={Boolean(sla.pausedAt)}
        breached={sla.breachKind === 'resolution'}
      />
    </div>
  );
}

function SlaRow({
  label,
  dueAt,
  doneAt,
  paused,
  breached,
}: {
  readonly label: string;
  readonly dueAt: string | null;
  readonly doneAt: string | null;
  readonly paused: boolean;
  readonly breached: boolean;
}) {
  const remaining = remainingLabel(dueAt, doneAt, paused, breached);

  return (
    <p
      className={cn(
        'flex items-center gap-1.5 text-muted-foreground',
        remaining.tone === 'danger' && 'text-destructive',
        remaining.tone === 'warning' && 'text-warning-foreground',
        remaining.tone === 'ok' && 'text-muted-foreground',
      )}
    >
      <Clock className="size-3.5 shrink-0" />
      <span className="font-medium">{label}</span>
      <span>{remaining.text}</span>
    </p>
  );
}

function remainingLabel(
  dueAt: string | null,
  doneAt: string | null,
  paused: boolean,
  breached: boolean,
): { text: string; tone: 'ok' | 'warning' | 'danger' } {
  if (doneAt) {
    return { text: 'Met', tone: 'ok' };
  }
  if (paused) {
    return { text: 'Paused', tone: 'warning' };
  }
  if (!dueAt) {
    return { text: 'No timer', tone: 'ok' };
  }
  if (breached) {
    return { text: `Overdue ${formatDistance(dueAt)}`, tone: 'danger' };
  }

  const due = new Date(dueAt).getTime();
  const now = Date.now();
  if (Number.isNaN(due)) {
    return { text: 'Unknown', tone: 'ok' };
  }
  if (due <= now) {
    return { text: `Overdue ${formatMs(now - due)}`, tone: 'danger' };
  }

  const left = due - now;
  return { text: `${formatMs(left)} left`, tone: left < 30 * 60_000 ? 'warning' : 'ok' };
}

function formatDistance(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return '';
  }
  return formatMs(Math.abs(Date.now() - then));
}

function formatMs(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) {
    return `${String(minutes)}m`;
  }
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (hours < 24) {
    return rem === 0 ? `${String(hours)}h` : `${String(hours)}h ${String(rem)}m`;
  }
  const days = Math.floor(hours / 24);
  return `${String(days)}d`;
}
