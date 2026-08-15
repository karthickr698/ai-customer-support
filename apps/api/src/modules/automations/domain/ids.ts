export type AutomationRuleId = string & { readonly __brand: 'AutomationRuleId' };
export type AutomationJobId = string & { readonly __brand: 'AutomationJobId' };
export type AutomationExecutionLogId = string & { readonly __brand: 'AutomationExecutionLogId' };

export function createAutomationRuleId(id: string = crypto.randomUUID()): AutomationRuleId {
  return id as AutomationRuleId;
}

export function createAutomationJobId(id: string = crypto.randomUUID()): AutomationJobId {
  return id as AutomationJobId;
}

export function createAutomationExecutionLogId(id: string = crypto.randomUUID()): AutomationExecutionLogId {
  return id as AutomationExecutionLogId;
}
