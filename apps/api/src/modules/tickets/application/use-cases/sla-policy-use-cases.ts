import type {
  TicketSlaPolicyListResponse,
  TicketSlaPolicyResponse,
} from '@ai-customer-support/contracts';
import {
  DuplicateSlaPolicyError,
  TicketSlaPolicyNotFoundError,
  TooManyTicketRecordsError,
} from '../../domain/errors.js';
import { createTicketSlaPolicyId } from '../../domain/ids.js';
import { TicketSlaPolicy } from '../../domain/sla-policy.js';
import { MAX_SLA_POLICIES_PER_TENANT, TicketPolicy } from '../../domain/ticket-policy.js';
import { toSlaPolicyDto } from '../dtos.js';
import { TICKET_PERMISSION } from '../load-authorized-ticket-service.js';
import type { ClockPort, TenantAccessPort, TicketSlaPolicyRepository } from '../ports.js';

export class CreateTicketSlaPolicyUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly policies: TicketSlaPolicyRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly name: string;
    readonly appliesToPriority: string;
    readonly firstResponseMinutes: number;
    readonly resolutionMinutes: number;
    readonly enabled?: boolean;
  }): Promise<TicketSlaPolicyResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    TicketPolicy.assertPermission(actor.permissions, TICKET_PERMISSION);
    const count = await this.policies.countByTenant(actor.tenantId);
    if (count >= MAX_SLA_POLICIES_PER_TENANT) {
      throw new TooManyTicketRecordsError('SLA policies');
    }
    const policy = TicketSlaPolicy.create({
      organizationId: actor.tenantId,
      name: input.name,
      appliesToPriority: input.appliesToPriority,
      firstResponseMinutes: input.firstResponseMinutes,
      resolutionMinutes: input.resolutionMinutes,
      enabled: input.enabled,
      now: this.clock.now(),
    });
    const existing = await this.policies.findByPriority(actor.tenantId, policy.appliesToPriority);
    if (existing) {
      throw new DuplicateSlaPolicyError();
    }
    await this.policies.save(policy);
    return { policy: toSlaPolicyDto(policy) };
  }
}

export class ListTicketSlaPoliciesUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly policies: TicketSlaPolicyRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
  }): Promise<TicketSlaPolicyListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    TicketPolicy.assertPermission(actor.permissions, TICKET_PERMISSION);
    const items = await this.policies.listByTenant(actor.tenantId);
    return { items: items.map(toSlaPolicyDto) };
  }
}

export class UpdateTicketSlaPolicyUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly policies: TicketSlaPolicyRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly policyId: string;
    readonly name?: string;
    readonly enabled?: boolean;
    readonly appliesToPriority?: string;
    readonly firstResponseMinutes?: number;
    readonly resolutionMinutes?: number;
  }): Promise<TicketSlaPolicyResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    TicketPolicy.assertPermission(actor.permissions, TICKET_PERMISSION);
    const policy = await this.policies.findById(actor.tenantId, createTicketSlaPolicyId(input.policyId));
    if (!policy) {
      throw new TicketSlaPolicyNotFoundError();
    }
    if (input.appliesToPriority && input.appliesToPriority !== policy.appliesToPriority) {
      const existing = await this.policies.findByPriority(actor.tenantId, input.appliesToPriority);
      if (existing && existing.id !== policy.id) {
        throw new DuplicateSlaPolicyError();
      }
    }
    policy.update(
      {
        name: input.name,
        enabled: input.enabled,
        appliesToPriority: input.appliesToPriority,
        firstResponseMinutes: input.firstResponseMinutes,
        resolutionMinutes: input.resolutionMinutes,
      },
      this.clock.now(),
    );
    await this.policies.save(policy);
    return { policy: toSlaPolicyDto(policy) };
  }
}

export class DeleteTicketSlaPolicyUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly policies: TicketSlaPolicyRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly policyId: string;
  }): Promise<void> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    TicketPolicy.assertPermission(actor.permissions, TICKET_PERMISSION);
    const policy = await this.policies.findById(actor.tenantId, createTicketSlaPolicyId(input.policyId));
    if (!policy) {
      throw new TicketSlaPolicyNotFoundError();
    }
    await this.policies.delete(actor.tenantId, policy.id);
  }
}
