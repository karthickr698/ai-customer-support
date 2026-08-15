import type {
  SlaBreachKind,
  SlaPolicyPriority,
  TicketEscalationAction,
  TicketEscalationTriggerType,
  TicketPriority,
  TicketSource,
  TicketStatus,
} from '@ai-customer-support/contracts';
import {
  SLA_BREACH_KINDS,
  SLA_POLICY_PRIORITIES,
  TICKET_ESCALATION_ACTIONS,
  TICKET_ESCALATION_TRIGGER_TYPES,
  TICKET_PRIORITIES,
  TICKET_SOURCES,
  TICKET_STATUSES,
} from '@ai-customer-support/contracts';
import { InvalidTicketError, InvalidTicketStateError } from './errors.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  open: ['pending', 'resolved', 'closed', 'escalated'],
  pending: ['open', 'resolved', 'closed', 'escalated'],
  escalated: ['open', 'pending', 'resolved', 'closed'],
  resolved: ['open', 'closed'],
  closed: ['open'],
};

export function parseTicketStatus(value: string | undefined): TicketStatus {
  const status = (value ?? 'open').trim();
  if (!(TICKET_STATUSES as readonly string[]).includes(status)) {
    throw new InvalidTicketError('Ticket status must be open, pending, resolved, closed, or escalated');
  }
  return status as TicketStatus;
}

export function parseTicketPriority(value: string | undefined): TicketPriority {
  const priority = (value ?? 'normal').trim();
  if (!(TICKET_PRIORITIES as readonly string[]).includes(priority)) {
    throw new InvalidTicketError('Ticket priority must be low, normal, high, or urgent');
  }
  return priority as TicketPriority;
}

export function parseTicketSource(value: string | undefined): TicketSource {
  const source = (value ?? 'agent').trim();
  if (!(TICKET_SOURCES as readonly string[]).includes(source)) {
    throw new InvalidTicketError('Ticket source is invalid');
  }
  return source as TicketSource;
}

export function parseSlaPolicyPriority(value: string): SlaPolicyPriority {
  const priority = value.trim();
  if (!(SLA_POLICY_PRIORITIES as readonly string[]).includes(priority)) {
    throw new InvalidTicketError('SLA policy priority must be any, low, normal, high, or urgent');
  }
  return priority as SlaPolicyPriority;
}

export function parseSlaBreachKind(value: string): SlaBreachKind {
  if (!(SLA_BREACH_KINDS as readonly string[]).includes(value)) {
    throw new InvalidTicketError('SLA breach kind must be first_response or resolution');
  }
  return value as SlaBreachKind;
}

export function parseEscalationTriggerType(value: string): TicketEscalationTriggerType {
  if (!(TICKET_ESCALATION_TRIGGER_TYPES as readonly string[]).includes(value)) {
    throw new InvalidTicketError('Escalation trigger is invalid');
  }
  return value as TicketEscalationTriggerType;
}

export function parseEscalationAction(value: string): TicketEscalationAction {
  if (!(TICKET_ESCALATION_ACTIONS as readonly string[]).includes(value)) {
    throw new InvalidTicketError('Escalation action is invalid');
  }
  return value as TicketEscalationAction;
}

export function assertStatusTransition(from: TicketStatus, to: TicketStatus): void {
  if (from === to) {
    return;
  }
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new InvalidTicketStateError(`Cannot change ticket status from ${from} to ${to}`);
  }
}

export function canEscalateFrom(status: TicketStatus): boolean {
  return status === 'open' || status === 'pending';
}

export function isOpenLifecycle(status: TicketStatus): boolean {
  return status === 'open' || status === 'pending' || status === 'escalated';
}

export function bumpPriority(priority: TicketPriority): TicketPriority {
  if (priority === 'low') {
    return 'normal';
  }
  if (priority === 'normal') {
    return 'high';
  }
  return 'urgent';
}

export function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw new InvalidTicketError('Enter a valid customer email address');
  }
  return email;
}

export function normalizeText(raw: string, label: string, min: number, max: number): string {
  const value = raw.trim();
  if (value.length < min || value.length > max) {
    throw new InvalidTicketError(`${label} must be between ${min} and ${max} characters`);
  }
  return value;
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function requireUuid(value: string | undefined, label: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  if (!isUuid(trimmed)) {
    throw new InvalidTicketError(`${label} must be a UUID`);
  }
  return trimmed;
}
