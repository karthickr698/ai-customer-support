import type { Page, PageRequest } from '@ai-customer-support/shared';
import type { TicketStatus } from '@ai-customer-support/contracts';
import type { TicketEscalationPolicy } from '../domain/escalation-policy.js';
import type {
  TicketAttachmentId,
  TicketEscalationPolicyId,
  TicketId,
  TicketSlaPolicyId,
} from '../domain/ids.js';
import type { TicketSlaPolicy } from '../domain/sla-policy.js';
import type { Ticket } from '../domain/ticket.js';
import type { TicketAttachment } from '../domain/ticket-attachment.js';
import type { TicketNote } from '../domain/ticket-note.js';

export type TicketActor = {
  readonly tenantId: string;
  readonly actorId: string;
  readonly permissions: readonly string[];
};

export interface TenantAccessPort {
  loadActor(tenantId: string, actorId: string): Promise<TicketActor>;
}

export interface ClockPort {
  now(): Date;
}

export type TicketListFilter = {
  readonly status?: TicketStatus;
  readonly priority?: string;
  readonly assignedAgentId?: string | 'unassigned';
  readonly conversationId?: string;
  readonly slaBreached?: boolean;
  readonly query?: string;
};

export interface TicketRepository {
  save(ticket: Ticket): Promise<void>;
  findById(tenantId: string, ticketId: TicketId): Promise<Ticket | null>;
  findOpenByConversation(tenantId: string, conversationId: string): Promise<Ticket | null>;
  listByTenant(tenantId: string, page: PageRequest, filter?: TicketListFilter): Promise<Page<Ticket>>;
  listSlaCandidates(tenantId: string, limit: number): Promise<Ticket[]>;
  listTenantIdsWithActiveTickets(): Promise<string[]>;
  countByTenant(tenantId: string): Promise<number>;
}

export interface TicketNoteRepository {
  save(note: TicketNote): Promise<void>;
  listByTicket(tenantId: string, ticketId: TicketId, page: PageRequest): Promise<Page<TicketNote>>;
  countByTicket(tenantId: string, ticketId: TicketId): Promise<number>;
}

export interface TicketAttachmentRepository {
  save(attachment: TicketAttachment): Promise<void>;
  findById(tenantId: string, attachmentId: TicketAttachmentId): Promise<TicketAttachment | null>;
  countByTicket(tenantId: string, ticketId: TicketId): Promise<number>;
}

export interface TicketSlaPolicyRepository {
  save(policy: TicketSlaPolicy): Promise<void>;
  findById(tenantId: string, policyId: TicketSlaPolicyId): Promise<TicketSlaPolicy | null>;
  findByPriority(tenantId: string, appliesToPriority: string): Promise<TicketSlaPolicy | null>;
  listByTenant(tenantId: string): Promise<TicketSlaPolicy[]>;
  delete(tenantId: string, policyId: TicketSlaPolicyId): Promise<void>;
  countByTenant(tenantId: string): Promise<number>;
}

export interface TicketEscalationPolicyRepository {
  save(policy: TicketEscalationPolicy): Promise<void>;
  findById(tenantId: string, policyId: TicketEscalationPolicyId): Promise<TicketEscalationPolicy | null>;
  listByTenant(tenantId: string): Promise<TicketEscalationPolicy[]>;
  listEnabled(tenantId: string): Promise<TicketEscalationPolicy[]>;
  listTenantIdsWithEnabledPolicies(): Promise<string[]>;
  delete(tenantId: string, policyId: TicketEscalationPolicyId): Promise<void>;
  countByTenant(tenantId: string): Promise<number>;
}

export type ConversationSourceRecord = {
  readonly id: string;
  readonly organizationId: string;
  readonly customerEmail: string;
  readonly customerName: string;
  readonly customerId?: string;
  readonly subject?: string;
  readonly assignedAgentId?: string;
  readonly lastMessagePreview?: string;
  readonly channel: string;
  readonly status: string;
};

export interface ConversationSourcePort {
  findById(tenantId: string, conversationId: string): Promise<ConversationSourceRecord | null>;
}

export type OrganizationMemberRecord = {
  readonly userId: string;
  readonly role: string;
};

export interface OrganizationMemberDirectoryPort {
  findActiveMember(tenantId: string, userId: string): Promise<OrganizationMemberRecord | null>;
  listActiveMembers(tenantId: string): Promise<OrganizationMemberRecord[]>;
}

export type DirectoryUser = {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
};

export interface UserDirectoryPort {
  findById(id: string): Promise<DirectoryUser | null>;
}

export type AgentAvailabilitySnapshot = {
  readonly agentId: string;
  readonly status: string;
};

export interface AgentAvailabilityPort {
  get(tenantId: string, agentId: string): Promise<AgentAvailabilitySnapshot>;
  list(tenantId: string, agentIds: readonly string[]): Promise<AgentAvailabilitySnapshot[]>;
}

export interface AssignmentCursorPort {
  takeNext(tenantId: string, candidateIds: readonly string[]): Promise<string | undefined>;
}

export type StoredAttachmentFile = {
  readonly bytes: Buffer;
  readonly contentType: string;
};

export interface AttachmentStoragePort {
  save(input: {
    readonly tenantId: string;
    readonly ticketId: string;
    readonly attachmentId: string;
    readonly bytes: Buffer;
  }): Promise<string>;
  read(storageKey: string): Promise<StoredAttachmentFile>;
}

export type TicketToolPort = {
  createTicket(
    tenantId: string,
    actorId: string,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  updateTicket(
    tenantId: string,
    actorId: string,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
};

export type OpenTicketFromConversationCommand = {
  readonly tenantId: string;
  readonly conversationId: string;
  readonly customerEmail: string;
  readonly customerName: string;
  readonly description: string;
  readonly actorId: string;
  readonly source: 'ai_conversation' | 'escalation';
  readonly customerId?: string;
  readonly subject?: string;
  readonly assignedAgentId?: string;
  readonly priority?: string;
  readonly correlationId?: string;
};

export type OpenTicketFromConversationResult = {
  readonly ticketId: string;
  readonly created: boolean;
};

/** Used by conversations to open a ticket without HTTP auth (system / escalation). */
export type TicketIntakePort = {
  openFromConversation(command: OpenTicketFromConversationCommand): Promise<OpenTicketFromConversationResult>;
};
