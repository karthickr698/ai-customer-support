/**
 * Cross-runtime DTOs for tenant-scoped support tickets, SLA timers, and escalation policies.
 */

export const TICKET_STATUSES = ['open', 'pending', 'resolved', 'closed', 'escalated'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_SOURCES = ['agent', 'ai_conversation', 'escalation', 'tool'] as const;
export type TicketSource = (typeof TICKET_SOURCES)[number];

export const SLA_BREACH_KINDS = ['first_response', 'resolution'] as const;
export type SlaBreachKind = (typeof SLA_BREACH_KINDS)[number];

export const SLA_POLICY_PRIORITIES = ['any', ...TICKET_PRIORITIES] as const;
export type SlaPolicyPriority = (typeof SLA_POLICY_PRIORITIES)[number];

export const TICKET_ESCALATION_TRIGGER_TYPES = [
  'first_response_overdue',
  'resolution_overdue',
  'unassigned_for',
] as const;
export type TicketEscalationTriggerType = (typeof TICKET_ESCALATION_TRIGGER_TYPES)[number];

export const TICKET_ESCALATION_ACTIONS = [
  'mark_escalated',
  'bump_priority',
  'unassign',
  'assign_available',
  'escalate_and_unassign',
] as const;
export type TicketEscalationAction = (typeof TICKET_ESCALATION_ACTIONS)[number];

export type TicketAssigneeDto = {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
};

export type TicketSlaDto = {
  readonly policyId: string | null;
  readonly firstResponseDueAt: string | null;
  readonly resolutionDueAt: string | null;
  readonly firstRespondedAt: string | null;
  readonly pausedAt: string | null;
  readonly breachedAt: string | null;
  readonly breachKind: SlaBreachKind | null;
};

export type TicketDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly conversationId: string | null;
  readonly customerId: string | null;
  readonly customerEmail: string;
  readonly customerName: string;
  readonly subject: string;
  readonly description: string;
  readonly status: TicketStatus;
  readonly priority: TicketPriority;
  readonly source: TicketSource;
  readonly assignedAgentId: string | null;
  readonly assignedAgent: TicketAssigneeDto | null;
  readonly escalatedAt: string | null;
  readonly resolvedAt: string | null;
  readonly closedAt: string | null;
  readonly sla: TicketSlaDto;
  readonly createdByUserId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CreateTicketRequest = {
  readonly customerEmail: string;
  readonly customerName: string;
  readonly subject: string;
  readonly description: string;
  readonly customerId?: string;
  readonly conversationId?: string;
  readonly priority?: TicketPriority;
  readonly assignedAgentId?: string;
};

export type ChangeTicketStatusRequest = {
  readonly status: TicketStatus;
};

export type AssignTicketRequest = {
  readonly assignedAgentId: string;
};

export type EscalateTicketRequest = {
  readonly reason?: string;
};

export type TicketResponse = {
  readonly ticket: TicketDto;
};

export type TicketListResponse = {
  readonly items: readonly TicketDto[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};

export type TicketNoteDto = {
  readonly id: string;
  readonly ticketId: string;
  readonly authorId: string;
  readonly body: string;
  readonly createdAt: string;
};

export type AddTicketNoteRequest = {
  readonly body: string;
};

export type TicketNoteResponse = {
  readonly note: TicketNoteDto;
};

export type TicketNoteListResponse = {
  readonly items: readonly TicketNoteDto[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};

export type TicketAttachmentDto = {
  readonly id: string;
  readonly ticketId: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly byteSize: number;
  readonly createdAt: string;
};

export type TicketAttachmentResponse = {
  readonly attachment: TicketAttachmentDto;
};

export type TicketSlaPolicyDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly appliesToPriority: SlaPolicyPriority;
  readonly firstResponseMinutes: number;
  readonly resolutionMinutes: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CreateTicketSlaPolicyRequest = {
  readonly name: string;
  readonly appliesToPriority: SlaPolicyPriority;
  readonly firstResponseMinutes: number;
  readonly resolutionMinutes: number;
  readonly enabled?: boolean;
};

export type UpdateTicketSlaPolicyRequest = {
  readonly name?: string;
  readonly enabled?: boolean;
  readonly appliesToPriority?: SlaPolicyPriority;
  readonly firstResponseMinutes?: number;
  readonly resolutionMinutes?: number;
};

export type TicketSlaPolicyResponse = {
  readonly policy: TicketSlaPolicyDto;
};

export type TicketSlaPolicyListResponse = {
  readonly items: readonly TicketSlaPolicyDto[];
};

export type TicketEscalationPolicyDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly triggerType: TicketEscalationTriggerType;
  readonly triggerMinutes: number | null;
  readonly action: TicketEscalationAction;
  readonly priority: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CreateTicketEscalationPolicyRequest = {
  readonly name: string;
  readonly triggerType: TicketEscalationTriggerType;
  readonly action: TicketEscalationAction;
  readonly triggerMinutes?: number;
  readonly enabled?: boolean;
  readonly priority?: number;
};

export type UpdateTicketEscalationPolicyRequest = {
  readonly name?: string;
  readonly enabled?: boolean;
  readonly triggerType?: TicketEscalationTriggerType;
  readonly triggerMinutes?: number | null;
  readonly action?: TicketEscalationAction;
  readonly priority?: number;
};

export type TicketEscalationPolicyResponse = {
  readonly policy: TicketEscalationPolicyDto;
};

export type TicketEscalationPolicyListResponse = {
  readonly items: readonly TicketEscalationPolicyDto[];
};

export type EvaluateTicketEscalationResponse = {
  readonly applied: number;
};
