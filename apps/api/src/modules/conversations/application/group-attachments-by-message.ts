import type { MessageAttachment } from '../domain/message-attachment.js';

export function groupAttachmentsByMessage(
  attachments: readonly MessageAttachment[],
): Map<string, MessageAttachment[]> {
  const grouped = new Map<string, MessageAttachment[]>();
  for (const attachment of attachments) {
    const messageId = attachment.messageId;
    if (!messageId) {
      continue;
    }

    const current = grouped.get(messageId) ?? [];
    current.push(attachment);
    grouped.set(messageId, current);
  }

  return grouped;
}
