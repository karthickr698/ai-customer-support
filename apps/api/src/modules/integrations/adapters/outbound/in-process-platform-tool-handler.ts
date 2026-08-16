import type { ConversationHandoffPort } from '../../../conversations/index.js';
import type { BusinessDataLookupPort } from '../../../customers/application/ports/repositories.js';
import type { TicketToolPort } from '../../../tickets/application/ports.js';
import type { PlatformToolHandlerPort, PlatformToolRequest } from '../../application/ports.js';

/**
 * In-process handlers for allowlisted platform tools.
 * Mutating ticket tools are executed by the tickets module; this adapter does not write tables itself.
 */
export class InProcessPlatformToolHandler implements PlatformToolHandlerPort {
  constructor(
    private readonly businessData?: BusinessDataLookupPort,
    private readonly tickets?: TicketToolPort,
    private readonly conversations?: ConversationHandoffPort,
  ) {}

  async execute(request: PlatformToolRequest): Promise<Record<string, unknown>> {
    switch (request.toolName) {
      case 'getCustomerDetails':
        if (this.businessData) {
          return this.businessData.lookupCustomer(request.tenantId, request.actorId, {
            customerId: asOptionalString(request.arguments.customerId),
            email: asOptionalString(request.arguments.email),
          });
        }
        return {
          found: false,
          customerId: request.arguments.customerId ?? null,
          email: request.arguments.email ?? null,
          tenantId: request.tenantId,
        };
      case 'getProductDetails':
        if (this.businessData) {
          return this.businessData.lookupProduct(request.tenantId, request.actorId, {
            productId: asOptionalString(request.arguments.productId),
            sku: asOptionalString(request.arguments.sku),
          });
        }
        return {
          found: false,
          productId: request.arguments.productId ?? null,
          sku: request.arguments.sku ?? null,
          tenantId: request.tenantId,
        };
      case 'getOrderDetails':
        if (this.businessData) {
          const orderId = asOptionalString(request.arguments.orderId);
          if (orderId) {
            return this.businessData.lookupOrder(request.tenantId, request.actorId, { orderId });
          }
        }
        return { found: false, orderId: request.arguments.orderId ?? null, tenantId: request.tenantId };
      case 'getShipmentDetails':
        if (this.businessData) {
          return this.businessData.lookupShipment(request.tenantId, request.actorId, {
            shipmentId: asOptionalString(request.arguments.shipmentId),
            trackingNumber: asOptionalString(request.arguments.trackingNumber),
          });
        }
        return {
          found: false,
          shipmentId: request.arguments.shipmentId ?? null,
          trackingNumber: request.arguments.trackingNumber ?? null,
          tenantId: request.tenantId,
        };
      case 'getReturnDetails':
        if (this.businessData) {
          return this.businessData.lookupReturn(request.tenantId, request.actorId, {
            returnId: asOptionalString(request.arguments.returnId),
            orderId: asOptionalString(request.arguments.orderId),
          });
        }
        return {
          found: false,
          returnId: request.arguments.returnId ?? null,
          orderId: request.arguments.orderId ?? null,
          tenantId: request.tenantId,
        };
      case 'createTicket':
        if (this.tickets) {
          return this.tickets.createTicket(request.tenantId, request.actorId, request.arguments);
        }
        return {
          accepted: true,
          ticketId: crypto.randomUUID(),
          status: 'open',
          conversationId: request.arguments.conversationId,
          subject: request.arguments.subject,
          priority: request.arguments.priority ?? 'normal',
        };
      case 'updateTicket':
        if (this.tickets) {
          return this.tickets.updateTicket(request.tenantId, request.actorId, request.arguments);
        }
        return {
          accepted: true,
          ticketId: request.arguments.ticketId,
          status: request.arguments.status ?? null,
          noteRecorded: Boolean(request.arguments.note),
        };
      case 'handoffToAgent':
        if (this.conversations) {
          const conversationId = asOptionalString(request.arguments.conversationId);
          if (!conversationId) {
            return { handedOff: false, reason: 'conversationId is required' };
          }

          return this.conversations.handoffToHuman({
            tenantId: request.tenantId,
            actorId: request.actorId,
            conversationId,
            reason: asOptionalString(request.arguments.reason),
          });
        }
        return {
          handedOff: true,
          conversationId: request.arguments.conversationId,
          reason: request.arguments.reason,
        };
      default:
        return { accepted: false };
    }
  }
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}
