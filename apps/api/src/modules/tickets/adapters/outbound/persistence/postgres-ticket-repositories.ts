import type { Page, PageRequest } from '@ai-customer-support/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import { TicketEscalationPolicy, type TicketEscalationPolicySnapshot } from '../../../domain/escalation-policy.js';
import {
  createTicketAttachmentId,
  createTicketEscalationPolicyId,
  createTicketId,
  createTicketNoteId,
  createTicketSlaPolicyId,
  type TicketAttachmentId,
  type TicketEscalationPolicyId,
  type TicketId,
  type TicketSlaPolicyId,
} from '../../../domain/ids.js';
import { TicketSlaPolicy, type TicketSlaPolicySnapshot } from '../../../domain/sla-policy.js';
import { Ticket, type TicketSnapshot } from '../../../domain/ticket.js';
import { TicketAttachment, type TicketAttachmentSnapshot } from '../../../domain/ticket-attachment.js';
import { TicketNote, type TicketNoteSnapshot } from '../../../domain/ticket-note.js';
import { parseSlaBreachKind } from '../../../domain/values.js';
import type {
  TicketAttachmentRepository,
  TicketEscalationPolicyRepository,
  TicketListFilter,
  TicketNoteRepository,
  TicketRepository,
  TicketSlaPolicyRepository,
} from '../../../application/ports.js';

export class PostgresTicketRepository implements TicketRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(ticket: Ticket): Promise<void> {
    const snapshot = ticket.toSnapshot();
    const data = toTicketRecord(snapshot);
    await this.prisma.ticket.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        customerId: data.customerId,
        customerEmail: data.customerEmail,
        customerName: data.customerName,
        subject: data.subject,
        description: data.description,
        status: data.status,
        priority: data.priority,
        assignedAgentId: data.assignedAgentId,
        escalatedAt: data.escalatedAt,
        firstRespondedAt: data.firstRespondedAt,
        resolvedAt: data.resolvedAt,
        closedAt: data.closedAt,
        slaPolicyId: data.slaPolicyId,
        firstResponseDueAt: data.firstResponseDueAt,
        resolutionDueAt: data.resolutionDueAt,
        slaPausedAt: data.slaPausedAt,
        slaBreachedAt: data.slaBreachedAt,
        slaBreachKind: data.slaBreachKind,
        updatedAt: data.updatedAt,
      },
    });
  }

  async findById(tenantId: string, ticketId: TicketId): Promise<Ticket | null> {
    const record = await this.prisma.ticket.findFirst({
      where: { id: ticketId, organizationId: tenantId },
    });
    return record ? toTicket(record) : null;
  }

  async findOpenByConversation(tenantId: string, conversationId: string): Promise<Ticket | null> {
    const record = await this.prisma.ticket.findFirst({
      where: {
        organizationId: tenantId,
        conversationId,
        status: { in: ['open', 'pending', 'escalated'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    return record ? toTicket(record) : null;
  }

  async listByTenant(
    tenantId: string,
    page: PageRequest,
    filter?: TicketListFilter,
  ): Promise<Page<Ticket>> {
    const where: Prisma.TicketWhereInput = {
      organizationId: tenantId,
      ...(filter?.status ? { status: filter.status } : {}),
      ...(filter?.priority ? { priority: filter.priority } : {}),
      ...(filter?.conversationId ? { conversationId: filter.conversationId } : {}),
      ...(filter?.slaBreached === true ? { slaBreachedAt: { not: null } } : {}),
      ...(filter?.slaBreached === false ? { slaBreachedAt: null } : {}),
      ...(filter?.assignedAgentId === 'unassigned'
        ? { assignedAgentId: null }
        : filter?.assignedAgentId
          ? { assignedAgentId: filter.assignedAgentId }
          : {}),
      ...(filter?.query
        ? {
            OR: [
              { subject: { contains: filter.query, mode: 'insensitive' } },
              { customerEmail: { contains: filter.query, mode: 'insensitive' } },
              { customerName: { contains: filter.query, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return paginate(
      page,
      () => this.prisma.ticket.count({ where }),
      () =>
        this.prisma.ticket.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          skip: skip(page),
          take: page.pageSize,
        }),
      toTicket,
    );
  }

  async listSlaCandidates(tenantId: string, limit: number): Promise<Ticket[]> {
    const records = await this.prisma.ticket.findMany({
      where: {
        organizationId: tenantId,
        status: { in: ['open', 'pending', 'escalated'] },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return records.map(toTicket);
  }

  async listTenantIdsWithActiveTickets(): Promise<string[]> {
    const records = await this.prisma.ticket.findMany({
      where: { status: { in: ['open', 'pending', 'escalated'] } },
      distinct: ['organizationId'],
      select: { organizationId: true },
    });
    return records.map((record) => record.organizationId);
  }

  async countByTenant(tenantId: string): Promise<number> {
    return this.prisma.ticket.count({ where: { organizationId: tenantId } });
  }
}

export class PostgresTicketNoteRepository implements TicketNoteRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(note: TicketNote): Promise<void> {
    const snapshot = note.toSnapshot();
    await this.prisma.ticketNote.create({
      data: {
        id: snapshot.id,
        ticketId: snapshot.ticketId,
        organizationId: snapshot.organizationId,
        authorId: snapshot.authorId,
        body: snapshot.body,
        createdAt: snapshot.createdAt,
      },
    });
  }

  async listByTicket(tenantId: string, ticketId: TicketId, page: PageRequest): Promise<Page<TicketNote>> {
    const where = { organizationId: tenantId, ticketId };
    return paginate(
      page,
      () => this.prisma.ticketNote.count({ where }),
      () =>
        this.prisma.ticketNote.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: skip(page),
          take: page.pageSize,
        }),
      toNote,
    );
  }

  async countByTicket(tenantId: string, ticketId: TicketId): Promise<number> {
    return this.prisma.ticketNote.count({ where: { organizationId: tenantId, ticketId } });
  }
}

export class PostgresTicketAttachmentRepository implements TicketAttachmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(attachment: TicketAttachment): Promise<void> {
    const snapshot = attachment.toSnapshot();
    await this.prisma.ticketAttachment.create({
      data: {
        id: snapshot.id,
        organizationId: snapshot.organizationId,
        ticketId: snapshot.ticketId,
        fileName: snapshot.fileName,
        contentType: snapshot.contentType,
        byteSize: snapshot.byteSize,
        storageKey: snapshot.storageKey,
        createdAt: snapshot.createdAt,
      },
    });
  }

  async findById(tenantId: string, attachmentId: TicketAttachmentId): Promise<TicketAttachment | null> {
    const record = await this.prisma.ticketAttachment.findFirst({
      where: { id: attachmentId, organizationId: tenantId },
    });
    return record ? toAttachment(record) : null;
  }

  async countByTicket(tenantId: string, ticketId: TicketId): Promise<number> {
    return this.prisma.ticketAttachment.count({ where: { organizationId: tenantId, ticketId } });
  }
}

export class PostgresTicketSlaPolicyRepository implements TicketSlaPolicyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(policy: TicketSlaPolicy): Promise<void> {
    const snapshot = policy.toSnapshot();
    const data = {
      id: snapshot.id,
      organizationId: snapshot.organizationId,
      name: snapshot.name,
      enabled: snapshot.enabled,
      appliesToPriority: snapshot.appliesToPriority,
      firstResponseMinutes: snapshot.firstResponseMinutes,
      resolutionMinutes: snapshot.resolutionMinutes,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
    };
    await this.prisma.ticketSlaPolicy.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        name: data.name,
        enabled: data.enabled,
        appliesToPriority: data.appliesToPriority,
        firstResponseMinutes: data.firstResponseMinutes,
        resolutionMinutes: data.resolutionMinutes,
        updatedAt: data.updatedAt,
      },
    });
  }

  async findById(tenantId: string, policyId: TicketSlaPolicyId): Promise<TicketSlaPolicy | null> {
    const record = await this.prisma.ticketSlaPolicy.findFirst({
      where: { id: policyId, organizationId: tenantId },
    });
    return record ? toSlaPolicy(record) : null;
  }

  async findByPriority(tenantId: string, appliesToPriority: string): Promise<TicketSlaPolicy | null> {
    const record = await this.prisma.ticketSlaPolicy.findFirst({
      where: { organizationId: tenantId, appliesToPriority },
    });
    return record ? toSlaPolicy(record) : null;
  }

  async listByTenant(tenantId: string): Promise<TicketSlaPolicy[]> {
    const records = await this.prisma.ticketSlaPolicy.findMany({
      where: { organizationId: tenantId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map(toSlaPolicy);
  }

  async delete(tenantId: string, policyId: TicketSlaPolicyId): Promise<void> {
    await this.prisma.ticketSlaPolicy.deleteMany({ where: { id: policyId, organizationId: tenantId } });
  }

  async countByTenant(tenantId: string): Promise<number> {
    return this.prisma.ticketSlaPolicy.count({ where: { organizationId: tenantId } });
  }
}

export class PostgresTicketEscalationPolicyRepository implements TicketEscalationPolicyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(policy: TicketEscalationPolicy): Promise<void> {
    const snapshot = policy.toSnapshot();
    const data = {
      id: snapshot.id,
      organizationId: snapshot.organizationId,
      name: snapshot.name,
      enabled: snapshot.enabled,
      triggerType: snapshot.triggerType,
      triggerMinutes: snapshot.triggerMinutes ?? null,
      action: snapshot.action,
      priority: snapshot.priority,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
    };
    await this.prisma.ticketEscalationPolicy.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        name: data.name,
        enabled: data.enabled,
        triggerType: data.triggerType,
        triggerMinutes: data.triggerMinutes,
        action: data.action,
        priority: data.priority,
        updatedAt: data.updatedAt,
      },
    });
  }

  async findById(
    tenantId: string,
    policyId: TicketEscalationPolicyId,
  ): Promise<TicketEscalationPolicy | null> {
    const record = await this.prisma.ticketEscalationPolicy.findFirst({
      where: { id: policyId, organizationId: tenantId },
    });
    return record ? toEscalationPolicy(record) : null;
  }

  async listByTenant(tenantId: string): Promise<TicketEscalationPolicy[]> {
    const records = await this.prisma.ticketEscalationPolicy.findMany({
      where: { organizationId: tenantId },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
    return records.map(toEscalationPolicy);
  }

  async listEnabled(tenantId: string): Promise<TicketEscalationPolicy[]> {
    const records = await this.prisma.ticketEscalationPolicy.findMany({
      where: { organizationId: tenantId, enabled: true },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
    return records.map(toEscalationPolicy);
  }

  async listTenantIdsWithEnabledPolicies(): Promise<string[]> {
    const records = await this.prisma.ticketEscalationPolicy.findMany({
      where: { enabled: true },
      distinct: ['organizationId'],
      select: { organizationId: true },
    });
    return records.map((record) => record.organizationId);
  }

  async delete(tenantId: string, policyId: TicketEscalationPolicyId): Promise<void> {
    await this.prisma.ticketEscalationPolicy.deleteMany({
      where: { id: policyId, organizationId: tenantId },
    });
  }

  async countByTenant(tenantId: string): Promise<number> {
    return this.prisma.ticketEscalationPolicy.count({ where: { organizationId: tenantId } });
  }
}

function skip(page: PageRequest): number {
  return (page.page - 1) * page.pageSize;
}

async function paginate<TRecord, TEntity>(
  page: PageRequest,
  count: () => Promise<number>,
  load: () => Promise<TRecord[]>,
  map: (record: TRecord) => TEntity,
): Promise<Page<TEntity>> {
  const [total, records] = await Promise.all([count(), load()]);
  return {
    items: records.map(map),
    total,
    page: page.page,
    pageSize: page.pageSize,
  };
}

function toTicketRecord(snapshot: TicketSnapshot) {
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
    escalatedAt: snapshot.escalatedAt ?? null,
    firstRespondedAt: snapshot.firstRespondedAt ?? null,
    resolvedAt: snapshot.resolvedAt ?? null,
    closedAt: snapshot.closedAt ?? null,
    slaPolicyId: snapshot.slaPolicyId ?? null,
    firstResponseDueAt: snapshot.firstResponseDueAt ?? null,
    resolutionDueAt: snapshot.resolutionDueAt ?? null,
    slaPausedAt: snapshot.slaPausedAt ?? null,
    slaBreachedAt: snapshot.slaBreachedAt ?? null,
    slaBreachKind: snapshot.slaBreachKind ?? null,
    createdByUserId: snapshot.createdByUserId ?? null,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}

function toTicket(record: {
  id: string;
  organizationId: string;
  conversationId: string | null;
  customerId: string | null;
  customerEmail: string;
  customerName: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  source: string;
  assignedAgentId: string | null;
  escalatedAt: Date | null;
  firstRespondedAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  slaPolicyId: string | null;
  firstResponseDueAt: Date | null;
  resolutionDueAt: Date | null;
  slaPausedAt: Date | null;
  slaBreachedAt: Date | null;
  slaBreachKind: string | null;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Ticket {
  const snapshot: TicketSnapshot = {
    id: createTicketId(record.id),
    organizationId: record.organizationId,
    conversationId: record.conversationId ?? undefined,
    customerId: record.customerId ?? undefined,
    customerEmail: record.customerEmail,
    customerName: record.customerName,
    subject: record.subject,
    description: record.description,
    status: record.status as TicketSnapshot['status'],
    priority: record.priority as TicketSnapshot['priority'],
    source: record.source as TicketSnapshot['source'],
    assignedAgentId: record.assignedAgentId ?? undefined,
    escalatedAt: record.escalatedAt ?? undefined,
    firstRespondedAt: record.firstRespondedAt ?? undefined,
    resolvedAt: record.resolvedAt ?? undefined,
    closedAt: record.closedAt ?? undefined,
    slaPolicyId: record.slaPolicyId ? createTicketSlaPolicyId(record.slaPolicyId) : undefined,
    firstResponseDueAt: record.firstResponseDueAt ?? undefined,
    resolutionDueAt: record.resolutionDueAt ?? undefined,
    slaPausedAt: record.slaPausedAt ?? undefined,
    slaBreachedAt: record.slaBreachedAt ?? undefined,
    slaBreachKind: record.slaBreachKind ? parseSlaBreachKind(record.slaBreachKind) : undefined,
    createdByUserId: record.createdByUserId ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
  return Ticket.reconstitute(snapshot);
}

function toNote(record: {
  id: string;
  ticketId: string;
  organizationId: string;
  authorId: string;
  body: string;
  createdAt: Date;
}): TicketNote {
  const snapshot: TicketNoteSnapshot = {
    id: createTicketNoteId(record.id),
    ticketId: createTicketId(record.ticketId),
    organizationId: record.organizationId,
    authorId: record.authorId,
    body: record.body,
    createdAt: record.createdAt,
  };
  return TicketNote.reconstitute(snapshot);
}

function toAttachment(record: {
  id: string;
  organizationId: string;
  ticketId: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  storageKey: string;
  createdAt: Date;
}): TicketAttachment {
  const snapshot: TicketAttachmentSnapshot = {
    id: createTicketAttachmentId(record.id),
    organizationId: record.organizationId,
    ticketId: createTicketId(record.ticketId),
    fileName: record.fileName,
    contentType: record.contentType as TicketAttachmentSnapshot['contentType'],
    byteSize: record.byteSize,
    storageKey: record.storageKey,
    createdAt: record.createdAt,
  };
  return TicketAttachment.reconstitute(snapshot);
}

function toSlaPolicy(record: {
  id: string;
  organizationId: string;
  name: string;
  enabled: boolean;
  appliesToPriority: string;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}): TicketSlaPolicy {
  const snapshot: TicketSlaPolicySnapshot = {
    id: createTicketSlaPolicyId(record.id),
    organizationId: record.organizationId,
    name: record.name,
    enabled: record.enabled,
    appliesToPriority: record.appliesToPriority as TicketSlaPolicySnapshot['appliesToPriority'],
    firstResponseMinutes: record.firstResponseMinutes,
    resolutionMinutes: record.resolutionMinutes,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
  return TicketSlaPolicy.reconstitute(snapshot);
}

function toEscalationPolicy(record: {
  id: string;
  organizationId: string;
  name: string;
  enabled: boolean;
  triggerType: string;
  triggerMinutes: number | null;
  action: string;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}): TicketEscalationPolicy {
  const snapshot: TicketEscalationPolicySnapshot = {
    id: createTicketEscalationPolicyId(record.id),
    organizationId: record.organizationId,
    name: record.name,
    enabled: record.enabled,
    triggerType: record.triggerType as TicketEscalationPolicySnapshot['triggerType'],
    triggerMinutes: record.triggerMinutes ?? undefined,
    action: record.action as TicketEscalationPolicySnapshot['action'],
    priority: record.priority,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
  return TicketEscalationPolicy.reconstitute(snapshot);
}
