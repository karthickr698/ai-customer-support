import type {
  AutomationActionType,
  AutomationConditionOperator,
  AutomationExecutionStatus,
  AutomationHttpMethod,
  AutomationJobStatus,
  AutomationMatchMode,
  AutomationSourceEvent,
  AutomationTriggerType,
} from '@ai-customer-support/contracts';
import {
  AUTOMATION_ACTION_TYPES,
  AUTOMATION_CONDITION_OPERATORS,
  AUTOMATION_EXECUTION_STATUSES,
  AUTOMATION_HTTP_METHODS,
  AUTOMATION_JOB_STATUSES,
  AUTOMATION_MATCH_MODES,
  AUTOMATION_SOURCE_EVENTS,
  AUTOMATION_TRIGGER_TYPES,
} from '@ai-customer-support/contracts';
import { InvalidAutomationError } from './errors.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseTriggerType(value: string): AutomationTriggerType {
  if (!(AUTOMATION_TRIGGER_TYPES as readonly string[]).includes(value)) {
    throw new InvalidAutomationError('Trigger type must be event or schedule');
  }
  return value as AutomationTriggerType;
}

export function parseMatchMode(value: string | undefined): AutomationMatchMode {
  const match = (value ?? 'all').trim();
  if (!(AUTOMATION_MATCH_MODES as readonly string[]).includes(match)) {
    throw new InvalidAutomationError('Match mode must be all or any');
  }
  return match as AutomationMatchMode;
}

export function parseConditionOperator(value: string): AutomationConditionOperator {
  if (!(AUTOMATION_CONDITION_OPERATORS as readonly string[]).includes(value)) {
    throw new InvalidAutomationError('Condition operator is invalid');
  }
  return value as AutomationConditionOperator;
}

export function parseActionType(value: string): AutomationActionType {
  if (!(AUTOMATION_ACTION_TYPES as readonly string[]).includes(value)) {
    throw new InvalidAutomationError('Action type must be record, http_request, or emit_event');
  }
  return value as AutomationActionType;
}

export function parseJobStatus(value: string): AutomationJobStatus {
  if (!(AUTOMATION_JOB_STATUSES as readonly string[]).includes(value)) {
    throw new InvalidAutomationError('Automation job status is invalid');
  }
  return value as AutomationJobStatus;
}

export function parseExecutionStatus(value: string): AutomationExecutionStatus {
  if (!(AUTOMATION_EXECUTION_STATUSES as readonly string[]).includes(value)) {
    throw new InvalidAutomationError('Execution log status is invalid');
  }
  return value as AutomationExecutionStatus;
}

export function parseHttpMethod(value: string | undefined): AutomationHttpMethod {
  const method = (value ?? 'POST').trim().toUpperCase();
  if (!(AUTOMATION_HTTP_METHODS as readonly string[]).includes(method)) {
    throw new InvalidAutomationError('HTTP method must be GET, POST, PUT, or PATCH');
  }
  return method as AutomationHttpMethod;
}

export function parseSourceEvent(value: string): AutomationSourceEvent {
  if (!(AUTOMATION_SOURCE_EVENTS as readonly string[]).includes(value)) {
    throw new InvalidAutomationError('Event name is not an allowed automation trigger');
  }
  return value as AutomationSourceEvent;
}

export function parsePriority(value: number | undefined): number {
  const priority = value ?? 100;
  if (!Number.isInteger(priority) || priority < 1 || priority > 1_000) {
    throw new InvalidAutomationError('Priority must be an integer between 1 and 1000');
  }
  return priority;
}

export function parseRetryPolicy(input: {
  readonly maxAttempts?: number;
  readonly backoffMs?: number;
}): { maxAttempts: number; backoffMs: number } {
  const maxAttempts = input.maxAttempts ?? 3;
  const backoffMs = input.backoffMs ?? 5_000;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) {
    throw new InvalidAutomationError('maxAttempts must be an integer between 1 and 20');
  }
  if (!Number.isInteger(backoffMs) || backoffMs < 100 || backoffMs > 3_600_000) {
    throw new InvalidAutomationError('backoffMs must be an integer between 100 and 3600000');
  }
  return { maxAttempts, backoffMs };
}

export function normalizeText(raw: string, label: string, min: number, max: number): string {
  const value = raw.trim();
  if (value.length < min || value.length > max) {
    throw new InvalidAutomationError(`${label} must be between ${min} and ${max} characters`);
  }
  return value;
}

export function normalizeOptionalText(
  raw: string | null | undefined,
  label: string,
  max: number,
): string | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  const value = raw.trim();
  if (value.length === 0) {
    return undefined;
  }
  if (value.length > max) {
    throw new InvalidAutomationError(`${label} must be at most ${max} characters`);
  }
  return value;
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function requireUuid(value: string, label: string): string {
  const trimmed = value.trim();
  if (!isUuid(trimmed)) {
    throw new InvalidAutomationError(`${label} must be a UUID`);
  }
  return trimmed;
}

export function jsonObject(value: unknown, label: string): Record<string, unknown> {
  if (value === undefined || value === null) {
    return {};
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new InvalidAutomationError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

export function jsonRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function retryDelayMs(attempt: number, backoffMs: number): number {
  const exponent = Math.max(0, attempt - 1);
  return Math.min(backoffMs * 2 ** exponent, 3_600_000);
}
