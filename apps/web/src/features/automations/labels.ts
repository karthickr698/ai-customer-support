import type {
  AutomationActionType,
  AutomationConditionOperator,
  AutomationExecutionStatus,
  AutomationJobStatus,
  AutomationTriggerType,
} from '@ai-customer-support/contracts';
import {
  AUTOMATION_ACTION_TYPES,
  AUTOMATION_CONDITION_OPERATORS,
  AUTOMATION_SOURCE_EVENTS,
} from '@ai-customer-support/contracts';

export function automationsPath(organizationId: string, segment = ''): string {
  const base = `/organizations/${organizationId}/automations`;
  return segment ? `${base}/${segment}` : base;
}

export const TRIGGER_LABELS: Record<AutomationTriggerType, string> = {
  event: 'Event',
  schedule: 'Schedule',
};

export const ACTION_LABELS: Record<AutomationActionType, string> = {
  record: 'Record',
  http_request: 'HTTP request',
  emit_event: 'Emit event',
};

export const JOB_STATUS_LABELS: Record<AutomationJobStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  succeeded: 'Succeeded',
  skipped: 'Skipped',
  dead: 'Dead',
};

export const EXECUTION_STATUS_LABELS: Record<AutomationExecutionStatus, string> = {
  started: 'Started',
  succeeded: 'Succeeded',
  failed: 'Failed',
  skipped: 'Skipped',
};

export const OPERATOR_LABELS: Record<AutomationConditionOperator, string> = {
  eq: 'equals',
  neq: 'does not equal',
  contains: 'contains',
  exists: 'exists',
  gt: 'greater than',
  gte: 'greater or equal',
  lt: 'less than',
  lte: 'less or equal',
  in: 'in list',
  not_in: 'not in list',
};

export const EVENT_OPTIONS = AUTOMATION_SOURCE_EVENTS.map((event) => ({ value: event, label: event }));
export const ACTION_OPTIONS = AUTOMATION_ACTION_TYPES.map((action) => ({
  value: action,
  label: ACTION_LABELS[action],
}));
export const OPERATOR_OPTIONS = AUTOMATION_CONDITION_OPERATORS.map((operator) => ({
  value: operator,
  label: OPERATOR_LABELS[operator],
}));
