import type { AgentPresenceDto } from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { InsufficientPermissionError } from '../../../organizations/domain/errors.js';
import { AgentPolicy } from '../../domain/agent-policy.js';
import { AgentPresence } from '../../domain/agent-presence.js';
import { toPresenceDto } from '../dtos.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { AgentPresenceStorePort } from '../ports/agent-presence-store-port.js';
import type { OrganizationMemberDirectoryPort } from '../ports/organization-member-directory-port.js';
import type { TenantAccessPort } from '../ports/tenant-access-port.js';
import type { UserDirectoryPort } from '../ports/user-directory-port.js';
import { SetAgentPresenceStatusUseCase } from './mutate-agent-presence-use-cases.js';

export class ListAgentPresenceUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly members: OrganizationMemberDirectoryPort,
    private readonly store: AgentPresenceStorePort,
    private readonly users: UserDirectoryPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
  }): Promise<{ items: AgentPresenceDto[] }> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    AgentPolicy.assertPermission(actor.permissions, Permissions.CONVERSATION_READ);

    const members = await this.members.listActiveMembers(actor.tenantId);
    const assignable = members.filter((member) => member.role === 'owner' || member.role === 'admin' || member.role === 'agent');
    const stored = await this.store.list(
      actor.tenantId,
      assignable.map((member) => member.userId),
    );
    const byAgent = new Map(stored.map((presence) => [presence.agentId, presence]));
    const now = this.clock.now();

    const items: AgentPresenceDto[] = [];
    for (const member of assignable) {
      const presence = byAgent.get(member.userId) ?? AgentPresence.offline(actor.tenantId, member.userId, now);
      const user = await this.users.findById(member.userId);
      items.push(toPresenceDto(presence, member, user));
    }

    return { items };
  }
}

export class SetOwnAgentPresenceUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly members: OrganizationMemberDirectoryPort,
    private readonly users: UserDirectoryPort,
    private readonly setStatus: SetAgentPresenceStatusUseCase,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly status: string;
    readonly correlationId?: string;
  }): Promise<{ presence: AgentPresenceDto }> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    AgentPolicy.assertPermission(actor.permissions, Permissions.CONVERSATION_READ);

    const member = await this.members.findActiveMember(actor.tenantId, actor.actorId);
    if (!member) {
      throw new InsufficientPermissionError(Permissions.CONVERSATION_READ);
    }

    const presence = await this.setStatus.execute({
      tenantId: actor.tenantId,
      agentId: actor.actorId,
      status: input.status,
      correlationId: input.correlationId,
    });
    const user = await this.users.findById(actor.actorId);
    return { presence: toPresenceDto(presence, member, user) };
  }
}
