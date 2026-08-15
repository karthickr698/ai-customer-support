import type { EventBus } from '@ai-customer-support/shared';
import { TicketCreatedEvent } from '../../domain/events.js';
import { Ticket } from '../../domain/ticket.js';
import { MAX_TICKETS_PER_TENANT } from '../../domain/ticket-policy.js';
import type {
  ClockPort,
  OpenTicketFromConversationCommand,
  OpenTicketFromConversationResult,
  TicketIntakePort,
  TicketRepository,
  TicketSlaPolicyRepository,
} from '../ports.js';
import { applyMatchingSla } from './ticket-use-cases.js';

export class OpenTicketFromConversationUseCase implements TicketIntakePort {
  constructor(
    private readonly tickets: TicketRepository,
    private readonly slaPolicies: TicketSlaPolicyRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async openFromConversation(
    command: OpenTicketFromConversationCommand,
  ): Promise<OpenTicketFromConversationResult> {
    const existing = await this.tickets.findOpenByConversation(command.tenantId, command.conversationId);
    if (existing) {
      return { ticketId: existing.id, created: false };
    }

    const count = await this.tickets.countByTenant(command.tenantId);
    if (count >= MAX_TICKETS_PER_TENANT) {
      return { ticketId: '', created: false };
    }

    const now = this.clock.now();
    const subject = command.subject?.trim() || 'Support ticket';
    const ticket = Ticket.create({
      organizationId: command.tenantId,
      conversationId: command.conversationId,
      customerId: command.customerId,
      customerEmail: command.customerEmail,
      customerName: command.customerName,
      subject,
      description: command.description,
      priority: command.priority,
      source: command.source,
      assignedAgentId: command.assignedAgentId,
      createdByUserId: command.actorId,
      now,
    });
    await applyMatchingSla(ticket, this.slaPolicies, now);
    await this.tickets.save(ticket);
    await this.eventBus.publish(
      new TicketCreatedEvent(
        crypto.randomUUID(),
        now,
        command.tenantId,
        ticket.id,
        command.actorId,
        ticket.conversationId,
        ticket.source,
        command.correlationId,
      ),
    );
    return { ticketId: ticket.id, created: true };
  }
}
