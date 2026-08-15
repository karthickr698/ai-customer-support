import type { DomainEvent } from '@ai-customer-support/shared';

export class IntegrationCredentialUpsertedEvent implements DomainEvent {
  readonly eventName = 'IntegrationCredentialUpserted';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly credentialId: string,
    readonly toolName: string,
    readonly correlationId?: string,
  ) {}
}

export class IntegrationCredentialRevokedEvent implements DomainEvent {
  readonly eventName = 'IntegrationCredentialRevoked';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly credentialId: string,
    readonly toolName: string,
    readonly correlationId?: string,
  ) {}
}

export class OAuthConnectorConnectedEvent implements DomainEvent {
  readonly eventName = 'OAuthConnectorConnected';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly connectorId: string,
    readonly provider: string,
    readonly correlationId?: string,
  ) {}
}

export class OAuthConnectorDisconnectedEvent implements DomainEvent {
  readonly eventName = 'OAuthConnectorDisconnected';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly connectorId: string,
    readonly provider: string,
    readonly correlationId?: string,
  ) {}
}

export class OrganizationApiKeyCreatedEvent implements DomainEvent {
  readonly eventName = 'OrganizationApiKeyCreated';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly apiKeyId: string,
    readonly correlationId?: string,
  ) {}
}

export class OrganizationApiKeyRevokedEvent implements DomainEvent {
  readonly eventName = 'OrganizationApiKeyRevoked';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly apiKeyId: string,
    readonly correlationId?: string,
  ) {}
}

export class WebhookSubscriptionCreatedEvent implements DomainEvent {
  readonly eventName = 'WebhookSubscriptionCreated';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly subscriptionId: string,
    readonly correlationId?: string,
  ) {}
}

export class WebhookSubscriptionUpdatedEvent implements DomainEvent {
  readonly eventName = 'WebhookSubscriptionUpdated';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly subscriptionId: string,
    readonly correlationId?: string,
  ) {}
}

export class WebhookDeliveryAttemptedEvent implements DomainEvent {
  readonly eventName = 'WebhookDeliveryAttempted';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly subscriptionId: string,
    readonly deliveryId: string,
    readonly status: string,
    readonly correlationId?: string,
  ) {}
}

export class OAuthApplicationCreatedEvent implements DomainEvent {
  readonly eventName = 'OAuthApplicationCreated';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly applicationId: string,
    readonly correlationId?: string,
  ) {}
}

export class OAuthApplicationRevokedEvent implements DomainEvent {
  readonly eventName = 'OAuthApplicationRevoked';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly applicationId: string,
    readonly correlationId?: string,
  ) {}
}

export class ToolCallExecutedEvent implements DomainEvent {
  readonly eventName = 'ToolCallExecuted';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly invocationId: string,
    readonly toolName: string,
    readonly status: string,
    readonly correlationId?: string,
  ) {}
}
