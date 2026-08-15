import type {
  TicketAssigneeDto,
  TicketAttachmentDto,
  TicketDto,
  TicketEscalationPolicyDto,
  TicketNoteDto,
  TicketSlaPolicyDto,
} from '@ai-customer-support/contracts';
import type { TicketEscalationPolicy } from '../domain/escalation-policy.js';
import type { TicketSlaPolicy } from '../domain/sla-policy.js';
import type { Ticket } from '../domain/ticket.js';
import type { TicketAttachment } from '../domain/ticket-attachment.js';
import type { TicketNote } from '../domain/ticket-note.js';
import type { DirectoryUser } from './ports.js';

export type RequestSecurityContext = {
  readonly ipAddress: string;
  readonly userAgent?: string;
  readonly requestId: string;
  readonly correlationId?: string;
};

export function toTicketDto(ticket: Ticket, assignee: DirectoryUser | null): TicketDto {
  const snapshot = ticket.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    conversationId: snapshot.conversationId ?? null,
    customerId: snapshot.customerId ?? null,
    customerEmail: snapshot.customerEmail,
    customerName: snapshot.customerName,
    subject: snapshot.subject,
    description: snapshot.description,
    status: snapshot.status,
    priority: snapshot.priority,
    source: snapshot.source,
    assignedAgentId: snapshot.assignedAgentId ?? null,
    assignedAgent: assignee ? toAssigneeDto(assignee) : null,
    escalatedAt: snapshot.escalatedAt?.toISOString() ?? null,
    resolvedAt: snapshot.resolvedAt?.toISOString() ?? null,
    closedAt: snapshot.closedAt?.toISOString() ?? null,
    sla: {
      policyId: snapshot.slaPolicyId ?? null,
      firstResponseDueAt: snapshot.firstResponseDueAt?.toISOString() ?? null,
      resolutionDueAt: snapshot.resolutionDueAt?.toISOString() ?? null,
      firstRespondedAt: snapshot.firstRespondedAt?.toISOString() ?? null,
      pausedAt: snapshot.slaPausedAt?.toISOString() ?? null,
      breachedAt: snapshot.slaBreachedAt?.toISOString() ?? null,
      breachKind: snapshot.slaBreachKind ?? null,
    },
    createdByUserId: snapshot.createdByUserId ?? null,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function toAssigneeDto(user: DirectoryUser): TicketAssigneeDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
  };
}

export function toNoteDto(note: TicketNote): TicketNoteDto {
  const snapshot = note.toSnapshot();
  return {
    id: snapshot.id,
    ticketId: snapshot.ticketId,
    authorId: snapshot.authorId,
    body: snapshot.body,
    createdAt: snapshot.createdAt.toISOString(),
  };
}

export function toAttachmentDto(attachment: TicketAttachment): TicketAttachmentDto {
  const snapshot = attachment.toSnapshot();
  return {
    id: snapshot.id,
    ticketId: snapshot.ticketId,
    fileName: snapshot.fileName,
    contentType: snapshot.contentType,
    byteSize: snapshot.byteSize,
    createdAt: snapshot.createdAt.toISOString(),
  };
}

export function toSlaPolicyDto(policy: TicketSlaPolicy): TicketSlaPolicyDto {
  const snapshot = policy.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    name: snapshot.name,
    enabled: snapshot.enabled,
    appliesToPriority: snapshot.appliesToPriority,
    firstResponseMinutes: snapshot.firstResponseMinutes,
    resolutionMinutes: snapshot.resolutionMinutes,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function toEscalationPolicyDto(policy: TicketEscalationPolicy): TicketEscalationPolicyDto {
  const snapshot = policy.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    name: snapshot.name,
    enabled: snapshot.enabled,
    triggerType: snapshot.triggerType,
    triggerMinutes: snapshot.triggerMinutes ?? null,
    action: snapshot.action,
    priority: snapshot.priority,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}
