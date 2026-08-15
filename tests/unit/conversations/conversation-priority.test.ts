import { describe, expect, it } from 'vitest';
import { Conversation } from '../../../apps/api/src/modules/conversations/domain/conversation.ts';
import {
  parseConversationPriority,
} from '../../../apps/api/src/modules/conversations/domain/conversation-priority.ts';
import { CustomerContact } from '../../../apps/api/src/modules/conversations/domain/customer-contact.ts';
import { InvalidConversationPriorityError } from '../../../apps/api/src/modules/conversations/domain/errors.ts';

const now = new Date('2026-08-15T12:00:00.000Z');
const later = new Date('2026-08-15T12:05:00.000Z');

function createConversation(priority?: string) {
  return Conversation.create({
    organizationId: '11111111-1111-4111-8111-111111111111',
    customer: CustomerContact.parse({ email: 'pat@example.com', name: 'Pat Customer' }),
    subject: 'Billing question',
    now,
    priority,
  });
}

describe('conversation priority', () => {
  it('defaults new conversations to normal', () => {
    expect(createConversation().priority).toBe('normal');
  });

  it('accepts an explicit priority on create', () => {
    expect(createConversation('urgent').priority).toBe('urgent');
  });

  it('changes priority and records the update time', () => {
    const conversation = createConversation();
    conversation.changePriority(parseConversationPriority('high'), later);
    expect(conversation.priority).toBe('high');
    expect(conversation.updatedAt).toEqual(later);
  });

  it('does not bump updatedAt when priority is unchanged', () => {
    const conversation = createConversation('high');
    conversation.changePriority(parseConversationPriority('high'), later);
    expect(conversation.updatedAt).toEqual(now);
  });

  it('rejects unknown priorities', () => {
    expect(() => parseConversationPriority('critical')).toThrow(InvalidConversationPriorityError);
  });
});
