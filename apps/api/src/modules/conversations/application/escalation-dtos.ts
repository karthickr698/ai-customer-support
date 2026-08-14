import type { EscalationRuleDto } from '@ai-customer-support/contracts';
import type { EscalationRule } from '../domain/escalation-rule.js';

export function toEscalationRuleDto(rule: EscalationRule): EscalationRuleDto {
  const snapshot = rule.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    name: snapshot.name,
    enabled: snapshot.enabled,
    triggerType: snapshot.trigger.type,
    triggerMinutes:
      snapshot.trigger.type === 'unanswered_for' || snapshot.trigger.type === 'unassigned_for'
        ? snapshot.trigger.minutes
        : null,
    keywords: snapshot.trigger.type === 'keyword_match' ? snapshot.trigger.keywords : [],
    action: snapshot.action,
    priority: snapshot.priority,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}
