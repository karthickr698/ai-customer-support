import type {
  EvaluateTicketEscalationResponse,
  TicketEscalationPolicyListResponse,
  TicketEscalationPolicyResponse,
} from '@ai-customer-support/contracts';
import type { EventBus, Logger } from '@ai-customer-support/shared';
import {
  TicketEscalationPolicyNotFoundError,
  TooManyTicketRecordsError,
} from '../../domain/errors.js';
import {
  TicketAssignedEvent,
  TicketEscalatedEvent,
  TicketSlaBreachedEvent,
  TicketUnassignedEvent,
} from '../../domain/events.js';
import {
  TicketEscalationPolicy,
  TicketEscalationPolicyMatcher,
} from '../../domain/escalation-policy.js';
import { createTicketEscalationPolicyId } from '../../domain/ids.js';
import type { Ticket } from '../../domain/ticket.js';
import {
  MAX_ESCALATION_POLICIES_PER_TENANT,
  MAX_SLA_CANDIDATES,
  SYSTEM_ACTOR_ID,
  TicketPolicy,
} from '../../domain/ticket-policy.js';
import { toEscalationPolicyDto } from '../dtos.js';
import { TICKET_PERMISSION } from '../load-authorized-ticket-service.js';
import type {
  AgentAvailabilityPort,
  AssignmentCursorPort,
  ClockPort,
  OrganizationMemberDirectoryPort,
  TenantAccessPort,
  TicketEscalationPolicyRepository,
  TicketRepository,
} from '../ports.js';
import { pickAvailableAgent } from './assignment-use-cases.js';

export class CreateTicketEscalationPolicyUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly policies: TicketEscalationPolicyRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly name: string;
    readonly triggerType: string;
    readonly action: string;
    readonly triggerMinutes?: number;
    readonly enabled?: boolean;
    readonly priority?: number;
  }): Promise<TicketEscalationPolicyResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    TicketPolicy.assertPermission(actor.permissions, TICKET_PERMISSION);
    const count = await this.policies.countByTenant(actor.tenantId);
    if (count >= MAX_ESCALATION_POLICIES_PER_TENANT) {
      throw new TooManyTicketRecordsError('ticket escalation policies');
    }
    const policy = TicketEscalationPolicy.create({
      organizationId: actor.tenantId,
      name: input.name,
      triggerType: input.triggerType,
      action: input.action,
      triggerMinutes: input.triggerMinutes,
      enabled: input.enabled,
      priority: input.priority,
      now: this.clock.now(),
    });
    await this.policies.save(policy);
    return { policy: toEscalationPolicyDto(policy) };
  }
}

export class ListTicketEscalationPoliciesUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly policies: TicketEscalationPolicyRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
  }): Promise<TicketEscalationPolicyListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    TicketPolicy.assertPermission(actor.permissions, TICKET_PERMISSION);
    const items = await this.policies.listByTenant(actor.tenantId);
    return { items: items.map(toEscalationPolicyDto) };
  }
}

export class UpdateTicketEscalationPolicyUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly policies: TicketEscalationPolicyRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly policyId: string;
    readonly name?: string;
    readonly enabled?: boolean;
    readonly triggerType?: string;
    readonly triggerMinutes?: number | null;
    readonly action?: string;
    readonly priority?: number;
  }): Promise<TicketEscalationPolicyResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    TicketPolicy.assertPermission(actor.permissions, TICKET_PERMISSION);
    const policy = await this.policies.findById(
      actor.tenantId,
      createTicketEscalationPolicyId(input.policyId),
    );
    if (!policy) {
      throw new TicketEscalationPolicyNotFoundError();
    }
    policy.update(
      {
        name: input.name,
        enabled: input.enabled,
        triggerType: input.triggerType,
        triggerMinutes: input.triggerMinutes,
        action: input.action,
        priority: input.priority,
      },
      this.clock.now(),
    );
    await this.policies.save(policy);
    return { policy: toEscalationPolicyDto(policy) };
  }
}

export class DeleteTicketEscalationPolicyUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly policies: TicketEscalationPolicyRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly policyId: string;
  }): Promise<void> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    TicketPolicy.assertPermission(actor.permissions, TICKET_PERMISSION);
    const policy = await this.policies.findById(
      actor.tenantId,
      createTicketEscalationPolicyId(input.policyId),
    );
    if (!policy) {
      throw new TicketEscalationPolicyNotFoundError();
    }
    await this.policies.delete(actor.tenantId, policy.id);
  }
}

export class EvaluateTicketEscalationUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly policies: TicketEscalationPolicyRepository,
    private readonly tickets: TicketRepository,
    private readonly members: OrganizationMemberDirectoryPort,
    private readonly availability: AgentAvailabilityPort,
    private readonly cursor: AssignmentCursorPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly logger?: Logger,
  ) {}

  async execute(input?: {
    readonly tenantId?: string;
    readonly actorId?: string;
  }): Promise<EvaluateTicketEscalationResponse> {
    if (input?.tenantId && input.actorId) {
      const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
      TicketPolicy.assertPermission(actor.permissions, TICKET_PERMISSION);
      return { applied: await this.evaluateTenant(actor.tenantId) };
    }

    const tenantIds = await this.policies.listTenantIdsWithEnabledPolicies();
    const activeTenants = await this.tickets.listTenantIdsWithActiveTickets();
    const ids = [...new Set([...tenantIds, ...activeTenants])];
    let applied = 0;
    for (const tenantId of ids) {
      applied += await this.evaluateTenant(tenantId);
    }
    return { applied };
  }

  private async evaluateTenant(tenantId: string): Promise<number> {
    const now = this.clock.now();
    const tickets = await this.tickets.listSlaCandidates(tenantId, MAX_SLA_CANDIDATES);
    const policies = await this.policies.listEnabled(tenantId);
    let applied = 0;
    for (const ticket of tickets) {
      applied += await this.evaluateTicket(ticket, policies, now);
    }
    return applied;
  }

  private async evaluateTicket(
    ticket: Ticket,
    policies: TicketEscalationPolicy[],
    now: Date,
  ): Promise<number> {
    let applied = 0;
    if (ticket.firstResponseOverdue(now) && ticket.markSlaBreached('first_response', now)) {
      await this.tickets.save(ticket);
      await this.eventBus.publish(
        new TicketSlaBreachedEvent(crypto.randomUUID(), now, ticket.organizationId, ticket.id, 'first_response'),
      );
      applied += 1;
    } else if (
      !ticket.slaBreachedAt &&
      ticket.resolutionOverdue(now) &&
      ticket.markSlaBreached('resolution', now)
    ) {
      await this.tickets.save(ticket);
      await this.eventBus.publish(
        new TicketSlaBreachedEvent(crypto.randomUUID(), now, ticket.organizationId, ticket.id, 'resolution'),
      );
      applied += 1;
    }

    const match = TicketEscalationPolicyMatcher.firstMatch(policies, ticket, { now });
    if (!match) {
      return applied;
    }
    try {
      await this.apply(match, ticket, now);
      return applied + 1;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown ticket escalation error';
      this.logger?.warn('Ticket escalation policy application failed', {
        tenantId: ticket.organizationId,
        ticketId: ticket.id,
        policyId: match.id,
        message,
      });
      return applied;
    }
  }

  private async apply(policy: TicketEscalationPolicy, ticket: Ticket, now: Date): Promise<void> {
    if (policy.action === 'assign_available') {
      const agentId = await pickAvailableAgent(
        ticket.organizationId,
        this.members,
        this.availability,
        this.cursor,
        ticket.assignedAgentId,
      );
      if (agentId) {
        ticket.assignTo(agentId, now);
        await this.tickets.save(ticket);
        await this.eventBus.publish(
          new TicketAssignedEvent(
            crypto.randomUUID(),
            now,
            ticket.organizationId,
            ticket.id,
            agentId,
            SYSTEM_ACTOR_ID,
          ),
        );
        return;
      }
      ticket.escalate(now);
      await this.tickets.save(ticket);
      await this.eventBus.publish(
        new TicketEscalatedEvent(
          crypto.randomUUID(),
          now,
          ticket.organizationId,
          ticket.id,
          SYSTEM_ACTOR_ID,
          `No available agent; applied policy "${policy.name}"`,
        ),
      );
      return;
    }

    if (policy.action === 'bump_priority') {
      ticket.raisePriority(now);
      await this.tickets.save(ticket);
      return;
    }

    if (policy.action === 'unassign') {
      if (ticket.assignedAgentId) {
        ticket.unassign(now);
        await this.tickets.save(ticket);
        await this.eventBus.publish(
          new TicketUnassignedEvent(
            crypto.randomUUID(),
            now,
            ticket.organizationId,
            ticket.id,
            SYSTEM_ACTOR_ID,
          ),
        );
      }
      return;
    }

    ticket.escalate(now);
    if (policy.action === 'escalate_and_unassign' && ticket.assignedAgentId) {
      ticket.unassign(now);
    }
    await this.tickets.save(ticket);
    await this.eventBus.publish(
      new TicketEscalatedEvent(
        crypto.randomUUID(),
        now,
        ticket.organizationId,
        ticket.id,
        SYSTEM_ACTOR_ID,
        `Applied policy "${policy.name}"`,
      ),
    );
    if (policy.action === 'escalate_and_unassign') {
      await this.eventBus.publish(
        new TicketUnassignedEvent(
          crypto.randomUUID(),
          now,
          ticket.organizationId,
          ticket.id,
          SYSTEM_ACTOR_ID,
        ),
      );
    }
  }
}
