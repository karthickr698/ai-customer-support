import type { ConversationPriority, ConversationStatus } from '@ai-customer-support/contracts';
import { Badge } from '@/components/ui/badge';
import { STATUS_LABELS } from '../labels';

const STATUS_VARIANT: Record<ConversationStatus, 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive'> = {
  open: 'default',
  pending: 'warning',
  resolved: 'success',
  closed: 'secondary',
  escalated: 'destructive',
};

export function StatusBadge({ status }: { readonly status: ConversationStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABELS[status]}</Badge>;
}

const PRIORITY_CLASS: Record<ConversationPriority, string> = {
  urgent: 'border-destructive/40 bg-destructive/10 text-destructive',
  high: 'border-warning/40 bg-warning/15 text-warning-foreground',
  normal: 'border-transparent bg-secondary text-secondary-foreground',
  low: 'border-border bg-background text-muted-foreground',
};

export function PriorityBadge({ priority }: { readonly priority: ConversationPriority }) {
  const label = priority.charAt(0).toUpperCase() + priority.slice(1);
  return (
    <Badge className={PRIORITY_CLASS[priority]} variant="outline">
      {label}
    </Badge>
  );
}
