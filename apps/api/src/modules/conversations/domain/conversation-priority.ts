import { InvalidConversationPriorityError } from './errors.js';

export const CONVERSATION_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type ConversationPriority = (typeof CONVERSATION_PRIORITIES)[number];

export function isConversationPriority(value: string): value is ConversationPriority {
  return (CONVERSATION_PRIORITIES as readonly string[]).includes(value);
}

export function parseConversationPriority(value: string | undefined): ConversationPriority {
  const priority = (value ?? 'normal').trim();
  if (!isConversationPriority(priority)) {
    throw new InvalidConversationPriorityError();
  }

  return priority;
}
