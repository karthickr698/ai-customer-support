import type { MessageFeedback } from '../domain/message-feedback.js';

export function groupFeedbackByMessage(
  feedbacks: readonly MessageFeedback[],
): Map<string, MessageFeedback> {
  const grouped = new Map<string, MessageFeedback>();
  for (const feedback of feedbacks) {
    grouped.set(feedback.messageId, feedback);
  }

  return grouped;
}
