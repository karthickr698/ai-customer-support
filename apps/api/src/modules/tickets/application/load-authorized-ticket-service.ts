import { Permissions } from '../../organizations/domain/permissions.js';
import { InvalidTicketError, TicketNotFoundError } from '../domain/errors.js';
import { createTicketId } from '../domain/ids.js';
import { TicketPolicy } from '../domain/ticket-policy.js';
import { isUuid } from '../domain/values.js';
import type { Ticket } from '../domain/ticket.js';
import type { TenantAccessPort, TicketActor, TicketRepository } from './ports.js';

export class LoadAuthorizedTicketService {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly tickets: TicketRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly ticketId: string;
    readonly permission: string;
  }): Promise<{ actor: TicketActor; ticket: Ticket }> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    TicketPolicy.assertPermission(actor.permissions, input.permission);
    if (!isUuid(input.ticketId)) {
      throw new InvalidTicketError('ticketId must be a UUID');
    }
    const ticket = await this.tickets.findById(actor.tenantId, createTicketId(input.ticketId));
    if (!ticket || !ticket.belongsTo(actor.tenantId)) {
      throw new TicketNotFoundError();
    }
    return { actor, ticket };
  }
}

export const TICKET_PERMISSION = Permissions.TICKET_MANAGE;
