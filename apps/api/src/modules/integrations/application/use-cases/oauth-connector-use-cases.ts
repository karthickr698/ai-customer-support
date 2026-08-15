import type { EventBus } from '@ai-customer-support/shared';
import type {
  OAuthConnectorListResponse,
  OAuthConnectorResponse,
  StartOAuthConnectorResponse,
} from '@ai-customer-support/contracts';
import {
  OAuthConnectorFailedError,
  OAuthConnectorNotConfiguredError,
  OAuthConnectorNotFoundError,
} from '../../domain/errors.js';
import { OAuthConnectorConnectedEvent, OAuthConnectorDisconnectedEvent } from '../../domain/events.js';
import { createOAuthConnectorId } from '../../domain/ids.js';
import { assertSecret } from '../../domain/integration-credential.js';
import { IntegrationPolicy } from '../../domain/integration-policy.js';
import { OAuthConnector } from '../../domain/oauth-connector.js';
import { toConnectorDto, type RequestSecurityContext } from '../dtos.js';
import type {
  ClockPort,
  OAuthConnectorRepository,
  OAuthConnectorStateStorePort,
  OAuthTokenExchangePort,
  SecretCipherPort,
  SecureTokenGeneratorPort,
  TenantAccessPort,
  TokenHasherPort,
} from '../ports.js';

const OAUTH_STATE_TTL_SECONDS = 600;

export class UpsertOAuthConnectorUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly connectors: OAuthConnectorRepository,
    private readonly cipher: SecretCipherPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly provider: string;
    readonly name: string;
    readonly clientId: string;
    readonly clientSecret: string;
    readonly authorizationUrl: string;
    readonly tokenUrl: string;
    readonly scopes?: readonly string[];
  }): Promise<OAuthConnectorResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertCanManage(actor.permissions);

    const secret = this.cipher.encrypt(assertSecret(input.clientSecret));
    const now = this.clock.now();
    const existing = await this.connectors.findByProvider(actor.tenantId, input.provider);
    const connector = existing
      ? existing.replaceConfig({
          name: input.name,
          clientId: input.clientId,
          clientSecret: secret,
          authorizationUrl: input.authorizationUrl,
          tokenUrl: input.tokenUrl,
          scopes: input.scopes,
          now,
        })
      : OAuthConnector.create({
          organizationId: actor.tenantId,
          provider: input.provider,
          name: input.name,
          clientId: input.clientId,
          clientSecret: secret,
          authorizationUrl: input.authorizationUrl,
          tokenUrl: input.tokenUrl,
          scopes: input.scopes,
          createdByUserId: actor.actorId,
          now,
        });

    await this.connectors.save(connector);
    return { connector: toConnectorDto(connector) };
  }
}

export class ListOAuthConnectorsUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly connectors: OAuthConnectorRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
  }): Promise<OAuthConnectorListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertCanManage(actor.permissions);
    const items = await this.connectors.listByTenant(actor.tenantId);
    return { items: items.map(toConnectorDto) };
  }
}

export class StartOAuthConnectorUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly connectors: OAuthConnectorRepository,
    private readonly stateStore: OAuthConnectorStateStorePort,
    private readonly tokens: SecureTokenGeneratorPort,
    private readonly hasher: TokenHasherPort,
    private readonly redirectUri: string | undefined,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly connectorId: string;
  }): Promise<StartOAuthConnectorResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertCanManage(actor.permissions);
    if (!this.redirectUri) {
      throw new OAuthConnectorNotConfiguredError();
    }

    const connector = await this.connectors.findById(
      actor.tenantId,
      createOAuthConnectorId(input.connectorId),
    );
    if (!connector) {
      throw new OAuthConnectorNotFoundError();
    }

    const state = this.tokens.generate();
    const codeVerifier = this.tokens.generate();
    await this.stateStore.save(
      state,
      {
        tenantId: actor.tenantId,
        connectorId: connector.id,
        actorId: actor.actorId,
        codeVerifier,
        redirectUri: this.redirectUri,
      },
      OAUTH_STATE_TTL_SECONDS,
    );

    return {
      authorizationUrl: connector.authorizationUrlWith({
        state,
        redirectUri: this.redirectUri,
        codeChallenge: this.hasher.pkceS256Challenge(codeVerifier),
      }),
    };
  }
}

export class CompleteOAuthConnectorUseCase {
  constructor(
    private readonly connectors: OAuthConnectorRepository,
    private readonly stateStore: OAuthConnectorStateStorePort,
    private readonly exchange: OAuthTokenExchangePort,
    private readonly cipher: SecretCipherPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly code: string;
    readonly state: string;
    readonly tenantId?: string;
    readonly security?: RequestSecurityContext;
  }): Promise<OAuthConnectorResponse> {
    const stored = await this.stateStore.take(input.state);
    if (!stored) {
      throw new OAuthConnectorFailedError('OAuth state expired. Start authorization again.');
    }
    if (input.tenantId && input.tenantId !== stored.tenantId) {
      throw new OAuthConnectorFailedError();
    }

    const connector = await this.connectors.findById(
      stored.tenantId,
      createOAuthConnectorId(stored.connectorId),
    );
    if (!connector) {
      throw new OAuthConnectorNotFoundError();
    }

    const clientSecret = this.cipher.decrypt(
      connector.clientSecret.ciphertext,
      connector.clientSecret.nonce,
    );
    const tokens = await this.exchange.exchangeAuthorizationCode({
      tokenUrl: connector.tokenUrl,
      clientId: connector.clientId,
      clientSecret,
      code: input.code,
      codeVerifier: stored.codeVerifier,
      redirectUri: stored.redirectUri,
    });

    const now = this.clock.now();
    const connected = connector.connect({
      accessToken: this.cipher.encrypt(tokens.accessToken),
      refreshToken: tokens.refreshToken ? this.cipher.encrypt(tokens.refreshToken) : undefined,
      tokenExpiresAt:
        tokens.expiresInSeconds !== undefined
          ? new Date(now.getTime() + tokens.expiresInSeconds * 1000)
          : undefined,
      externalAccountId: tokens.externalAccountId,
      now,
    });
    await this.connectors.save(connected);
    await this.eventBus.publish(
      new OAuthConnectorConnectedEvent(
        crypto.randomUUID(),
        now,
        stored.tenantId,
        connected.id,
        connected.provider,
        input.security?.correlationId,
      ),
    );

    return { connector: toConnectorDto(connected) };
  }
}

export class DisconnectOAuthConnectorUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly connectors: OAuthConnectorRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly connectorId: string;
    readonly security: RequestSecurityContext;
  }): Promise<void> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertCanManage(actor.permissions);
    const connector = await this.connectors.findById(
      actor.tenantId,
      createOAuthConnectorId(input.connectorId),
    );
    if (!connector) {
      throw new OAuthConnectorNotFoundError();
    }

    const now = this.clock.now();
    const disconnected = connector.disconnect(now);
    await this.connectors.save(disconnected);
    await this.eventBus.publish(
      new OAuthConnectorDisconnectedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        disconnected.id,
        disconnected.provider,
        input.security.correlationId,
      ),
    );
  }
}
