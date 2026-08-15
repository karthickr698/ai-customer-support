import type { EventBus } from '@ai-customer-support/shared';
import type { TicketAttachmentDto } from '@ai-customer-support/contracts';
import { TicketAttachmentNotFoundError, TooManyTicketRecordsError } from '../../domain/errors.js';
import { TicketAttachmentUploadedEvent } from '../../domain/events.js';
import { createTicketAttachmentId } from '../../domain/ids.js';
import { MAX_ATTACHMENTS_PER_TICKET, TicketAttachment } from '../../domain/ticket-attachment.js';
import { toAttachmentDto, type RequestSecurityContext } from '../dtos.js';
import { LoadAuthorizedTicketService, TICKET_PERMISSION } from '../load-authorized-ticket-service.js';
import type {
  AttachmentStoragePort,
  ClockPort,
  TicketAttachmentRepository,
} from '../ports.js';

export class UploadTicketAttachmentUseCase {
  constructor(
    private readonly authorized: LoadAuthorizedTicketService,
    private readonly attachments: TicketAttachmentRepository,
    private readonly storage: AttachmentStoragePort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly ticketId: string;
    readonly fileName: string;
    readonly contentType: string;
    readonly bytes: Buffer;
    readonly security: RequestSecurityContext;
  }): Promise<{ attachment: TicketAttachmentDto }> {
    const { actor, ticket } = await this.authorized.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      ticketId: input.ticketId,
      permission: TICKET_PERMISSION,
    });
    const count = await this.attachments.countByTicket(actor.tenantId, ticket.id);
    if (count >= MAX_ATTACHMENTS_PER_TICKET) {
      throw new TooManyTicketRecordsError('ticket attachments');
    }
    const now = this.clock.now();
    const id = createTicketAttachmentId();
    const storageKey = await this.storage.save({
      tenantId: actor.tenantId,
      ticketId: ticket.id,
      attachmentId: id,
      bytes: input.bytes,
    });
    const attachment = TicketAttachment.create({
      id,
      organizationId: actor.tenantId,
      ticketId: ticket.id,
      fileName: input.fileName,
      contentType: input.contentType,
      byteSize: input.bytes.byteLength,
      storageKey,
      now,
    });
    await this.attachments.save(attachment);
    await this.eventBus.publish(
      new TicketAttachmentUploadedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        ticket.id,
        attachment.id,
        actor.actorId,
        input.security.correlationId,
      ),
    );
    return { attachment: toAttachmentDto(attachment) };
  }
}

export class GetTicketAttachmentUseCase {
  constructor(
    private readonly authorized: LoadAuthorizedTicketService,
    private readonly attachments: TicketAttachmentRepository,
    private readonly storage: AttachmentStoragePort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly ticketId: string;
    readonly attachmentId: string;
  }) {
    const { actor, ticket } = await this.authorized.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      ticketId: input.ticketId,
      permission: TICKET_PERMISSION,
    });
    const attachment = await this.attachments.findById(
      actor.tenantId,
      createTicketAttachmentId(input.attachmentId),
    );
    if (!attachment || attachment.ticketId !== ticket.id || !attachment.belongsTo(actor.tenantId)) {
      throw new TicketAttachmentNotFoundError();
    }
    const file = await this.storage.read(attachment.storageKey);
    return {
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      bytes: file.bytes,
    };
  }
}
