import type { WebhookEventName } from '@ai-customer-support/contracts';

const DOMAIN_EVENT_TO_WEBHOOK: Readonly<Record<string, WebhookEventName>> = {
  ConversationCreated: 'conversation.created',
  ConversationStatusChanged: 'conversation.updated',
  MessageReceived: 'conversation.message.created',
  MessageSent: 'conversation.message.created',
  ConversationEscalated: 'conversation.escalated',
  AgentAssigned: 'conversation.assigned',
  ToolCallExecuted: 'tool.call.executed',
  OAuthConnectorConnected: 'oauth.connector.connected',
  OAuthConnectorDisconnected: 'oauth.connector.disconnected',
  IntegrationCredentialUpserted: 'integration.credential.upserted',
  IntegrationCredentialRevoked: 'integration.credential.revoked',
  OrganizationApiKeyCreated: 'api_key.created',
  OrganizationApiKeyRevoked: 'api_key.revoked',
  WebhookSubscriptionCreated: 'webhook.created',
};

export function webhookEventNameFor(domainEventName: string): WebhookEventName | undefined {
  return DOMAIN_EVENT_TO_WEBHOOK[domainEventName];
}

export const WEBHOOK_SOURCE_DOMAIN_EVENTS = Object.keys(DOMAIN_EVENT_TO_WEBHOOK);
