import type { EscalationRule } from '../../domain/escalation-rule.js';
import type { EscalationRuleId } from '../../domain/escalation-rule-id.js';

export interface EscalationRuleRepository {
  findById(tenantId: string, ruleId: EscalationRuleId): Promise<EscalationRule | null>;
  save(rule: EscalationRule): Promise<void>;
  delete(tenantId: string, ruleId: EscalationRuleId): Promise<void>;
  listByTenant(tenantId: string): Promise<EscalationRule[]>;
  listEnabled(tenantId: string): Promise<EscalationRule[]>;
  listTenantIdsWithEnabledRules(): Promise<string[]>;
}
