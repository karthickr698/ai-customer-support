import { InvalidAttachmentError } from './errors.js';
import { createMessageAttachmentId, type MessageAttachmentId } from './message-attachment-id.js';
import type { ConversationId } from './conversation-id.js';
import type { MessageId } from './message-id.js';

export const ALLOWED_ATTACHMENT_CONTENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
] as const;

export type AllowedAttachmentContentType = (typeof ALLOWED_ATTACHMENT_CONTENT_TYPES)[number];

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_MESSAGE = 5;

export type MessageAttachmentSnapshot = {
  readonly id: MessageAttachmentId;
  readonly organizationId: string;
  readonly conversationId: ConversationId;
  readonly messageId: MessageId | undefined;
  readonly widgetSessionId: string | undefined;
  readonly fileName: string;
  readonly contentType: AllowedAttachmentContentType;
  readonly byteSize: number;
  readonly storageKey: string;
  readonly createdAt: Date;
};

export class MessageAttachment {
  private constructor(
    readonly id: MessageAttachmentId,
    readonly organizationId: string,
    readonly conversationId: ConversationId,
    private messageIdValue: MessageId | undefined,
    readonly widgetSessionId: string | undefined,
    readonly fileName: string,
    readonly contentType: AllowedAttachmentContentType,
    readonly byteSize: number,
    readonly storageKey: string,
    readonly createdAt: Date,
  ) {}

  static create(input: {
    readonly organizationId: string;
    readonly conversationId: ConversationId;
    readonly widgetSessionId?: string;
    readonly fileName: string;
    readonly contentType: string;
    readonly byteSize: number;
    readonly storageKey: string;
    readonly now: Date;
    readonly id?: MessageAttachmentId;
  }): MessageAttachment {
    return new MessageAttachment(
      input.id ?? createMessageAttachmentId(),
      input.organizationId,
      input.conversationId,
      undefined,
      input.widgetSessionId,
      normalizeFileName(input.fileName),
      parseContentType(input.contentType),
      parseByteSize(input.byteSize),
      input.storageKey,
      input.now,
    );
  }

  static reconstitute(snapshot: MessageAttachmentSnapshot): MessageAttachment {
    return new MessageAttachment(
      snapshot.id,
      snapshot.organizationId,
      snapshot.conversationId,
      snapshot.messageId,
      snapshot.widgetSessionId,
      snapshot.fileName,
      snapshot.contentType,
      snapshot.byteSize,
      snapshot.storageKey,
      snapshot.createdAt,
    );
  }

  get messageId(): MessageId | undefined {
    return this.messageIdValue;
  }

  belongsTo(tenantId: string): boolean {
    return this.organizationId === tenantId;
  }

  attachToMessage(messageId: MessageId): void {
    if (this.messageIdValue && this.messageIdValue !== messageId) {
      throw new InvalidAttachmentError('Attachment is already linked to another message');
    }

    this.messageIdValue = messageId;
  }

  toSnapshot(): MessageAttachmentSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      conversationId: this.conversationId,
      messageId: this.messageIdValue,
      widgetSessionId: this.widgetSessionId,
      fileName: this.fileName,
      contentType: this.contentType,
      byteSize: this.byteSize,
      storageKey: this.storageKey,
      createdAt: this.createdAt,
    };
  }
}

export function isAllowedAttachmentContentType(
  value: string,
): value is AllowedAttachmentContentType {
  return (ALLOWED_ATTACHMENT_CONTENT_TYPES as readonly string[]).includes(value);
}

export function parseAllowedAttachmentContentType(value: string): AllowedAttachmentContentType {
  return parseContentType(value);
}

function parseContentType(value: string): AllowedAttachmentContentType {
  const contentType = value.trim().toLowerCase();
  if (!isAllowedAttachmentContentType(contentType)) {
    throw new InvalidAttachmentError(
      'Attachment type must be PNG, JPEG, WebP, GIF, PDF, or plain text',
    );
  }

  return contentType;
}

function parseByteSize(value: number): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new InvalidAttachmentError('Attachment is empty');
  }

  if (value > MAX_ATTACHMENT_BYTES) {
    throw new InvalidAttachmentError('Attachment must be 5MB or smaller');
  }

  return value;
}

function normalizeFileName(raw: string): string {
  const name = raw.replace(/[/\\]/g, '').trim();
  if (name.length < 1 || name.length > 180) {
    throw new InvalidAttachmentError('File name must be between 1 and 180 characters');
  }

  return name;
}
