import type { EventBus } from '@ai-customer-support/shared';
import type { TicketListResponse, TicketResponse, TicketStatus } from '@ai-customer-support/contracts';
import { ConversationNotFoundForTicketError, DuplicateOpenTicketError, TooManyTicketRecordsError } from '../../domain/errors.js';
import { TicketCreatedEvent, TicketStatusChangedEvent } from '../../domain/events.js';
import { selectSlaPolicy } from '../../domain/sla-policy.js';
import { DEFAULT_SLA_MINUTES } from '../../domain/sla-timer.js';
import { Ticket } from '../../domain/ticket.js';
import { MAX_TICKETS_PER_TENANT, TicketPolicy } from '../../domain/ticket-policy.js';
import { parseTicketStatus } from '../../domain/values.js';
import { toTicketDto, type RequestSecurityContext } from '../dtos.js';
import { LoadAuthorizedTicketService, TICKET_PERMISSION } from '../load-authorized-ticket-service.js';
import type {
  ClockPort,
  ConversationSourcePort,
  TenantAccessPort,
  TicketRepository,
  TicketSlaPolicyRepository,
  UserDirectoryPort,
} from '../ports.js';

export class CreateTicketUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly tickets: TicketRepository,
    private readonly slaPolicies: TicketSlaPolicyRepository,
    private readonly conversations: ConversationSourcePort | undefined,
    private readonly users: UserDirectoryPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly customerEmail: string;
    readonly customerName: string;
    readonly subject: string;
    readonly description: string;
    readonly customerId?: string;
    readonly conversationId?: string;
    readonly priority?: string;
    readonly assignedAgentId?: string;
    readonly source?: string;
    readonly security: RequestSecurityContext;
  }): Promise<TicketResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    TicketPolicy.assertPermission(actor.permissions, TICKET_PERMISSION);

    if (input.conversationId) {
      const existing = await this.tickets.findOpenByConversation(actor.tenantId, input.conversationId);
      if (existing) {
        throw new DuplicateOpenTicketError();
      }
      if (this.conversations) {
        const conversation = await this.conversations.findById(actor.tenantId, input.conversationId);
        if (!conversation) {
          throw new ConversationNotFoundForTicketError();
        }
      }
    }

    const count = await this.tickets.countByTenant(actor.tenantId);
    if (count >= MAX_TICKETS_PER_TENANT) {
      throw new TooManyTicketRecordsError('tickets');
    }

    const now = this.clock.now();
    const ticket = Ticket.create({
      organizationId: actor.tenantId,
      customerEmail: input.customerEmail,
      customerName: input.customerName,
      subject: input.subject,
      description: input.description,
      customerId: input.customerId,
      conversationId: input.conversationId,
      priority: input.priority,
      source: input.source ?? 'agent',
      assignedAgentId: input.assignedAgentId,
      createdByUserId: actor.actorId,
      now,
    });
    await applyMatchingSla(ticket, this.slaPolicies, now);
    await this.tickets.save(ticket);
    await this.eventBus.publish(
      new TicketCreatedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        ticket.id,
        actor.actorId,
        ticket.conversationId,
        ticket.source,
        input.security.correlationId,
      ),
    );
    return { ticket: toTicketDto(ticket, await loadAssignee(this.users, ticket.assignedAgentId)) };
  }
}

export class GetTicketUseCase {
  constructor(
    private readonly authorized: LoadAuthorizedTicketService,
    private readonly users: UserDirectoryPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly ticketId: string;
  }): Promise<TicketResponse> {
    const { ticket } = await this.authorized.execute({
      ...input,
      permission: TICKET_PERMISSION,
    });
    return { ticket: toTicketDto(ticket, await loadAssignee(this.users, ticket.assignedAgentId)) };
  }
}

export class ListTicketsUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly tickets: TicketRepository,
    private readonly users: UserDirectoryPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly page: { readonly page: number; readonly pageSize: number };
    readonly status?: string;
    readonly priority?: string;
    readonly assignedAgentId?: string;
    readonly conversationId?: string;
    readonly slaBreached?: boolean;
    readonly query?: string;
  }): Promise<TicketListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    TicketPolicy.assertPermission(actor.permissions, TICKET_PERMISSION);
    const result = await this.tickets.listByTenant(actor.tenantId, input.page, {
      status: input.status ? parseTicketStatus(input.status) : undefined,
      priority: input.priority,
      assignedAgentId: input.assignedAgentId,
      conversationId: input.conversationId,
      slaBreached: input.slaBreached,
      query: input.query?.trim() || undefined,
    });
    const items = await Promise.all(
      result.items
        .filter((item) => item.belongsTo(actor.tenantId))
        .map(async (ticket) => toTicketDto(ticket, await loadAssignee(this.users, ticket.assignedAgentId))),
    );
    return {
      items,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }
}

export class ChangeTicketStatusUseCase {
  constructor(
    private readonly authorized: LoadAuthorizedTicketService,
    private readonly tickets: TicketRepository,
    private readonly users: UserDirectoryPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly ticketId: string;
    readonly status: TicketStatus;
    readonly security: RequestSecurityContext;
  }): Promise<TicketResponse> {
    const { actor, ticket } = await this.authorized.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      ticketId: input.ticketId,
      permission: TICKET_PERMISSION,
    });
    const from = ticket.status;
    const now = this.clock.now();
    ticket.transitionTo(input.status, now);
    await this.tickets.save(ticket);
    if (from !== ticket.status) {
      await this.eventBus.publish(
        new TicketStatusChangedEvent(
          crypto.randomUUID(),
          now,
          actor.tenantId,
          ticket.id,
          from,
          ticket.status,
          actor.actorId,
          input.security.correlationId,
        ),
      );
    }
    return { ticket: toTicketDto(ticket, await loadAssignee(this.users, ticket.assignedAgentId)) };
  }
}

export async function applyMatchingSla(
  ticket: Ticket,
  slaPolicies: TicketSlaPolicyRepository,
  now: Date,
): Promise<void> {
  const policies = await slaPolicies.listByTenant(ticket.organizationId);
  const matched = selectSlaPolicy(policies, ticket.priority);
  const targets = matched
    ? {
        policyId: matched.id,
        firstResponseMinutes: matched.firstResponseMinutes,
        resolutionMinutes: matched.resolutionMinutes,
      }
    : DEFAULT_SLA_MINUTES[ticket.priority];
  ticket.applySla(targets, now);
}

export async function loadAssignee(
  users: UserDirectoryPort,
  assignedAgentId: string | undefined,
): Promise<import('../ports.js').DirectoryUser | null> {
  if (!assignedAgentId) {
    return null;
  }
  return users.findById(assignedAgentId);
}
