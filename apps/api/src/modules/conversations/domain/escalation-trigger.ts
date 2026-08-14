import { InvalidEscalationRuleError } from './errors.js';

export const ESCALATION_TRIGGER_TYPES = [
  'unanswered_for',
  'unassigned_for',
  'assigned_agent_offline',
  'keyword_match',
] as const;
export type EscalationTriggerType = (typeof ESCALATION_TRIGGER_TYPES)[number];

export const ESCALATION_ACTIONS = ['escalate', 'escalate_and_unassign', 'assign_available'] as const;
export type EscalationAction = (typeof ESCALATION_ACTIONS)[number];

export type EscalationTrigger =
  | { readonly type: 'unanswered_for'; readonly minutes: number }
  | { readonly type: 'unassigned_for'; readonly minutes: number }
  | { readonly type: 'assigned_agent_offline' }
  | { readonly type: 'keyword_match'; readonly keywords: readonly string[] };

export function isEscalationTriggerType(value: string): value is EscalationTriggerType {
  return (ESCALATION_TRIGGER_TYPES as readonly string[]).includes(value);
}

export function isEscalationAction(value: string): value is EscalationAction {
  return (ESCALATION_ACTIONS as readonly string[]).includes(value);
}

export function parseEscalationAction(value: string): EscalationAction {
  if (!isEscalationAction(value)) {
    throw new InvalidEscalationRuleError('Action must be escalate, escalate_and_unassign, or assign_available');
  }

  return value;
}

export function parseEscalationTrigger(input: {
  readonly type: string;
  readonly minutes?: number | null;
  readonly keywords?: readonly string[];
}): EscalationTrigger {
  if (!isEscalationTriggerType(input.type)) {
    throw new InvalidEscalationRuleError(
      'Trigger must be unanswered_for, unassigned_for, assigned_agent_offline, or keyword_match',
    );
  }

  if (input.type === 'assigned_agent_offline') {
    return { type: 'assigned_agent_offline' };
  }

  if (input.type === 'keyword_match') {
    const keywords = normalizeKeywords(input.keywords ?? []);
    if (keywords.length === 0) {
      throw new InvalidEscalationRuleError('Keyword rules need at least one keyword');
    }

    return { type: 'keyword_match', keywords };
  }

  const minutes = input.minutes;
  if (minutes === undefined || minutes === null || !Number.isInteger(minutes) || minutes < 1 || minutes > 10_080) {
    throw new InvalidEscalationRuleError('Time-based rules need triggerMinutes between 1 and 10080');
  }

  return { type: input.type, minutes };
}

export function normalizeKeywords(raw: readonly string[]): string[] {
  const unique = new Set<string>();
  for (const value of raw) {
    const keyword = value.trim().toLowerCase();
    if (keyword.length < 2 || keyword.length > 64) {
      throw new InvalidEscalationRuleError('Keywords must be between 2 and 64 characters');
    }

    unique.add(keyword);
  }

  if (unique.size > 20) {
    throw new InvalidEscalationRuleError('A rule can have at most 20 keywords');
  }

  return [...unique];
}
