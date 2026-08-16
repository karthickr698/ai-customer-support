import type { TicketPriority, TicketSlaDto, TicketStatus } from '@ai-customer-support/contracts';
import { Badge } from '@/components/ui/badge';
import { TICKET_PRIORITY_LABELS, TICKET_STATUS_LABELS } from '../labels';

const STATUS_VARIANT: Record<TicketStatus, 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive'> =
  {
    open: 'default',
    pending: 'warning',
    resolved: 'success',
    closed: 'secondary',
    escalated: 'destructive',
  };

export function TicketStatusBadge({ status }: { readonly status: TicketStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{TICKET_STATUS_LABELS[status]}</Badge>;
}

const PRIORITY_CLASS: Record<TicketPriority, string> = {
  urgent: 'border-destructive/40 bg-destructive/10 text-destructive',
  high: 'border-warning/40 bg-warning/15 text-warning-foreground',
  normal: 'border-transparent bg-secondary text-secondary-foreground',
  low: 'border-border bg-background text-muted-foreground',
};

export function TicketPriorityBadge({ priority }: { readonly priority: TicketPriority }) {
  return (
    <Badge className={PRIORITY_CLASS[priority]} variant="outline">
      {TICKET_PRIORITY_LABELS[priority]}
    </Badge>
  );
}

export function SlaBadge({ sla }: { readonly sla: TicketSlaDto }) {
  if (sla.breachedAt) {
    return <Badge variant="destructive">SLA breached</Badge>;
  }
  if (sla.pausedAt) {
    return <Badge variant="warning">SLA paused</Badge>;
  }
  return <Badge variant="outline">SLA on track</Badge>;
}
