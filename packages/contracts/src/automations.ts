/**
 * Cross-runtime DTOs for tenant-scoped event-driven automation rules, jobs, and execution logs.
 */

export const AUTOMATION_TRIGGER_TYPES = ['event', 'schedule'] as const;
export type AutomationTriggerType = (typeof AUTOMATION_TRIGGER_TYPES)[number];

export const AUTOMATION_MATCH_MODES = ['all', 'any'] as const;
export type AutomationMatchMode = (typeof AUTOMATION_MATCH_MODES)[number];

export const AUTOMATION_CONDITION_OPERATORS = [
  'eq',
  'neq',
  'contains',
  'exists',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'not_in',
] as const;
export type AutomationConditionOperator = (typeof AUTOMATION_CONDITION_OPERATORS)[number];

export const AUTOMATION_ACTION_TYPES = ['record', 'http_request', 'emit_event'] as const;
export type AutomationActionType = (typeof AUTOMATION_ACTION_TYPES)[number];

export const AUTOMATION_JOB_STATUSES = [
  'pending',
  'running',
  'succeeded',
  'skipped',
  'dead',
] as const;
export type AutomationJobStatus = (typeof AUTOMATION_JOB_STATUSES)[number];

export const AUTOMATION_EXECUTION_STATUSES = ['started', 'succeeded', 'failed', 'skipped'] as const;
export type AutomationExecutionStatus = (typeof AUTOMATION_EXECUTION_STATUSES)[number];

export const AUTOMATION_HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH'] as const;
export type AutomationHttpMethod = (typeof AUTOMATION_HTTP_METHODS)[number];

export const AUTOMATION_SOURCE_EVENTS = [
  'ConversationCreated',
  'MessageReceived',
  'MessageSent',
  'ConversationStatusChanged',
  'ConversationEscalated',
  'AgentAssigned',
  'AgentUnassigned',
  'ConversationNoteAdded',
  'AttachmentUploaded',
  'TicketCreated',
  'TicketStatusChanged',
  'TicketAssigned',
  'TicketUnassigned',
  'TicketEscalated',
  'TicketNoteAdded',
  'TicketAttachmentUploaded',
  'TicketSlaBreached',
  'CustomerRegistered',
  'ProductRegistered',
  'OrderRegistered',
  'ShipmentRegistered',
  'ReturnRegistered',
  'KnowledgeDocumentUploaded',
  'KnowledgeDocumentProcessed',
  'AgentPresenceChanged',
  'WidgetSessionCreated',
  'OrganizationCreated',
  'MemberInvited',
  'InvitationAccepted',
] as const;
export type AutomationSourceEvent = (typeof AUTOMATION_SOURCE_EVENTS)[number];

export type AutomationConditionDto = {
  readonly field: string;
  readonly operator: AutomationConditionOperator;
  readonly value?: unknown;
};

export type AutomationActionConfigDto = {
  readonly message?: string;
  readonly url?: string;
  readonly method?: AutomationHttpMethod;
  readonly headers?: Record<string, string>;
  readonly body?: Record<string, unknown>;
  readonly timeoutMs?: number;
  readonly data?: Record<string, unknown>;
};

export type AutomationRuleDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly description: string | null;
  readonly enabled: boolean;
  readonly triggerType: AutomationTriggerType;
  readonly eventName: AutomationSourceEvent | null;
  readonly schedule: string | null;
  readonly match: AutomationMatchMode;
  readonly conditions: readonly AutomationConditionDto[];
  readonly actionType: AutomationActionType;
  readonly action: AutomationActionConfigDto;
  readonly maxAttempts: number;
  readonly backoffMs: number;
  readonly priority: number;
  readonly nextRunAt: string | null;
  readonly createdByUserId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CreateAutomationRuleRequest = {
  readonly name: string;
  readonly description?: string;
  readonly enabled?: boolean;
  readonly triggerType: AutomationTriggerType;
  readonly eventName?: AutomationSourceEvent;
  readonly schedule?: string;
  readonly match?: AutomationMatchMode;
  readonly conditions?: readonly AutomationConditionDto[];
  readonly actionType: AutomationActionType;
  readonly action?: AutomationActionConfigDto;
  readonly maxAttempts?: number;
  readonly backoffMs?: number;
  readonly priority?: number;
};

export type UpdateAutomationRuleRequest = {
  readonly name?: string;
  readonly description?: string | null;
  readonly enabled?: boolean;
  readonly triggerType?: AutomationTriggerType;
  readonly eventName?: AutomationSourceEvent | null;
  readonly schedule?: string | null;
  readonly match?: AutomationMatchMode;
  readonly conditions?: readonly AutomationConditionDto[];
  readonly actionType?: AutomationActionType;
  readonly action?: AutomationActionConfigDto;
  readonly maxAttempts?: number;
  readonly backoffMs?: number;
  readonly priority?: number;
};

export type AutomationRuleResponse = {
  readonly rule: AutomationRuleDto;
};

export type AutomationRuleListResponse = {
  readonly items: readonly AutomationRuleDto[];
};

export type RunAutomationRequest = {
  readonly idempotencyKey?: string;
  readonly payload?: Record<string, unknown>;
};

export type AutomationJobDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly ruleId: string;
  readonly triggerKind: 'event' | 'schedule' | 'manual';
  readonly idempotencyKey: string;
  readonly eventName: string | null;
  readonly eventId: string | null;
  readonly payload: Record<string, unknown>;
  readonly status: AutomationJobStatus;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly runAfter: string;
  readonly lastError: string | null;
  readonly claimedAt: string | null;
  readonly completedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type AutomationJobResponse = {
  readonly job: AutomationJobDto;
};

export type AutomationJobListResponse = {
  readonly items: readonly AutomationJobDto[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};

export type AutomationExecutionLogDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly jobId: string;
  readonly ruleId: string;
  readonly attempt: number;
  readonly status: AutomationExecutionStatus;
  readonly message: string | null;
  readonly input: Record<string, unknown> | null;
  readonly output: Record<string, unknown> | null;
  readonly startedAt: string;
  readonly finishedAt: string | null;
};

export type AutomationExecutionLogListResponse = {
  readonly items: readonly AutomationExecutionLogDto[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};

export type DispatchAutomationsResponse = {
  readonly enqueued: number;
  readonly scheduled: number;
};

export type RunAutomationResponse = {
  readonly job: AutomationJobDto;
  readonly created: boolean;
};
