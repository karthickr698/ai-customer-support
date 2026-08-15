import type { AutomationConditionOperator, AutomationMatchMode } from '@ai-customer-support/contracts';
import { InvalidAutomationError } from './errors.js';
import { parseConditionOperator } from './values.js';

export type AutomationCondition = {
  readonly field: string;
  readonly operator: AutomationConditionOperator;
  readonly value?: unknown;
};

const FIELD_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,63}(?:\.[a-zA-Z][a-zA-Z0-9_]{0,63}){0,5}$/;

export function parseConditions(raw: unknown): readonly AutomationCondition[] {
  if (raw === undefined || raw === null) {
    return [];
  }
  if (!Array.isArray(raw)) {
    throw new InvalidAutomationError('Conditions must be an array');
  }
  if (raw.length > 20) {
    throw new InvalidAutomationError('A rule may have at most 20 conditions');
  }
  return raw.map((item, index) => parseCondition(item, index));
}

function parseCondition(raw: unknown, index: number): AutomationCondition {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new InvalidAutomationError(`Condition ${index + 1} must be an object`);
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.field !== 'string') {
    throw new InvalidAutomationError(`Condition ${index + 1} field is required`);
  }
  const field = record.field.trim();
  if (!FIELD_PATTERN.test(field)) {
    throw new InvalidAutomationError(`Condition ${index + 1} field path is invalid`);
  }
  if (typeof record.operator !== 'string') {
    throw new InvalidAutomationError(`Condition ${index + 1} operator is required`);
  }
  const operator = parseConditionOperator(record.operator);
  if (operator !== 'exists' && record.value === undefined) {
    throw new InvalidAutomationError(`Condition ${index + 1} requires a value`);
  }
  if ((operator === 'in' || operator === 'not_in') && !Array.isArray(record.value)) {
    throw new InvalidAutomationError(`Condition ${index + 1} value must be an array`);
  }
  return { field, operator, value: record.value };
}

export function conditionsMatch(
  conditions: readonly AutomationCondition[],
  match: AutomationMatchMode,
  payload: Record<string, unknown>,
): boolean {
  if (conditions.length === 0) {
    return true;
  }
  const results = conditions.map((condition) => evaluateCondition(condition, payload));
  return match === 'any' ? results.some(Boolean) : results.every(Boolean);
}

function evaluateCondition(condition: AutomationCondition, payload: Record<string, unknown>): boolean {
  const actual = readPath(payload, condition.field);
  switch (condition.operator) {
    case 'exists':
      return actual !== undefined && actual !== null;
    case 'eq':
      return valuesEqual(actual, condition.value);
    case 'neq':
      return !valuesEqual(actual, condition.value);
    case 'contains':
      return containsValue(actual, condition.value);
    case 'gt':
      return compare(actual, condition.value) > 0;
    case 'gte':
      return compare(actual, condition.value) >= 0;
    case 'lt':
      return compare(actual, condition.value) < 0;
    case 'lte':
      return compare(actual, condition.value) <= 0;
    case 'in':
      return Array.isArray(condition.value) && condition.value.some((item) => valuesEqual(actual, item));
    case 'not_in':
      return Array.isArray(condition.value) && !condition.value.some((item) => valuesEqual(actual, item));
  }
}

function readPath(payload: Record<string, unknown>, field: string): unknown {
  const parts = field.split('.');
  let current: unknown = payload;
  for (const part of parts) {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }
  if (left === undefined || right === undefined || left === null || right === null) {
    return left === right;
  }
  if (typeof left === 'object' || typeof right === 'object') {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  return String(left) === String(right);
}

function containsValue(actual: unknown, expected: unknown): boolean {
  if (typeof actual === 'string' && (typeof expected === 'string' || typeof expected === 'number')) {
    return actual.toLowerCase().includes(String(expected).toLowerCase());
  }
  if (Array.isArray(actual)) {
    return actual.some((item) => valuesEqual(item, expected));
  }
  return false;
}

function compare(left: unknown, right: unknown): number {
  const a = toComparable(left);
  const b = toComparable(right);
  if (a === undefined || b === undefined) {
    return Number.NaN;
  }
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

function toComparable(value: unknown): number | string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && value.trim() !== '') {
      const date = Date.parse(value);
      if (!Number.isNaN(date) && /[T-]/.test(value)) {
        return date;
      }
      if (!Number.isNaN(asNumber) && value.trim() === String(asNumber)) {
        return asNumber;
      }
    }
    const date = Date.parse(value);
    if (!Number.isNaN(date)) {
      return date;
    }
    return value;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  return undefined;
}
