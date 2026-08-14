import { InvalidConversationChannelError } from './errors.js';

export const CONVERSATION_CHANNELS = ['web', 'email', 'api', 'widget'] as const;
export type ConversationChannel = (typeof CONVERSATION_CHANNELS)[number];

export function isConversationChannel(value: string): value is ConversationChannel {
  return (CONVERSATION_CHANNELS as readonly string[]).includes(value);
}

export function parseConversationChannel(value: string): ConversationChannel {
  if (!isConversationChannel(value)) {
    throw new InvalidConversationChannelError();
  }

  return value;
}
