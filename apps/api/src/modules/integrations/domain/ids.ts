export type OrganizationApiKeyId = string & { readonly __brand: 'OrganizationApiKeyId' };
export type WebhookSubscriptionId = string & { readonly __brand: 'WebhookSubscriptionId' };
export type WebhookDeliveryId = string & { readonly __brand: 'WebhookDeliveryId' };
export type OAuthApplicationId = string & { readonly __brand: 'OAuthApplicationId' };
export type OAuthGrantId = string & { readonly __brand: 'OAuthGrantId' };
export type IntegrationCredentialId = string & { readonly __brand: 'IntegrationCredentialId' };
export type OAuthConnectorId = string & { readonly __brand: 'OAuthConnectorId' };
export type ToolInvocationId = string & { readonly __brand: 'ToolInvocationId' };

export function createIntegrationCredentialId(
  id: string = crypto.randomUUID(),
): IntegrationCredentialId {
  return id as IntegrationCredentialId;
}

export function createOAuthConnectorId(id: string = crypto.randomUUID()): OAuthConnectorId {
  return id as OAuthConnectorId;
}

export function createToolInvocationId(id: string = crypto.randomUUID()): ToolInvocationId {
  return id as ToolInvocationId;
}

export function createOrganizationApiKeyId(id: string = crypto.randomUUID()): OrganizationApiKeyId {
  return id as OrganizationApiKeyId;
}

export function createWebhookSubscriptionId(id: string = crypto.randomUUID()): WebhookSubscriptionId {
  return id as WebhookSubscriptionId;
}

export function createWebhookDeliveryId(id: string = crypto.randomUUID()): WebhookDeliveryId {
  return id as WebhookDeliveryId;
}

export function createOAuthApplicationId(id: string = crypto.randomUUID()): OAuthApplicationId {
  return id as OAuthApplicationId;
}

export function createOAuthGrantId(id: string = crypto.randomUUID()): OAuthGrantId {
  return id as OAuthGrantId;
}
