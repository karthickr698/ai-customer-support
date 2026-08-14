import type { EscalationRuleDto } from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { ConversationPolicy } from '../../domain/conversation-policy.js';
import { EscalationRuleNotFoundError } from '../../domain/errors.js';
import { createEscalationRuleId } from '../../domain/escalation-rule-id.js';
import { parseEscalationAction, parseEscalationTrigger } from '../../domain/escalation-trigger.js';
import { toEscalationRuleDto } from '../escalation-dtos.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { EscalationRuleRepository } from '../ports/escalation-rule-repository.js';
import type { TenantAccessPort } from '../ports/tenant-access-port.js';

export class UpdateEscalationRuleUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly rules: EscalationRuleRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly ruleId: string;
    readonly name?: string;
    readonly enabled?: boolean;
    readonly triggerType?: string;
    readonly triggerMinutes?: number | null;
    readonly keywords?: readonly string[];
    readonly action?: string;
    readonly priority?: number;
  }): Promise<{ rule: EscalationRuleDto }> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    ConversationPolicy.assertPermission(actor.permissions, Permissions.CONVERSATION_ESCALATE);

    const rule = await this.rules.findById(actor.tenantId, createEscalationRuleId(input.ruleId));
    if (!rule) {
      throw new EscalationRuleNotFoundError();
    }

    const trigger =
      input.triggerType || input.triggerMinutes !== undefined || input.keywords
        ? parseEscalationTrigger({
            type: input.triggerType ?? rule.trigger.type,
            minutes:
              input.triggerMinutes === undefined
                ? rule.trigger.type === 'unanswered_for' || rule.trigger.type === 'unassigned_for'
                  ? rule.trigger.minutes
                  : undefined
                : input.triggerMinutes,
            keywords:
              input.keywords ?? (rule.trigger.type === 'keyword_match' ? rule.trigger.keywords : undefined),
          })
        : undefined;

    rule.update(
      {
        name: input.name,
        enabled: input.enabled,
        trigger,
        action: input.action ? parseEscalationAction(input.action) : undefined,
        priority: input.priority,
      },
      this.clock.now(),
    );
    await this.rules.save(rule);
    return { rule: toEscalationRuleDto(rule) };
  }
}

export class DeleteEscalationRuleUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly rules: EscalationRuleRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly ruleId: string;
  }): Promise<void> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    ConversationPolicy.assertPermission(actor.permissions, Permissions.CONVERSATION_ESCALATE);

    const rule = await this.rules.findById(actor.tenantId, createEscalationRuleId(input.ruleId));
    if (!rule) {
      throw new EscalationRuleNotFoundError();
    }

    await this.rules.delete(actor.tenantId, rule.id);
  }
}
