import type {
  IntegrationCredentialKind,
  OAuthConnectorProvider,
  OAuthConnectorStatus,
  ToolInvocationStatus,
  ToolName,
  ToolSide,
} from '@ai-customer-support/contracts';

export function toolsPath(organizationId: string, segment = ''): string {
  const base = `/organizations/${organizationId}/tools`;
  return segment ? `${base}/${segment}` : base;
}

export function toolLabel(name: ToolName): string {
  switch (name) {
    case 'getCustomerDetails':
      return 'Get customer details';
    case 'getProductDetails':
      return 'Get product details';
    case 'getOrderDetails':
      return 'Get order details';
    case 'getShipmentDetails':
      return 'Get shipment details';
    case 'getReturnDetails':
      return 'Get return details';
    case 'createTicket':
      return 'Create ticket';
    case 'updateTicket':
      return 'Update ticket';
    case 'checkRefundStatus':
      return 'Check refund status';
    case 'handoffToAgent':
      return 'Handoff to agent';
  }
}

export function toolSideLabel(side: ToolSide): string {
  return side === 'write' ? 'Write' : 'Read';
}

export function credentialKindLabel(kind: IntegrationCredentialKind): string {
  return kind === 'bearer' ? 'Bearer token' : 'API key';
}

export function oauthProviderLabel(provider: OAuthConnectorProvider | string): string {
  switch (provider) {
    case 'shopify':
      return 'Shopify';
    case 'stripe':
      return 'Stripe';
    case 'zendesk':
      return 'Zendesk';
    case 'custom':
      return 'Custom';
    default:
      return provider;
  }
}

export function oauthStatusLabel(status: OAuthConnectorStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'connected':
      return 'Connected';
    case 'expired':
      return 'Expired';
    case 'disconnected':
      return 'Disconnected';
  }
}

export function oauthStatusVariant(
  status: OAuthConnectorStatus,
): 'secondary' | 'success' | 'warning' | 'outline' {
  switch (status) {
    case 'pending':
      return 'secondary';
    case 'connected':
      return 'success';
    case 'expired':
      return 'warning';
    case 'disconnected':
      return 'outline';
  }
}

export function invocationStatusLabel(status: ToolInvocationStatus): string {
  switch (status) {
    case 'accepted':
      return 'Accepted';
    case 'succeeded':
      return 'Succeeded';
    case 'failed':
      return 'Failed';
    case 'rejected':
      return 'Rejected';
    case 'timed_out':
      return 'Timed out';
  }
}

export function invocationStatusVariant(
  status: ToolInvocationStatus,
): 'secondary' | 'success' | 'destructive' | 'warning' | 'outline' {
  switch (status) {
    case 'accepted':
      return 'secondary';
    case 'succeeded':
      return 'success';
    case 'failed':
      return 'destructive';
    case 'rejected':
      return 'outline';
    case 'timed_out':
      return 'warning';
  }
}

export function secretHint(lastFour: string): string {
  return `••••${lastFour}`;
}
