import { InvalidConversationTagError } from './errors.js';

const TAG_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;

export class ConversationTag {
  private constructor(readonly value: string) {}

  static parse(raw: string): ConversationTag {
    const name = raw.trim().toLowerCase();

    if (!TAG_PATTERN.test(name)) {
      throw new InvalidConversationTagError();
    }

    return new ConversationTag(name);
  }
}
