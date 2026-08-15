import { InvalidAttachmentError } from './errors.js';
import { createTicketAttachmentId, type TicketAttachmentId, type TicketId } from './ids.js';

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
export const MAX_ATTACHMENTS_PER_TICKET = 20;

export type TicketAttachmentSnapshot = {
  readonly id: TicketAttachmentId;
  readonly organizationId: string;
  readonly ticketId: TicketId;
  readonly fileName: string;
  readonly contentType: AllowedAttachmentContentType;
  readonly byteSize: number;
  readonly storageKey: string;
  readonly createdAt: Date;
};

export class TicketAttachment {
  private constructor(
    readonly id: TicketAttachmentId,
    readonly organizationId: string,
    readonly ticketId: TicketId,
    readonly fileName: string,
    readonly contentType: AllowedAttachmentContentType,
    readonly byteSize: number,
    readonly storageKey: string,
    readonly createdAt: Date,
  ) {}

  static create(input: {
    readonly organizationId: string;
    readonly ticketId: TicketId;
    readonly fileName: string;
    readonly contentType: string;
    readonly byteSize: number;
    readonly storageKey: string;
    readonly now: Date;
    readonly id?: TicketAttachmentId;
  }): TicketAttachment {
    return new TicketAttachment(
      input.id ?? createTicketAttachmentId(),
      input.organizationId,
      input.ticketId,
      normalizeFileName(input.fileName),
      parseContentType(input.contentType),
      parseByteSize(input.byteSize),
      input.storageKey,
      input.now,
    );
  }

  static reconstitute(snapshot: TicketAttachmentSnapshot): TicketAttachment {
    return new TicketAttachment(
      snapshot.id,
      snapshot.organizationId,
      snapshot.ticketId,
      snapshot.fileName,
      snapshot.contentType,
      snapshot.byteSize,
      snapshot.storageKey,
      snapshot.createdAt,
    );
  }

  belongsTo(tenantId: string): boolean {
    return this.organizationId === tenantId;
  }

  toSnapshot(): TicketAttachmentSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      ticketId: this.ticketId,
      fileName: this.fileName,
      contentType: this.contentType,
      byteSize: this.byteSize,
      storageKey: this.storageKey,
      createdAt: this.createdAt,
    };
  }
}

function parseContentType(value: string): AllowedAttachmentContentType {
  const contentType = value.trim().toLowerCase();
  if (!(ALLOWED_ATTACHMENT_CONTENT_TYPES as readonly string[]).includes(contentType)) {
    throw new InvalidAttachmentError('Attachment type must be PNG, JPEG, WebP, GIF, PDF, or plain text');
  }
  return contentType as AllowedAttachmentContentType;
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
