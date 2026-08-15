import { Permissions } from '../../../../organizations/domain/permissions.js';
import { TicketNote } from '../../../domain/ticket-note.js';
import { Ticket } from '../../../domain/ticket.js';
import { TicketPolicy } from '../../../domain/ticket-policy.js';
import { parseTicketStatus, isUuid } from '../../../domain/values.js';
import { toTicketDto } from '../../../application/dtos.js';
import type {
  ClockPort,
  ConversationSourcePort,
  TicketNoteRepository,
  TicketRepository,
  TicketSlaPolicyRepository,
  TicketToolPort,
  TenantAccessPort,
  UserDirectoryPort,
} from '../../../application/ports.js';
import { applyMatchingSla, loadAssignee } from '../../../application/use-cases/ticket-use-cases.js';
import { TicketCreatedEvent, TicketNoteAddedEvent, TicketStatusChangedEvent } from '../../../domain/events.js';
import type { EventBus } from '@ai-customer-support/shared';
import { ConversationNotFoundForTicketError, TicketNotFoundError } from '../../../domain/errors.js';
import { createTicketId } from '../../../domain/ids.js';

export class TenantTicketToolAdapter implements TicketToolPort {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly tickets: TicketRepository,
    private readonly notes: TicketNoteRepository,
    private readonly slaPolicies: TicketSlaPolicyRepository,
    private readonly conversations: ConversationSourcePort | undefined,
    private readonly users: UserDirectoryPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async createTicket(
    tenantId: string,
    actorId: string,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const actor = await this.tenantAccess.loadActor(tenantId, actorId);
    TicketPolicy.assertPermission(actor.permissions, Permissions.TICKET_MANAGE);

    const conversationId = asString(args.conversationId);
    const subject = asString(args.subject) ?? 'Support ticket';
    const description = asString(args.description) ?? subject;
    const priority = asString(args.priority);

    if (conversationId && isUuid(conversationId)) {
      const existing = await this.tickets.findOpenByConversation(actor.tenantId, conversationId);
      if (existing) {
        return {
          accepted: true,
          created: false,
          ticketId: existing.id,
          status: existing.status,
          conversationId,
          subject: existing.subject,
          priority: existing.priority,
        };
      }
    }

    const conversation =
      conversationId && this.conversations
        ? await this.conversations.findById(actor.tenantId, conversationId)
        : null;
    if (conversationId && this.conversations && !conversation) {
      throw new ConversationNotFoundForTicketError();
    }

    const now = this.clock.now();
    const ticket = Ticket.create({
      organizationId: actor.tenantId,
      conversationId,
      customerEmail: conversation?.customerEmail ?? 'visitor@conversation.local',
      customerName: conversation?.customerName ?? 'Visitor',
      customerId: conversation?.customerId,
      subject,
      description,
      priority,
      source: 'ai_conversation',
      assignedAgentId: conversation?.assignedAgentId,
      createdByUserId: actor.actorId,
      now,
    });
    await applyMatchingSla(ticket, this.slaPolicies, now);
    await this.tickets.save(ticket);
    await this.eventBus.publish(
      new TicketCreatedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        ticket.id,
        actor.actorId,
        ticket.conversationId,
        ticket.source,
      ),
    );
    const dto = toTicketDto(ticket, await loadAssignee(this.users, ticket.assignedAgentId));
    return {
      accepted: true,
      created: true,
      ticketId: dto.id,
      status: dto.status,
      conversationId: dto.conversationId,
      subject: dto.subject,
      priority: dto.priority,
    };
  }

  async updateTicket(
    tenantId: string,
    actorId: string,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const actor = await this.tenantAccess.loadActor(tenantId, actorId);
    TicketPolicy.assertPermission(actor.permissions, Permissions.TICKET_MANAGE);
    const ticketId = asString(args.ticketId);
    if (!ticketId || !isUuid(ticketId)) {
      throw new TicketNotFoundError();
    }
    const ticket = await this.tickets.findById(actor.tenantId, createTicketId(ticketId));
    if (!ticket || !ticket.belongsTo(actor.tenantId)) {
      throw new TicketNotFoundError();
    }

    const now = this.clock.now();
    const status = asString(args.status);
    const fromStatus = ticket.status;
    if (status) {
      ticket.transitionTo(parseTicketStatus(status), now);
    }
    const noteBody = asString(args.note);
    let noteRecorded = false;
    if (noteBody) {
      const note = TicketNote.create({
        ticketId: ticket.id,
        organizationId: actor.tenantId,
        authorId: actor.actorId,
        body: noteBody,
        now,
      });
      ticket.recordFirstResponse(now);
      await this.notes.save(note);
      noteRecorded = true;
      await this.eventBus.publish(
        new TicketNoteAddedEvent(
          crypto.randomUUID(),
          now,
          actor.tenantId,
          ticket.id,
          note.id,
          actor.actorId,
        ),
      );
    }
    await this.tickets.save(ticket);
    if (status && fromStatus !== ticket.status) {
      await this.eventBus.publish(
        new TicketStatusChangedEvent(
          crypto.randomUUID(),
          now,
          actor.tenantId,
          ticket.id,
          fromStatus,
          ticket.status,
          actor.actorId,
        ),
      );
    }
    return {
      accepted: true,
      ticketId: ticket.id,
      status: ticket.status,
      noteRecorded,
    };
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}
