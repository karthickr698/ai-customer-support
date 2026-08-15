import type { EventBus } from '@ai-customer-support/shared';
import type { TicketResponse } from '@ai-customer-support/contracts';
import {
  AssigneeNotOrganizationMemberError,
  NoAvailableAgentError,
} from '../../domain/errors.js';
import { TicketAssignedEvent, TicketEscalatedEvent, TicketUnassignedEvent } from '../../domain/events.js';
import { AssignmentPolicy } from '../../domain/assignment-policy.js';
import { TicketPolicy } from '../../domain/ticket-policy.js';
import { toTicketDto, type RequestSecurityContext } from '../dtos.js';
import { LoadAuthorizedTicketService, TICKET_PERMISSION } from '../load-authorized-ticket-service.js';
import type {
  AgentAvailabilityPort,
  AssignmentCursorPort,
  ClockPort,
  OrganizationMemberDirectoryPort,
  TicketRepository,
  UserDirectoryPort,
} from '../ports.js';
import { loadAssignee } from './ticket-use-cases.js';

export class AssignTicketUseCase {
  constructor(
    private readonly authorized: LoadAuthorizedTicketService,
    private readonly tickets: TicketRepository,
    private readonly members: OrganizationMemberDirectoryPort,
    private readonly users: UserDirectoryPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly ticketId: string;
    readonly assignedAgentId: string;
    readonly security: RequestSecurityContext;
  }): Promise<TicketResponse> {
    const { actor, ticket } = await this.authorized.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      ticketId: input.ticketId,
      permission: TICKET_PERMISSION,
    });
    const member = await this.members.findActiveMember(actor.tenantId, input.assignedAgentId);
    if (!member) {
      throw new AssigneeNotOrganizationMemberError();
    }
    TicketPolicy.assertAssignableRole(member.role);
    const now = this.clock.now();
    ticket.assignTo(member.userId, now);
    await this.tickets.save(ticket);
    await this.eventBus.publish(
      new TicketAssignedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        ticket.id,
        member.userId,
        actor.actorId,
        input.security.correlationId,
      ),
    );
    return { ticket: toTicketDto(ticket, await loadAssignee(this.users, member.userId)) };
  }
}

export class UnassignTicketUseCase {
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
    readonly security: RequestSecurityContext;
  }): Promise<TicketResponse> {
    const { actor, ticket } = await this.authorized.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      ticketId: input.ticketId,
      permission: TICKET_PERMISSION,
    });
    const now = this.clock.now();
    ticket.unassign(now);
    await this.tickets.save(ticket);
    await this.eventBus.publish(
      new TicketUnassignedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        ticket.id,
        actor.actorId,
        input.security.correlationId,
      ),
    );
    return { ticket: toTicketDto(ticket, await loadAssignee(this.users, ticket.assignedAgentId)) };
  }
}

export class AssignTicketToAvailableAgentUseCase {
  constructor(
    private readonly authorized: LoadAuthorizedTicketService,
    private readonly tickets: TicketRepository,
    private readonly members: OrganizationMemberDirectoryPort,
    private readonly availability: AgentAvailabilityPort,
    private readonly cursor: AssignmentCursorPort,
    private readonly users: UserDirectoryPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly ticketId: string;
    readonly security: RequestSecurityContext;
  }): Promise<TicketResponse> {
    const { actor, ticket } = await this.authorized.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      ticketId: input.ticketId,
      permission: TICKET_PERMISSION,
    });
    const agentId = await pickAvailableAgent(
      actor.tenantId,
      this.members,
      this.availability,
      this.cursor,
      ticket.assignedAgentId,
    );
    if (!agentId) {
      throw new NoAvailableAgentError();
    }
    const now = this.clock.now();
    ticket.assignTo(agentId, now);
    await this.tickets.save(ticket);
    await this.eventBus.publish(
      new TicketAssignedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        ticket.id,
        agentId,
        actor.actorId,
        input.security.correlationId,
      ),
    );
    return { ticket: toTicketDto(ticket, await loadAssignee(this.users, agentId)) };
  }
}

export class EscalateTicketUseCase {
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
    readonly reason?: string;
    readonly security: RequestSecurityContext;
  }): Promise<TicketResponse> {
    const { actor, ticket } = await this.authorized.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      ticketId: input.ticketId,
      permission: TICKET_PERMISSION,
    });
    const now = this.clock.now();
    ticket.escalate(now);
    await this.tickets.save(ticket);
    const reason = input.reason?.trim();
    await this.eventBus.publish(
      new TicketEscalatedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        ticket.id,
        actor.actorId,
        reason && reason.length > 0 ? reason : undefined,
        input.security.correlationId,
      ),
    );
    return { ticket: toTicketDto(ticket, await loadAssignee(this.users, ticket.assignedAgentId)) };
  }
}

export async function pickAvailableAgent(
  tenantId: string,
  members: OrganizationMemberDirectoryPort,
  availability: AgentAvailabilityPort,
  cursor: AssignmentCursorPort,
  excludeAgentId?: string,
): Promise<string | undefined> {
  const roster = await members.listActiveMembers(tenantId);
  const presence = await availability.list(
    tenantId,
    roster.map((member) => member.userId),
  );
  const byAgent = new Map(presence.map((item) => [item.agentId, item.status]));
  const available = AssignmentPolicy.availableAgentIds(
    roster.map((member) => ({
      userId: member.userId,
      role: member.role,
      presence: byAgent.get(member.userId) ?? 'offline',
    })),
  ).filter((agentId) => agentId !== excludeAgentId);
  return cursor.takeNext(tenantId, available);
}
