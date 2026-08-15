import type { PlatformToolHandlerPort, PlatformToolRequest } from '../../application/ports.js';

/**
 * In-process handlers for allowlisted platform tools.
 * Mutating results are recommendations/facts for TypeScript business modules to apply;
 * this adapter does not write conversation or ticket tables.
 */
export class InProcessPlatformToolHandler implements PlatformToolHandlerPort {
  async execute(request: PlatformToolRequest): Promise<Record<string, unknown>> {
    switch (request.toolName) {
      case 'getCustomerDetails':
        return {
          found: false,
          customerId: request.arguments.customerId ?? null,
          email: request.arguments.email ?? null,
          tenantId: request.tenantId,
        };
      case 'createTicket':
        return {
          accepted: true,
          ticketId: crypto.randomUUID(),
          status: 'open',
          conversationId: request.arguments.conversationId,
          subject: request.arguments.subject,
          priority: request.arguments.priority ?? 'normal',
        };
      case 'updateTicket':
        return {
          accepted: true,
          ticketId: request.arguments.ticketId,
          status: request.arguments.status ?? null,
          noteRecorded: Boolean(request.arguments.note),
        };
      case 'handoffToAgent':
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
