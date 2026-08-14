import type { MessageAttachmentDto } from '@ai-customer-support/contracts';
import type { EventBus } from '@ai-customer-support/shared';
import {
  AttachmentsNotAllowedError,
  ConversationNotFoundError,
  UnauthorizedConversationAccessError,
} from '../../domain/errors.js';
import { AttachmentUploadedEvent } from '../../domain/events.js';
import { MessageAttachment } from '../../domain/message-attachment.js';
import { createConversationId } from '../../domain/conversation-id.js';
import { toAttachmentDto, type RequestSecurityContext } from '../dtos.js';
import type { LoadAuthorizedConversationService } from '../load-authorized-conversation-service.js';
import type { LoadWidgetConversationService } from '../load-widget-conversation-service.js';
import type { AttachmentStoragePort } from '../ports/attachment-storage-port.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { MessageAttachmentRepository } from '../ports/message-attachment-repository.js';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { createMessageAttachmentId } from '../../domain/message-attachment-id.js';

export class UploadWidgetAttachmentUseCase {
  constructor(
    private readonly authorized: LoadWidgetConversationService,
    private readonly attachments: MessageAttachmentRepository,
    private readonly storage: AttachmentStoragePort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly sessionToken: string;
    readonly origin: string | undefined;
    readonly conversationId: string;
    readonly fileName: string;
    readonly contentType: string;
    readonly bytes: Buffer;
    readonly security: RequestSecurityContext;
  }): Promise<{ attachment: MessageAttachmentDto }> {
    const { actor, settings, conversation } = await this.authorized.execute(input);
    if (!settings.allowAttachments) {
      throw new AttachmentsNotAllowedError();
    }

    conversation.assertCanAcceptMessage();
    return this.saveAttachment({
      tenantId: actor.tenantId,
      conversationId: conversation.id,
      widgetSessionId: actor.sessionId,
      actorId: actor.sessionId,
      fileName: input.fileName,
      contentType: input.contentType,
      bytes: input.bytes,
      security: input.security,
    });
  }

  private async saveAttachment(input: {
    readonly tenantId: string;
    readonly conversationId: string;
    readonly widgetSessionId?: string;
    readonly actorId: string;
    readonly fileName: string;
    readonly contentType: string;
    readonly bytes: Buffer;
    readonly security: RequestSecurityContext;
  }): Promise<{ attachment: MessageAttachmentDto }> {
    const now = this.clock.now();
    const id = createMessageAttachmentId();
    const storageKey = await this.storage.save({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      attachmentId: id,
      bytes: input.bytes,
    });
    const attachment = MessageAttachment.create({
      id,
      organizationId: input.tenantId,
      conversationId: createConversationId(input.conversationId),
      widgetSessionId: input.widgetSessionId,
      fileName: input.fileName,
      contentType: input.contentType,
      byteSize: input.bytes.byteLength,
      storageKey,
      now,
    });
    await this.attachments.save(attachment);
    await this.eventBus.publish(
      new AttachmentUploadedEvent(
        crypto.randomUUID(),
        now,
        input.tenantId,
        input.conversationId,
        attachment.id,
        input.actorId,
        input.security.correlationId,
      ),
    );
    return { attachment: toAttachmentDto(attachment) };
  }
}

export class UploadConversationAttachmentUseCase {
  constructor(
    private readonly authorized: LoadAuthorizedConversationService,
    private readonly attachments: MessageAttachmentRepository,
    private readonly storage: AttachmentStoragePort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly conversationId: string;
    readonly fileName: string;
    readonly contentType: string;
    readonly bytes: Buffer;
    readonly security: RequestSecurityContext;
  }): Promise<{ attachment: MessageAttachmentDto }> {
    const { actor, conversation } = await this.authorized.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      conversationId: input.conversationId,
      permission: Permissions.CONVERSATION_WRITE,
    });
    conversation.assertCanAcceptMessage();
    const now = this.clock.now();
    const id = createMessageAttachmentId();
    const storageKey = await this.storage.save({
      tenantId: actor.tenantId,
      conversationId: conversation.id,
      attachmentId: id,
      bytes: input.bytes,
    });
    const attachment = MessageAttachment.create({
      id,
      organizationId: actor.tenantId,
      conversationId: conversation.id,
      fileName: input.fileName,
      contentType: input.contentType,
      byteSize: input.bytes.byteLength,
      storageKey,
      now,
    });
    await this.attachments.save(attachment);
    await this.eventBus.publish(
      new AttachmentUploadedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        conversation.id,
        attachment.id,
        actor.actorId,
        input.security.correlationId,
      ),
    );
    return { attachment: toAttachmentDto(attachment) };
  }
}

export class GetWidgetAttachmentUseCase {
  constructor(
    private readonly authorized: LoadWidgetConversationService,
    private readonly attachments: MessageAttachmentRepository,
    private readonly storage: AttachmentStoragePort,
  ) {}

  async execute(input: {
    readonly sessionToken: string;
    readonly origin: string | undefined;
    readonly conversationId: string;
    readonly attachmentId: string;
  }) {
    const { actor, conversation } = await this.authorized.execute(input);
    const attachment = await this.attachments.findById(
      actor.tenantId,
      createMessageAttachmentId(input.attachmentId),
    );
    if (!attachment || attachment.conversationId !== conversation.id) {
      throw new ConversationNotFoundError();
    }

    const file = await this.storage.read(attachment.storageKey);
    return {
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      bytes: file.bytes,
    };
  }
}

export class GetConversationAttachmentUseCase {
  constructor(
    private readonly authorized: LoadAuthorizedConversationService,
    private readonly attachments: MessageAttachmentRepository,
    private readonly storage: AttachmentStoragePort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly conversationId: string;
    readonly attachmentId: string;
  }) {
    const { actor, conversation } = await this.authorized.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      conversationId: input.conversationId,
      permission: Permissions.CONVERSATION_READ,
    });
    const attachment = await this.attachments.findById(
      actor.tenantId,
      createMessageAttachmentId(input.attachmentId),
    );
    if (!attachment || attachment.conversationId !== conversation.id) {
      throw new UnauthorizedConversationAccessError();
    }

    const file = await this.storage.read(attachment.storageKey);
    return {
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      bytes: file.bytes,
    };
  }
}
