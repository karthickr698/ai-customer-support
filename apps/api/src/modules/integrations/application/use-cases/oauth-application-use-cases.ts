import type { EventBus } from '@ai-customer-support/shared';
import type {
  ConnectorCatalogResponse,
  ConnectorConnectionListResponse,
  OAuthApplicationCreatedResponse,
  OAuthApplicationListResponse,
} from '@ai-customer-support/contracts';
import {
  MAX_OAUTH_APPLICATIONS_PER_ORGANIZATION,
  OAUTH_CLIENT_ID_PREFIX,
  OAUTH_CLIENT_SECRET_PREFIX,
} from '../../domain/api-version.js';
import {
  CONNECTOR_CATALOG,
  toHttpConnectorConnection,
  toOAuthConnectorConnection,
} from '../../domain/connector-catalog.js';
import {
  OAuthApplicationLimitExceededError,
  OAuthApplicationNotFoundError,
} from '../../domain/errors.js';
import { OAuthApplicationCreatedEvent, OAuthApplicationRevokedEvent } from '../../domain/events.js';
import { createOAuthApplicationId } from '../../domain/ids.js';
import { IntegrationPolicy } from '../../domain/integration-policy.js';
import { OrganizationOAuthApplication } from '../../domain/oauth-application.js';
import { toOAuthApplicationDto, type RequestSecurityContext } from '../dtos.js';
import { PUBLIC_API_RATE_LIMITS } from '../rate-limits.js';
import type {
  ClockPort,
  DigestHasherPort,
  IntegrationCredentialRepository,
  OAuthApplicationRepository,
  OAuthConnectorRepository,
  RateLimiterPort,
  SecureTokenGeneratorPort,
  TenantAccessPort,
} from '../ports.js';

export class ListConnectorCatalogUseCase {
  constructor(private readonly tenantAccess: TenantAccessPort) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
  }): Promise<ConnectorCatalogResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertCanManage(actor.permissions);
    return { items: CONNECTOR_CATALOG };
  }
}

export class ListConnectorConnectionsUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly credentials: IntegrationCredentialRepository,
    private readonly connectors: OAuthConnectorRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
  }): Promise<ConnectorConnectionListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertCanManage(actor.permissions);
    const [http, oauth] = await Promise.all([
      this.credentials.listActiveByTenant(actor.tenantId),
      this.connectors.listByTenant(actor.tenantId),
    ]);
    return {
      items: [
        ...http.map(toHttpConnectorConnection),
        ...oauth.map(toOAuthConnectorConnection),
      ],
    };
  }
}

export class CreateOAuthApplicationUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly applications: OAuthApplicationRepository,
    private readonly tokens: SecureTokenGeneratorPort,
    private readonly hasher: DigestHasherPort,
    private readonly rateLimiter: RateLimiterPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly allowLocalHttp: boolean,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly name: string;
    readonly redirectUris: readonly string[];
    readonly scopes?: readonly string[];
    readonly security: RequestSecurityContext;
  }): Promise<OAuthApplicationCreatedResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertCanManage(actor.permissions);
    await this.rateLimiter.consume(
      `integrations:oauth-apps:${actor.tenantId}`,
      PUBLIC_API_RATE_LIMITS.createOAuthApp.limit,
      PUBLIC_API_RATE_LIMITS.createOAuthApp.windowSeconds,
    );

    const active = await this.applications.countActiveByTenant(actor.tenantId);
    if (active >= MAX_OAUTH_APPLICATIONS_PER_ORGANIZATION) {
      throw new OAuthApplicationLimitExceededError();
    }

    const clientSecret = `${OAUTH_CLIENT_SECRET_PREFIX}${this.tokens.generate()}`;
    const now = this.clock.now();
    const application = OrganizationOAuthApplication.create({
      organizationId: actor.tenantId,
      name: input.name,
      clientId: `${OAUTH_CLIENT_ID_PREFIX}${this.tokens.generate()}`,
      clientSecret,
      clientSecretHash: this.hasher.hash(clientSecret),
      redirectUris: input.redirectUris,
      scopes: input.scopes,
      createdByUserId: actor.actorId,
      now,
      allowLocalHttp: this.allowLocalHttp,
    });
    await this.applications.save(application);
    await this.eventBus.publish(
      new OAuthApplicationCreatedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        application.id,
        input.security.correlationId,
      ),
    );
    return { application: toOAuthApplicationDto(application), clientSecret };
  }
}

export class ListOAuthApplicationsUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly applications: OAuthApplicationRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
  }): Promise<OAuthApplicationListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertCanManage(actor.permissions);
    const items = await this.applications.listByTenant(actor.tenantId);
    return { items: items.map(toOAuthApplicationDto) };
  }
}

export class RevokeOAuthApplicationUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly applications: OAuthApplicationRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly applicationId: string;
    readonly security: RequestSecurityContext;
  }): Promise<void> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertCanManage(actor.permissions);
    const existing = await this.applications.findById(
      actor.tenantId,
      createOAuthApplicationId(input.applicationId),
    );
    if (!existing) {
      throw new OAuthApplicationNotFoundError();
    }
    const now = this.clock.now();
    const revoked = existing.revoke(now);
    await this.applications.save(revoked);
    await this.eventBus.publish(
      new OAuthApplicationRevokedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        revoked.id,
        input.security.correlationId,
      ),
    );
  }
}
