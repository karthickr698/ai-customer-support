import { describe, expect, it } from 'vitest';
import { Conversation } from '../../../apps/api/src/modules/conversations/domain/conversation.ts';
import { CustomerContact } from '../../../apps/api/src/modules/conversations/domain/customer-contact.ts';

const now = new Date('2026-08-16T12:00:00.000Z');

function createConversation() {
  return Conversation.create({
    organizationId: '11111111-1111-4111-8111-111111111111',
    customer: CustomerContact.parse({ email: 'pat@example.com', name: 'Pat Customer' }),
    now,
  });
}

describe('Conversation AI reply policy', () => {
  it('allows AI replies on unassigned open conversations', () => {
    const conversation = createConversation();
    expect(conversation.canGenerateAiReply()).toBe(true);
  });

  it('pauses AI replies after a human agent is assigned', () => {
    const conversation = createConversation();
    conversation.assignTo('22222222-2222-4222-8222-222222222222', now);
    expect(conversation.canGenerateAiReply()).toBe(false);
  });

  it('resumes AI replies after unassign', () => {
    const conversation = createConversation();
    conversation.assignTo('22222222-2222-4222-8222-222222222222', now);
    conversation.unassign(now);
    expect(conversation.canGenerateAiReply()).toBe(true);
  });
});
