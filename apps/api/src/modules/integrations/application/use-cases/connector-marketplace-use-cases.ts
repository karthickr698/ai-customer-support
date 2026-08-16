import type {
  CompleteOAuthConnectorRequest,
  ConnectorCatalogItemResponse,
  ConnectorCatalogResponse,
  ConnectorCategory,
  ConnectorConnectionDto,
  ConnectorConnectionListResponse,
  ConnectorConnectionResponse,
  ConnectorConnectionStatus,
  ConnectorDefinitionDto,
  ConnectorHealthDto,
  ConnectorHealthResponse,
  ConnectorKind,
  SetupConnectorRequest,
  SetupConnectorResponse,
  StartConnectorOAuthResponse,
} from '@ai-customer-support/contracts';
import {
  catalogPermissionIds,
  getConnectorCatalogItem,
  requiredCatalogPermissions,
  searchConnectorCatalog,
  toHttpConnectorConnection,
  toOAuthConnectorConnection,
  withConnectionHealth,
} from '../../domain/connector-catalog.js';
import {
  ConnectorCatalogNotFoundError,
  ConnectorConnectionNotFoundError,
  IntegrationCredentialNotFoundError,
  InvalidConnectorSetupError,
  OAuthConnectorNotFoundError,
} from '../../domain/errors.js';
import { createIntegrationCredentialId, createOAuthConnectorId } from '../../domain/ids.js';
import type { IntegrationCredential } from '../../domain/integration-credential.js';
import { IntegrationPolicy } from '../../domain/integration-policy.js';
import type { OAuthConnector } from '../../domain/oauth-connector.js';
import { parseToolName } from '../../domain/tool-catalog.js';
import type { RequestSecurityContext } from '../dtos.js';
import type {
  ClockPort,
  ConnectorHealthProbePort,
  IntegrationCredentialRepository,
  OAuthConnectorRepository,
  OAuthTokenExchangePort,
  SecretCipherPort,
  TenantAccessPort,
} from '../ports.js';
import {
  CompleteOAuthConnectorUseCase,
  DisconnectOAuthConnectorUseCase,
  StartOAuthConnectorUseCase,
  UpsertOAuthConnectorUseCase,
} from './oauth-connector-use-cases.js';
import {
  RevokeIntegrationCredentialUseCase,
  UpsertIntegrationCredentialUseCase,
} from './credential-use-cases.js';

export class ListConnectorCatalogUseCase {
  constructor(private readonly tenantAccess: TenantAccessPort) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly q?: string;
    readonly kind?: ConnectorKind;
    readonly category?: ConnectorCategory;
  }): Promise<ConnectorCatalogResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertCanManage(actor.permissions);
    return searchConnectorCatalog({
      q: input.q,
      kind: input.kind,
      category: input.category,
    });
  }
}

export class GetConnectorCatalogItemUseCase {
  constructor(private readonly tenantAccess: TenantAccessPort) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly catalogId: string;
  }): Promise<ConnectorCatalogItemResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertCanManage(actor.permissions);
    const connector = getConnectorCatalogItem(input.catalogId);
    if (!connector) {
      throw new ConnectorCatalogNotFoundError();
    }
    return { connector };
  }
}

export class ListConnectorConnectionsUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly credentials: IntegrationCredentialRepository,
    private readonly connectors: OAuthConnectorRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly q?: string;
    readonly kind?: ConnectorKind;
    readonly status?: ConnectorConnectionStatus;
  }): Promise<ConnectorConnectionListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertCanManage(actor.permissions);
    const now = this.clock.now();
    const [http, oauth] = await Promise.all([
      this.credentials.listActiveByTenant(actor.tenantId),
      this.connectors.listByTenant(actor.tenantId),
    ]);
    const query = input.q?.trim().toLowerCase();
    const items = [
      ...http.map((item) => toHttpConnectorConnection(item, now)),
      ...oauth.map((item) => toOAuthConnectorConnection(item, now)),
    ].filter((item) => matchesConnectionFilter(item, query, input.kind, input.status));
    return { items };
  }
}

export class GetConnectorConnectionUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly credentials: IntegrationCredentialRepository,
    private readonly connectors: OAuthConnectorRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly connectionId: string;
  }): Promise<ConnectorConnectionResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertCanManage(actor.permissions);
    const loaded = await loadStoredConnection(
      actor.tenantId,
      input.connectionId,
      this.credentials,
      this.connectors,
    );
    return { connection: toStoredConnection(loaded, this.clock.now()) };
  }
}

export class SetupConnectorUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly upsertOAuth: UpsertOAuthConnectorUseCase,
    private readonly upsertCredential: UpsertIntegrationCredentialUseCase,
    private readonly credentials: IntegrationCredentialRepository,
    private readonly connectors: OAuthConnectorRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly body: SetupConnectorRequest;
    readonly security: RequestSecurityContext;
  }): Promise<SetupConnectorResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertCanManage(actor.permissions);
    const definition = getConnectorCatalogItem(input.body.catalogId);
    if (!definition) {
      throw new ConnectorCatalogNotFoundError();
    }

    const permissions = resolveSetupPermissions(definition, input.body.permissions);
    const name = input.body.name?.trim() || definition.name;

    if (definition.kind === 'oauth') {
      const authorizationUrl = input.body.authorizationUrl?.trim() || definition.defaultAuthorizationUrl;
      const tokenUrl = input.body.tokenUrl?.trim() || definition.defaultTokenUrl;
      if (!input.body.clientId?.trim() || !input.body.clientSecret?.trim()) {
        throw new InvalidConnectorSetupError('OAuth client id and client secret are required');
      }
      if (!authorizationUrl || !tokenUrl) {
        throw new InvalidConnectorSetupError('Authorization URL and token URL are required');
      }
      const result = await this.upsertOAuth.execute({
        tenantId: actor.tenantId,
        actorId: actor.actorId,
        provider: definition.provider,
        name,
        clientId: input.body.clientId,
        clientSecret: input.body.clientSecret,
        authorizationUrl,
        tokenUrl,
        scopes: permissions,
      });
      const saved = await this.connectors.findById(actor.tenantId, createOAuthConnectorId(result.connector.id));
      if (!saved) {
        throw new OAuthConnectorNotFoundError();
      }
      return { connection: toOAuthConnectorConnection(saved, this.clock.now()) };
    }

    const toolName = input.body.toolName ?? (permissions.length === 1 ? permissions[0] : undefined);
    if (!toolName) {
      throw new InvalidConnectorSetupError('Select the HTTP tool this credential is allowed to call');
    }
    if (!input.body.secret?.trim() || !input.body.baseUrl?.trim()) {
      throw new InvalidConnectorSetupError('Secret and HTTPS base URL are required');
    }
    const result = await this.upsertCredential.execute({
      tenantId: actor.tenantId,
      actorId: actor.actorId,
      toolName,
      name,
      kind: input.body.credentialKind ?? 'bearer',
      secret: input.body.secret,
      baseUrl: input.body.baseUrl,
      headerName: input.body.headerName,
      provider: input.body.provider ?? definition.provider,
      security: input.security,
    });
    const saved = await this.credentials.findById(
      actor.tenantId,
      createIntegrationCredentialId(result.credential.id),
    );
    if (!saved) {
      throw new IntegrationCredentialNotFoundError();
    }
    return { connection: toHttpConnectorConnection(saved, this.clock.now()) };
  }
}

export class StartConnectorOAuthUseCase {
  constructor(
    private readonly startOAuth: StartOAuthConnectorUseCase,
    private readonly getConnection: GetConnectorConnectionUseCase,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly connectionId: string;
  }): Promise<StartConnectorOAuthResponse> {
    const connection = await this.getConnection.execute(input);
    if (connection.connection.kind !== 'oauth') {
      throw new InvalidConnectorSetupError('Only OAuth connectors can start authorization');
    }
    const started = await this.startOAuth.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      connectorId: input.connectionId,
    });
    return {
      authorizationUrl: started.authorizationUrl,
      connection: connection.connection,
    };
  }
}

export class CompleteConnectorOAuthUseCase {
  constructor(
    private readonly completeOAuth: CompleteOAuthConnectorUseCase,
    private readonly connectors: OAuthConnectorRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly connectionId: string;
    readonly body: CompleteOAuthConnectorRequest;
    readonly security: RequestSecurityContext;
  }): Promise<ConnectorConnectionResponse> {
    const result = await this.completeOAuth.execute({
      code: input.body.code,
      state: input.body.state,
      tenantId: input.tenantId,
      security: input.security,
    });
    if (result.connector.id !== input.connectionId) {
      throw new InvalidConnectorSetupError('OAuth state does not match this connection');
    }
    const saved = await this.connectors.findById(input.tenantId, createOAuthConnectorId(result.connector.id));
    if (!saved) {
      throw new OAuthConnectorNotFoundError();
    }
    return { connection: toOAuthConnectorConnection(saved, this.clock.now()) };
  }
}

export class UpdateConnectorPermissionsUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly credentials: IntegrationCredentialRepository,
    private readonly connectors: OAuthConnectorRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly connectionId: string;
    readonly permissions: readonly string[];
  }): Promise<ConnectorConnectionResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertCanManage(actor.permissions);
    const loaded = await loadStoredConnection(
      actor.tenantId,
      input.connectionId,
      this.credentials,
      this.connectors,
    );
    const now = this.clock.now();

    if (loaded.kind === 'http') {
      const toolName = parseToolName(loaded.credential.toolName);
      const next = input.permissions.map((item) => item.trim()).filter(Boolean);
      if (next.length !== 1 || next[0] !== toolName) {
        throw new InvalidConnectorSetupError(
          'HTTP connector permissions are bound to the selected tool. Create another credential to change tools.',
        );
      }
      return { connection: toHttpConnectorConnection(loaded.credential, now) };
    }

    const definition =
      getConnectorCatalogItem(`oauth-${loaded.connector.provider}`) ?? getConnectorCatalogItem('oauth-custom');
    if (!definition) {
      throw new ConnectorCatalogNotFoundError();
    }
    const permissions = resolveSetupPermissions(definition, input.permissions);
    const updated = loaded.connector.updateScopes(permissions, now);
    await this.connectors.save(updated);
    return { connection: toOAuthConnectorConnection(updated, now) };
  }
}

export class ProbeConnectorHealthUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly credentials: IntegrationCredentialRepository,
    private readonly connectors: OAuthConnectorRepository,
    private readonly cipher: SecretCipherPort,
    private readonly oauth: OAuthTokenExchangePort,
    private readonly probe: ConnectorHealthProbePort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly connectionId: string;
  }): Promise<ConnectorHealthResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertCanManage(actor.permissions);
    const loaded = await loadStoredConnection(
      actor.tenantId,
      input.connectionId,
      this.credentials,
      this.connectors,
    );
    const now = this.clock.now();

    if (loaded.kind === 'http') {
      if (!loaded.credential.isActive) {
        const connection = toHttpConnectorConnection(loaded.credential, now);
        return { connection, health: connection.health };
      }
      const secret = this.cipher.decrypt(loaded.credential.secret.ciphertext, loaded.credential.secret.nonce);
      const header = loaded.credential.authorizationHeader(secret);
      const probed = await this.probe.probe({
        url: loaded.credential.baseUrl,
        headers: { [header.name]: header.value, Accept: 'application/json' },
        timeoutMs: 8_000,
      });
      const health = toProbeHealth(probed.ok, probed.message, probed.latencyMs, now);
      return { connection: withConnectionHealth(toHttpConnectorConnection(loaded.credential, now), health), health };
    }

    let connector = loaded.connector;
    if (!connector.isConnected) {
      const connection = toOAuthConnectorConnection(connector, now);
      return { connection, health: connection.health };
    }

    if (connector.accessTokenExpired(now) && connector.refreshToken) {
      try {
        const clientSecret = this.cipher.decrypt(connector.clientSecret.ciphertext, connector.clientSecret.nonce);
        const refreshToken = this.cipher.decrypt(connector.refreshToken.ciphertext, connector.refreshToken.nonce);
        const tokens = await this.oauth.refreshAccessToken({
          tokenUrl: connector.tokenUrl,
          clientId: connector.clientId,
          clientSecret,
          refreshToken,
        });
        connector = connector.connect({
          accessToken: this.cipher.encrypt(tokens.accessToken),
          refreshToken: tokens.refreshToken ? this.cipher.encrypt(tokens.refreshToken) : connector.refreshToken,
          tokenExpiresAt:
            tokens.expiresInSeconds !== undefined
              ? new Date(now.getTime() + tokens.expiresInSeconds * 1000)
              : undefined,
          externalAccountId: tokens.externalAccountId ?? connector.externalAccountId,
          now,
        });
        await this.connectors.save(connector);
      } catch {
        const health: ConnectorHealthDto = {
          status: 'unhealthy',
          source: 'probe',
          checkedAt: now.toISOString(),
          message: 'The access token is expired and refresh failed.',
          latencyMs: null,
        };
        const connection = withConnectionHealth(toOAuthConnectorConnection(connector, now), health);
        return { connection, health };
      }
    }

    if (connector.accessTokenExpired(now)) {
      const expired = connector.markExpired(now);
      await this.connectors.save(expired);
      const connection = toOAuthConnectorConnection(expired, now);
      const health: ConnectorHealthDto = {
        status: 'unhealthy',
        source: 'probe',
        checkedAt: now.toISOString(),
        message: 'The access token is expired and could not be refreshed.',
        latencyMs: null,
      };
      return { connection: withConnectionHealth(connection, health), health };
    }

    const health: ConnectorHealthDto = {
      status: 'healthy',
      source: 'probe',
      checkedAt: now.toISOString(),
      message: connector.refreshToken
        ? 'OAuth tokens are valid. A refresh token is stored for renewal.'
        : 'OAuth access token is valid.',
      latencyMs: 0,
    };
    return { connection: withConnectionHealth(toOAuthConnectorConnection(connector, now), health), health };
  }
}

export class DisconnectConnectorUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly credentials: IntegrationCredentialRepository,
    private readonly connectors: OAuthConnectorRepository,
    private readonly disconnectOAuth: DisconnectOAuthConnectorUseCase,
    private readonly revokeCredential: RevokeIntegrationCredentialUseCase,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly connectionId: string;
    readonly security: RequestSecurityContext;
  }): Promise<void> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertCanManage(actor.permissions);
    const oauth = await this.connectors.findById(actor.tenantId, createOAuthConnectorId(input.connectionId));
    if (oauth) {
      await this.disconnectOAuth.execute({
        tenantId: actor.tenantId,
        actorId: actor.actorId,
        connectorId: input.connectionId,
        security: input.security,
      });
      return;
    }
    const credential = await this.credentials.findById(
      actor.tenantId,
      createIntegrationCredentialId(input.connectionId),
    );
    if (!credential) {
      throw new ConnectorConnectionNotFoundError();
    }
    await this.revokeCredential.execute({
      tenantId: actor.tenantId,
      actorId: actor.actorId,
      credentialId: input.connectionId,
      security: input.security,
    });
  }
}

type StoredConnection =
  | { readonly kind: 'http'; readonly credential: IntegrationCredential }
  | { readonly kind: 'oauth'; readonly connector: OAuthConnector };

async function loadStoredConnection(
  tenantId: string,
  connectionId: string,
  credentials: IntegrationCredentialRepository,
  connectors: OAuthConnectorRepository,
): Promise<StoredConnection> {
  const oauth = await connectors.findById(tenantId, createOAuthConnectorId(connectionId));
  if (oauth) {
    return { kind: 'oauth', connector: oauth };
  }
  const credential = await credentials.findById(tenantId, createIntegrationCredentialId(connectionId));
  if (credential) {
    return { kind: 'http', credential };
  }
  throw new ConnectorConnectionNotFoundError();
}

function toStoredConnection(loaded: StoredConnection, now: Date): ConnectorConnectionDto {
  return loaded.kind === 'http'
    ? toHttpConnectorConnection(loaded.credential, now)
    : toOAuthConnectorConnection(loaded.connector, now);
}

function matchesConnectionFilter(
  item: ConnectorConnectionDto,
  query: string | undefined,
  kind: ConnectorKind | undefined,
  status: ConnectorConnectionStatus | undefined,
): boolean {
  if (kind && item.kind !== kind) {
    return false;
  }
  if (status && item.status !== status) {
    return false;
  }
  if (!query) {
    return true;
  }
  const haystack = [item.name, item.provider, item.catalogId, item.kind, ...item.permissions].join(' ').toLowerCase();
  return haystack.includes(query);
}

function resolveSetupPermissions(
  definition: ConnectorDefinitionDto,
  requested: readonly string[] | undefined,
): readonly string[] {
  const allowed = catalogPermissionIds(definition);
  const required = requiredCatalogPermissions(definition);
  if (allowed.size === 0) {
    return (requested ?? []).map((item) => item.trim()).filter(Boolean);
  }
  const selected = new Set((requested ?? definition.defaultScopes).map((item) => item.trim()).filter(Boolean));
  for (const permission of required) {
    selected.add(permission);
  }
  for (const permission of selected) {
    if (!allowed.has(permission)) {
      throw new InvalidConnectorSetupError(`Unknown connector permission: ${permission}`);
    }
  }
  return [...selected];
}

function toProbeHealth(ok: boolean, message: string, latencyMs: number, now: Date): ConnectorHealthDto {
  return {
    status: ok ? 'healthy' : 'unhealthy',
    source: 'probe',
    checkedAt: now.toISOString(),
    message,
    latencyMs,
  };
}
