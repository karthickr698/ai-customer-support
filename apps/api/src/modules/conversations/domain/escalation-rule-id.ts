export type EscalationRuleId = string & { readonly __brand: 'EscalationRuleId' };

export function createEscalationRuleId(id: string = crypto.randomUUID()): EscalationRuleId {
  return id as EscalationRuleId;
}
