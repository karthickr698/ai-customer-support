import type { TicketPriority, TicketSource, TicketStatus } from '@ai-customer-support/contracts';

export const TICKET_PAGE_SIZE = 20;

export function ticketsPath(organizationId: string, segment = ''): string {
  const base = `/organizations/${organizationId}/tickets`;
  return segment ? `${base}/${segment}` : base;
}

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  pending: 'Pending',
  resolved: 'Resolved',
  closed: 'Closed',
  escalated: 'Escalated',
};

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

export const TICKET_SOURCE_LABELS: Record<TicketSource, string> = {
  agent: 'Agent',
  ai_conversation: 'AI conversation',
  escalation: 'Escalation',
  tool: 'Tool',
};

export const QUEUE_VIEWS: ReadonlyArray<{ value: string; label: string; status?: TicketStatus; unassigned?: boolean; slaBreached?: boolean; mine?: boolean }> =
  [
    { value: 'all', label: 'All' },
    { value: 'open', label: 'Open', status: 'open' },
    { value: 'pending', label: 'Pending', status: 'pending' },
    { value: 'escalated', label: 'Escalated', status: 'escalated' },
    { value: 'unassigned', label: 'Unassigned', unassigned: true },
    { value: 'breached', label: 'SLA breached', slaBreached: true },
    { value: 'mine', label: 'Assigned to me', mine: true },
  ];

export const TICKET_STATUS_OPTIONS: ReadonlyArray<{ value: Exclude<TicketStatus, 'escalated'>; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export const TICKET_PRIORITY_OPTIONS: ReadonlyArray<{ value: TicketPriority; label: string }> = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
];
