import type { EventBus } from '@ai-customer-support/shared';
import type {
  OrganizationApiKeyCreatedResponse,
  OrganizationApiKeyListResponse,
} from '@ai-customer-support/contracts';
import { API_KEY_TOKEN_PREFIX, MAX_API_KEYS_PER_ORGANIZATION } from '../../domain/api-version.js';
import { OrganizationApiKey } from '../../domain/api-key.js';
import {
  ApiKeyLimitExceededError,
  ApiKeyNotFoundError,
  InvalidApiKeyError,
} from '../../domain/errors.js';
import { OrganizationApiKeyCreatedEvent, OrganizationApiKeyRevokedEvent } from '../../domain/events.js';
import { createOrganizationApiKeyId } from '../../domain/ids.js';
import { IntegrationPolicy } from '../../domain/integration-policy.js';
import { toApiKeyDto, type RequestSecurityContext } from '../dtos.js';
import { PUBLIC_API_RATE_LIMITS } from '../rate-limits.js';
import type {
  ClockPort,
  DigestHasherPort,
  OrganizationApiKeyRepository,
  RateLimiterPort,
  SecureTokenGeneratorPort,
  TenantAccessPort,
} from '../ports.js';

export class CreateOrganizationApiKeyUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly apiKeys: OrganizationApiKeyRepository,
    private readonly tokens: SecureTokenGeneratorPort,
    private readonly hasher: DigestHasherPort,
    private readonly rateLimiter: RateLimiterPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly name: string;
    readonly scopes?: readonly string[];
    readonly expiresAt?: string;
    readonly security: RequestSecurityContext;
  }): Promise<OrganizationApiKeyCreatedResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertCanManage(actor.permissions);
    await this.rateLimiter.consume(
      `integrations:api-keys:${actor.tenantId}`,
      PUBLIC_API_RATE_LIMITS.createApiKey.limit,
      PUBLIC_API_RATE_LIMITS.createApiKey.windowSeconds,
    );

    const active = await this.apiKeys.countActiveByTenant(actor.tenantId);
    if (active >= MAX_API_KEYS_PER_ORGANIZATION) {
      throw new ApiKeyLimitExceededError();
    }

    const now = this.clock.now();
    const expiresAt = parseOptionalDate(input.expiresAt, now);
    const token = `${API_KEY_TOKEN_PREFIX}${this.tokens.generate()}`;
    const apiKey = OrganizationApiKey.create({
      organizationId: actor.tenantId,
      name: input.name,
      token,
      tokenHash: this.hasher.hash(token),
      scopes: input.scopes,
      expiresAt,
      createdByUserId: actor.actorId,
      now,
    });
    await this.apiKeys.save(apiKey);
    await this.eventBus.publish(
      new OrganizationApiKeyCreatedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        apiKey.id,
        input.security.correlationId,
      ),
    );
    return { apiKey: toApiKeyDto(apiKey), token };
  }
}

export class ListOrganizationApiKeysUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly apiKeys: OrganizationApiKeyRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
  }): Promise<OrganizationApiKeyListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertCanManage(actor.permissions);
    const items = await this.apiKeys.listByTenant(actor.tenantId);
    return { items: items.map(toApiKeyDto) };
  }
}

export class RevokeOrganizationApiKeyUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly apiKeys: OrganizationApiKeyRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly apiKeyId: string;
    readonly security: RequestSecurityContext;
  }): Promise<void> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertCanManage(actor.permissions);
    const existing = await this.apiKeys.findById(actor.tenantId, createOrganizationApiKeyId(input.apiKeyId));
    if (!existing) {
      throw new ApiKeyNotFoundError();
    }
    const now = this.clock.now();
    const revoked = existing.revoke(now);
    await this.apiKeys.save(revoked);
    await this.eventBus.publish(
      new OrganizationApiKeyRevokedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        revoked.id,
        input.security.correlationId,
      ),
    );
  }
}

function parseOptionalDate(raw: string | undefined, now: Date): Date | undefined {
  if (!raw) {
    return undefined;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= now.getTime()) {
    throw new InvalidApiKeyError('expiresAt must be a future timestamp');
  }
  return parsed;
}
