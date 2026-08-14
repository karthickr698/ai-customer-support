import { InvalidConversationStateError, InvalidConversationStatusError } from './errors.js';

export const CONVERSATION_STATUSES = [
  'open',
  'pending',
  'resolved',
  'closed',
  'escalated',
] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export type AgentConversationStatus = Exclude<ConversationStatus, 'escalated'>;

const ALLOWED_TRANSITIONS: Record<ConversationStatus, readonly ConversationStatus[]> = {
  open: ['pending', 'resolved', 'closed', 'escalated'],
  pending: ['open', 'resolved', 'closed', 'escalated'],
  resolved: ['open', 'closed'],
  closed: ['open'],
  escalated: ['open', 'pending', 'resolved', 'closed'],
};

export function isConversationStatus(value: string): value is ConversationStatus {
  return (CONVERSATION_STATUSES as readonly string[]).includes(value);
}

export function parseConversationStatus(value: string): ConversationStatus {
  if (!isConversationStatus(value)) {
    throw new InvalidConversationStatusError();
  }

  return value;
}

export function assertStatusTransition(from: ConversationStatus, to: ConversationStatus): void {
  if (from === to) {
    return;
  }

  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new InvalidConversationStateError(
      `Cannot change conversation status from ${from} to ${to}`,
    );
  }
}

export function canEscalateFrom(status: ConversationStatus): boolean {
  return status === 'open' || status === 'pending';
}
