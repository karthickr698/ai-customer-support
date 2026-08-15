import { describe, expect, it } from 'vitest';
import {
  InvalidMessageFeedbackError,
  MessageFeedback,
} from '../../../apps/api/src/modules/conversations/domain/message-feedback.ts';
import { createConversationId } from '../../../apps/api/src/modules/conversations/domain/conversation-id.ts';
import { createMessageId } from '../../../apps/api/src/modules/conversations/domain/message-id.ts';

const now = new Date('2026-08-15T12:00:00.000Z');
const conversationId = createConversationId('11111111-1111-4111-8111-111111111111');
const messageId = createMessageId('22222222-2222-4222-8222-222222222222');

describe('MessageFeedback', () => {
  it('creates helpful feedback and allows an update', () => {
    const feedback = MessageFeedback.create({
      organizationId: 'org-1',
      conversationId,
      messageId,
      widgetSessionId: 'session-1',
      rating: 'helpful',
      now,
    });

    expect(feedback.rating).toBe('helpful');
    expect(feedback.comment).toBeUndefined();

    const later = new Date('2026-08-15T12:05:00.000Z');
    feedback.update({ rating: 'not_helpful', comment: 'Too generic', now: later });
    expect(feedback.rating).toBe('not_helpful');
    expect(feedback.comment).toBe('Too generic');
    expect(feedback.updatedAt).toEqual(later);
  });

  it('rejects invalid ratings and overlong comments', () => {
    expect(() =>
      MessageFeedback.create({
        organizationId: 'org-1',
        conversationId,
        messageId,
        widgetSessionId: 'session-1',
        rating: 'love-it',
        now,
      }),
    ).toThrow(InvalidMessageFeedbackError);

    expect(() =>
      MessageFeedback.create({
        organizationId: 'org-1',
        conversationId,
        messageId,
        widgetSessionId: 'session-1',
        rating: 'helpful',
        comment: 'x'.repeat(501),
        now,
      }),
    ).toThrow(InvalidMessageFeedbackError);
  });
});
