import {
  TOOL_NAMES,
  type ToolArgumentSchema,
  type ToolDefinitionDto,
  type ToolName,
} from '@ai-customer-support/contracts';
import { Permissions } from '../../organizations/domain/permissions.js';
import { InvalidToolCallError, UnknownToolError } from './errors.js';
import { validateAgainstJsonSchema } from './json-schema.js';

const READ_RETRY = { timeoutMs: 8_000, maxAttempts: 3, backoffMs: 200 } as const;
const WRITE_RETRY = { timeoutMs: 10_000, maxAttempts: 1, backoffMs: 0 } as const;

const UUID = { type: 'string', format: 'uuid' } as const;

export const TOOL_CATALOG: readonly ToolDefinitionDto[] = [
  {
    name: 'getCustomerDetails',
    description: 'Look up a tenant-scoped customer by id or email. Never returns another organization.',
    side: 'read',
    executionKind: 'platform',
    permission: Permissions.CUSTOMER_READ,
    retry: READ_RETRY,
    argumentSchema: {
      type: 'object',
      additionalProperties: false,
      required: [],
      properties: {
        customerId: { ...UUID, description: 'Customer id' },
        email: { type: 'string', format: 'email', maxLength: 254, description: 'Customer email' },
      },
    },
  },
  {
    name: 'getProductDetails',
    description: 'Look up a tenant-scoped product by id or SKU. Never returns another organization.',
    side: 'read',
    executionKind: 'platform',
    permission: Permissions.CUSTOMER_READ,
    retry: READ_RETRY,
    argumentSchema: {
      type: 'object',
      additionalProperties: false,
      required: [],
      properties: {
        productId: { ...UUID, description: 'Product id' },
        sku: { type: 'string', minLength: 1, maxLength: 80, description: 'Product SKU' },
      },
    },
  },
  {
    name: 'getOrderDetails',
    description: 'Look up a tenant-scoped order by id, then the commerce connector if needed. Never returns another organization.',
    side: 'read',
    executionKind: 'http',
    permission: Permissions.CONVERSATION_READ,
    retry: READ_RETRY,
    argumentSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['orderId'],
      properties: {
        orderId: { type: 'string', minLength: 1, maxLength: 80, description: 'External order id' },
      },
    },
  },
  {
    name: 'getShipmentDetails',
    description: 'Look up a tenant-scoped shipment by id or tracking number. Never returns another organization.',
    side: 'read',
    executionKind: 'platform',
    permission: Permissions.CUSTOMER_READ,
    retry: READ_RETRY,
    argumentSchema: {
      type: 'object',
      additionalProperties: false,
      required: [],
      properties: {
        shipmentId: { ...UUID, description: 'Shipment id' },
        trackingNumber: { type: 'string', minLength: 1, maxLength: 80, description: 'Carrier tracking number' },
      },
    },
  },
  {
    name: 'getReturnDetails',
    description: 'Look up a tenant-scoped return by id or order id. Never returns another organization.',
    side: 'read',
    executionKind: 'platform',
    permission: Permissions.CUSTOMER_READ,
    retry: READ_RETRY,
    argumentSchema: {
      type: 'object',
      additionalProperties: false,
      required: [],
      properties: {
        returnId: { ...UUID, description: 'Return id' },
        orderId: { type: 'string', minLength: 1, maxLength: 80, description: 'Order id or external order id' },
      },
    },
  },
  {
    name: 'createTicket',
    description: 'Open a support ticket. Mutating tools run only in TypeScript.',
    side: 'write',
    executionKind: 'platform',
    permission: Permissions.TICKET_MANAGE,
    retry: WRITE_RETRY,
    argumentSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['conversationId', 'subject', 'description'],
      properties: {
        conversationId: { ...UUID, description: 'Conversation to attach the ticket to' },
        subject: { type: 'string', minLength: 1, maxLength: 200 },
        description: { type: 'string', minLength: 1, maxLength: 8_000 },
        priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
      },
    },
  },
  {
    name: 'updateTicket',
    description: 'Update ticket status or add a note. Mutating tools run only in TypeScript.',
    side: 'write',
    executionKind: 'platform',
    permission: Permissions.TICKET_MANAGE,
    retry: WRITE_RETRY,
    argumentSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['ticketId'],
      properties: {
        ticketId: { ...UUID, description: 'Ticket id' },
        status: { type: 'string', enum: ['open', 'pending', 'resolved', 'closed', 'escalated'] },
        note: { type: 'string', minLength: 1, maxLength: 4_000 },
      },
    },
  },
  {
    name: 'checkRefundStatus',
    description: 'Check refund status through the tenant commerce connector.',
    side: 'read',
    executionKind: 'http',
    permission: Permissions.TICKET_MANAGE,
    retry: READ_RETRY,
    argumentSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['orderId'],
      properties: {
        orderId: { type: 'string', minLength: 1, maxLength: 80 },
        refundId: { type: 'string', minLength: 1, maxLength: 80 },
      },
    },
  },
  {
    name: 'handoffToAgent',
    description: 'Request a human handoff for the conversation.',
    side: 'write',
    executionKind: 'platform',
    permission: Permissions.CONVERSATION_ESCALATE,
    retry: WRITE_RETRY,
    argumentSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['conversationId', 'reason'],
      properties: {
        conversationId: { ...UUID, description: 'Conversation to hand off' },
        reason: { type: 'string', minLength: 1, maxLength: 1_000 },
      },
    },
  },
];

const BY_NAME = new Map(TOOL_CATALOG.map((tool) => [tool.name, tool]));

export function isAllowlistedToolName(value: string): value is ToolName {
  return (TOOL_NAMES as readonly string[]).includes(value);
}

export function getToolDefinition(name: string): ToolDefinitionDto {
  if (!isAllowlistedToolName(name)) {
    throw new UnknownToolError(name);
  }
  const definition = BY_NAME.get(name);
  if (!definition) {
    throw new UnknownToolError(name);
  }
  return definition;
}

export function parseToolName(name: string): ToolName {
  return getToolDefinition(name).name;
}

export function validateToolArguments(
  name: string,
  args: unknown,
): { definition: ToolDefinitionDto; arguments: Record<string, unknown> } {
  const definition = getToolDefinition(name);
  const parsed = validateAgainstJsonSchema(definition.argumentSchema, args);
  assertToolSpecificRules(definition.name, parsed, definition.argumentSchema);
  return { definition, arguments: parsed };
}

function assertToolSpecificRules(
  name: ToolName,
  args: Record<string, unknown>,
  _schema: ToolArgumentSchema,
): void {
  if (name === 'getCustomerDetails' && !args.customerId && !args.email) {
    throw new InvalidToolCallError('Provide customerId or email');
  }
  if (name === 'getProductDetails' && !args.productId && !args.sku) {
    throw new InvalidToolCallError('Provide productId or sku');
  }
  if (name === 'getShipmentDetails' && !args.shipmentId && !args.trackingNumber) {
    throw new InvalidToolCallError('Provide shipmentId or trackingNumber');
  }
  if (name === 'getReturnDetails' && !args.returnId && !args.orderId) {
    throw new InvalidToolCallError('Provide returnId or orderId');
  }
  if (name === 'updateTicket' && !args.status && !args.note) {
    throw new InvalidToolCallError('Provide a status or note');
  }
}

export const HTTP_TOOL_PROVIDERS: Readonly<Record<Extract<ToolName, 'getOrderDetails' | 'checkRefundStatus'>, readonly string[]>> =
  {
    getOrderDetails: ['shopify', 'stripe', 'custom'],
    checkRefundStatus: ['shopify', 'stripe', 'custom'],
  };
