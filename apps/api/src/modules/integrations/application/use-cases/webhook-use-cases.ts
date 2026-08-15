import type { EventBus, PageRequest } from '@ai-customer-support/shared';
import type {
  WebhookDeliveryListResponse,
  WebhookDeliveryResponse,
  WebhookSecretRotatedResponse,
  WebhookSubscriptionCreatedResponse,
  WebhookSubscriptionListResponse,
  WebhookSubscriptionResponse,
  WebhookStatus,
} from '@ai-customer-support/contracts';
import { MAX_WEBHOOKS_PER_ORGANIZATION } from '../../domain/api-version.js';
import {
  WebhookDeliveryNotFoundError,
  WebhookLimitExceededError,
  WebhookSubscriptionNotFoundError,
} from '../../domain/errors.js';
import { WebhookSubscriptionCreatedEvent, WebhookSubscriptionUpdatedEvent } from '../../domain/events.js';
import { createWebhookDeliveryId, createWebhookSubscriptionId } from '../../domain/ids.js';
import { IntegrationPolicy } from '../../domain/integration-policy.js';
import { WebhookSubscription } from '../../domain/webhook-subscription.js';
import { toWebhookDeliveryDto, toWebhookDto, type RequestSecurityContext } from '../dtos.js';
import { PUBLIC_API_RATE_LIMITS } from '../rate-limits.js';
import type {
  ClockPort,
  SecretCipherPort,
  SecureTokenGeneratorPort,
  TenantAccessPort,
  RateLimiterPort,
  WebhookDeliveryRepository,
  WebhookSubscriptionRepository,
} from '../ports.js';
import type { DispatchWebhooksUseCase } from './dispatch-webhooks-use-case.js';

export class CreateWebhookSubscriptionUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly subscriptions: WebhookSubscriptionRepository,
    private readonly cipher: SecretCipherPort,
    private readonly tokens: SecureTokenGeneratorPort,
    private readonly rateLimiter: RateLimiterPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly allowLocalHttp: boolean,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly url: string;
    readonly events: readonly string[];
    readonly description?: string;
    readonly security: RequestSecurityContext;
  }): Promise<WebhookSubscriptionCreatedResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertCanManage(actor.permissions);
    await this.rateLimiter.consume(
      `integrations:webhooks:${actor.tenantId}`,
      PUBLIC_API_RATE_LIMITS.createWebhook.limit,
      PUBLIC_API_RATE_LIMITS.createWebhook.windowSeconds,
    );

    const active = await this.subscriptions.countActiveByTenant(actor.tenantId);
    if (active >= MAX_WEBHOOKS_PER_ORGANIZATION) {
      throw new WebhookLimitExceededError();
    }

    const secret = this.tokens.generate();
    const now = this.clock.now();
    const subscription = WebhookSubscription.create({
      organizationId: actor.tenantId,
      url: input.url,
      events: input.events,
      secret: this.cipher.encrypt(secret),
      plaintextSecret: secret,
      description: input.description,
      createdByUserId: actor.actorId,
      now,
      allowLocalHttp: this.allowLocalHttp,
    });
    await this.subscriptions.save(subscription);
    await this.eventBus.publish(
      new WebhookSubscriptionCreatedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        subscription.id,
        input.security.correlationId,
      ),
    );
    return { webhook: toWebhookDto(subscription), secret };
  }
}

export class ListWebhookSubscriptionsUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly subscriptions: WebhookSubscriptionRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
  }): Promise<WebhookSubscriptionListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertCanManage(actor.permissions);
    const items = await this.subscriptions.listByTenant(actor.tenantId);
    return { items: items.map(toWebhookDto) };
  }
}

export class GetWebhookSubscriptionUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly subscriptions: WebhookSubscriptionRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly webhookId: string;
  }): Promise<WebhookSubscriptionResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertCanManage(actor.permissions);
    const subscription = await this.subscriptions.findById(
      actor.tenantId,
      createWebhookSubscriptionId(input.webhookId),
    );
    if (!subscription) {
      throw new WebhookSubscriptionNotFoundError();
    }
    return { webhook: toWebhookDto(subscription) };
  }
}

export class UpdateWebhookSubscriptionUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly subscriptions: WebhookSubscriptionRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly allowLocalHttp: boolean,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly webhookId: string;
    readonly url?: string;
    readonly events?: readonly string[];
    readonly description?: string;
    readonly status?: Exclude<WebhookStatus, 'disabled'>;
    readonly security: RequestSecurityContext;
  }): Promise<WebhookSubscriptionResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertCanManage(actor.permissions);
    const existing = await this.subscriptions.findById(
      actor.tenantId,
      createWebhookSubscriptionId(input.webhookId),
    );
    if (!existing) {
      throw new WebhookSubscriptionNotFoundError();
    }
    const now = this.clock.now();
    const updated = existing.update({
      url: input.url,
      events: input.events,
      description: input.description,
      status: input.status,
      now,
      allowLocalHttp: this.allowLocalHttp,
    });
    await this.subscriptions.save(updated);
    await this.eventBus.publish(
      new WebhookSubscriptionUpdatedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        updated.id,
        input.security.correlationId,
      ),
    );
    return { webhook: toWebhookDto(updated) };
  }
}

export class RotateWebhookSecretUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly subscriptions: WebhookSubscriptionRepository,
    private readonly cipher: SecretCipherPort,
    private readonly tokens: SecureTokenGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly webhookId: string;
  }): Promise<WebhookSecretRotatedResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertCanManage(actor.permissions);
    const existing = await this.subscriptions.findById(
      actor.tenantId,
      createWebhookSubscriptionId(input.webhookId),
    );
    if (!existing) {
      throw new WebhookSubscriptionNotFoundError();
    }
    const secret = this.tokens.generate();
    const rotated = existing.rotateSecret({
      secret: this.cipher.encrypt(secret),
      plaintextSecret: secret,
      now: this.clock.now(),
    });
    await this.subscriptions.save(rotated);
    return { webhook: toWebhookDto(rotated), secret };
  }
}

export class DeleteWebhookSubscriptionUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly subscriptions: WebhookSubscriptionRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly webhookId: string;
  }): Promise<void> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertCanManage(actor.permissions);
    const existing = await this.subscriptions.findById(
      actor.tenantId,
      createWebhookSubscriptionId(input.webhookId),
    );
    if (!existing) {
      throw new WebhookSubscriptionNotFoundError();
    }
    await this.subscriptions.save(existing.disable(this.clock.now()));
  }
}

export class ListWebhookDeliveriesUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly subscriptions: WebhookSubscriptionRepository,
    private readonly deliveries: WebhookDeliveryRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly webhookId: string;
    readonly page: PageRequest;
  }): Promise<WebhookDeliveryListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertCanManage(actor.permissions);
    const subscription = await this.subscriptions.findById(
      actor.tenantId,
      createWebhookSubscriptionId(input.webhookId),
    );
    if (!subscription) {
      throw new WebhookSubscriptionNotFoundError();
    }
    const page = await this.deliveries.listBySubscription(actor.tenantId, subscription.id, input.page);
    return {
      items: page.items.map(toWebhookDeliveryDto),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }
}

export class RetryWebhookDeliveryUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly subscriptions: WebhookSubscriptionRepository,
    private readonly deliveries: WebhookDeliveryRepository,
    private readonly dispatch: DispatchWebhooksUseCase,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly webhookId: string;
    readonly deliveryId: string;
  }): Promise<WebhookDeliveryResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertCanManage(actor.permissions);
    const subscription = await this.subscriptions.findById(
      actor.tenantId,
      createWebhookSubscriptionId(input.webhookId),
    );
    if (!subscription) {
      throw new WebhookSubscriptionNotFoundError();
    }
    const delivery = await this.deliveries.findById(
      actor.tenantId,
      createWebhookDeliveryId(input.deliveryId),
    );
    if (!delivery || delivery.subscriptionId !== subscription.id) {
      throw new WebhookDeliveryNotFoundError();
    }
    const retried = await this.dispatch.retry(subscription, delivery);
    return { delivery: toWebhookDeliveryDto(retried) };
  }
}
