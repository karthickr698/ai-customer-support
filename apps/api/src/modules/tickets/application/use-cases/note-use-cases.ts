import type { EventBus, PageRequest } from '@ai-customer-support/shared';
import type { TicketNoteListResponse, TicketNoteResponse } from '@ai-customer-support/contracts';
import { TicketNoteAddedEvent } from '../../domain/events.js';
import { TooManyTicketRecordsError } from '../../domain/errors.js';
import { MAX_TICKET_NOTES } from '../../domain/ticket-policy.js';
import { TicketNote } from '../../domain/ticket-note.js';
import { toNoteDto, type RequestSecurityContext } from '../dtos.js';
import { LoadAuthorizedTicketService, TICKET_PERMISSION } from '../load-authorized-ticket-service.js';
import type { ClockPort, TicketNoteRepository, TicketRepository } from '../ports.js';

export class AddTicketNoteUseCase {
  constructor(
    private readonly authorized: LoadAuthorizedTicketService,
    private readonly tickets: TicketRepository,
    private readonly notes: TicketNoteRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly ticketId: string;
    readonly body: string;
    readonly security: RequestSecurityContext;
  }): Promise<TicketNoteResponse> {
    const { actor, ticket } = await this.authorized.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      ticketId: input.ticketId,
      permission: TICKET_PERMISSION,
    });
    const count = await this.notes.countByTicket(actor.tenantId, ticket.id);
    if (count >= MAX_TICKET_NOTES) {
      throw new TooManyTicketRecordsError('ticket notes');
    }
    const now = this.clock.now();
    const note = TicketNote.create({
      ticketId: ticket.id,
      organizationId: actor.tenantId,
      authorId: actor.actorId,
      body: input.body,
      now,
    });
    ticket.recordFirstResponse(now);
    await this.notes.save(note);
    await this.tickets.save(ticket);
    await this.eventBus.publish(
      new TicketNoteAddedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        ticket.id,
        note.id,
        actor.actorId,
        input.security.correlationId,
      ),
    );
    return { note: toNoteDto(note) };
  }
}

export class ListTicketNotesUseCase {
  constructor(
    private readonly authorized: LoadAuthorizedTicketService,
    private readonly notes: TicketNoteRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly ticketId: string;
    readonly page: PageRequest;
  }): Promise<TicketNoteListResponse> {
    const { actor, ticket } = await this.authorized.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      ticketId: input.ticketId,
      permission: TICKET_PERMISSION,
    });
    const result = await this.notes.listByTicket(actor.tenantId, ticket.id, input.page);
    return {
      items: result.items.filter((item) => item.belongsTo(actor.tenantId)).map(toNoteDto),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }
}
