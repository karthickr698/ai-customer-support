import type { EscalationRuleDto } from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { EscalationRule } from '../../domain/escalation-rule.js';
import { parseEscalationAction, parseEscalationTrigger } from '../../domain/escalation-trigger.js';
import { ConversationPolicy } from '../../domain/conversation-policy.js';
import { toEscalationRuleDto } from '../escalation-dtos.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { EscalationRuleRepository } from '../ports/escalation-rule-repository.js';
import type { TenantAccessPort } from '../ports/tenant-access-port.js';

export class CreateEscalationRuleUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly rules: EscalationRuleRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly name: string;
    readonly enabled?: boolean;
    readonly triggerType: string;
    readonly triggerMinutes?: number;
    readonly keywords?: readonly string[];
    readonly action: string;
    readonly priority?: number;
  }): Promise<{ rule: EscalationRuleDto }> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    ConversationPolicy.assertPermission(actor.permissions, Permissions.CONVERSATION_ESCALATE);

    const rule = EscalationRule.create({
      organizationId: actor.tenantId,
      name: input.name,
      enabled: input.enabled,
      trigger: parseEscalationTrigger({
        type: input.triggerType,
        minutes: input.triggerMinutes,
        keywords: input.keywords,
      }),
      action: parseEscalationAction(input.action),
      priority: input.priority,
      now: this.clock.now(),
    });
    await this.rules.save(rule);
    return { rule: toEscalationRuleDto(rule) };
  }
}
