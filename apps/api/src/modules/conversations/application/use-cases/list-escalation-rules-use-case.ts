import type { EscalationRuleDto } from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { ConversationPolicy } from '../../domain/conversation-policy.js';
import { toEscalationRuleDto } from '../escalation-dtos.js';
import type { EscalationRuleRepository } from '../ports/escalation-rule-repository.js';
import type { TenantAccessPort } from '../ports/tenant-access-port.js';

export class ListEscalationRulesUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly rules: EscalationRuleRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
  }): Promise<{ items: EscalationRuleDto[] }> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    ConversationPolicy.assertPermission(actor.permissions, Permissions.CONVERSATION_READ);

    const rules = await this.rules.listByTenant(actor.tenantId);
    return { items: rules.map(toEscalationRuleDto) };
  }
}
