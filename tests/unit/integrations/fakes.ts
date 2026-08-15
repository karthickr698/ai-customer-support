import type { EventBus, Page, PageRequest } from '@ai-customer-support/shared';
import type { ToolName } from '@ai-customer-support/contracts';
import type {
  HttpToolInvokeRequest,
  HttpToolInvokeResult,
  HttpToolInvokerPort,
  IntegrationCredentialRepository,
  OAuthConnectorRepository,
  OAuthTokenExchangePort,
  OAuthTokenSet,
  SecretCipherPort,
  TenantAccessPort,
  ToolInvocationRepository,
} from '../../../apps/api/src/modules/integrations/application/ports.ts';
import { AesGcmSecretCipher } from '../../../apps/api/src/modules/integrations/adapters/outbound/crypto.ts';
import { InProcessPlatformToolHandler } from '../../../apps/api/src/modules/integrations/adapters/outbound/in-process-platform-tool-handler.ts';
import type { IntegrationCredential } from '../../../apps/api/src/modules/integrations/domain/integration-credential.ts';
import type {
  IntegrationCredentialId,
  OAuthConnectorId,
  ToolInvocationId,
} from '../../../apps/api/src/modules/integrations/domain/ids.ts';
import type { OAuthConnector } from '../../../apps/api/src/modules/integrations/domain/oauth-connector.ts';
import type { ToolInvocation } from '../../../apps/api/src/modules/integrations/domain/tool-invocation.ts';
import { Permissions } from '../../../apps/api/src/modules/organizations/domain/permissions.ts';

export const tenantId = '11111111-1111-1111-1111-111111111111';
export const actorId = 'owner-1';
export const now = new Date('2026-08-15T12:00:00.000Z');

export class MemoryCredentials implements IntegrationCredentialRepository {
  readonly items = new Map<string, IntegrationCredential>();

  async save(credential: IntegrationCredential): Promise<void> {
    this.items.set(credential.id, credential);
  }

  async findById(_tenantId: string, credentialId: IntegrationCredentialId) {
    const item = this.items.get(credentialId);
    return item && item.organizationId === _tenantId ? item : null;
  }

  async findActiveByTool(_tenantId: string, toolName: ToolName) {
    return (
      [...this.items.values()].find(
        (item) => item.organizationId === _tenantId && item.toolName === toolName && item.isActive,
      ) ?? null
    );
  }

  async listActiveByTenant(_tenantId: string) {
    return [...this.items.values()].filter((item) => item.organizationId === _tenantId && item.isActive);
  }
}

export class MemoryConnectors implements OAuthConnectorRepository {
  readonly items = new Map<string, OAuthConnector>();

  async save(connector: OAuthConnector): Promise<void> {
    this.items.set(connector.id, connector);
  }

  async findById(_tenantId: string, connectorId: OAuthConnectorId) {
    const item = this.items.get(connectorId);
    return item && item.organizationId === _tenantId ? item : null;
  }

  async findByProvider(_tenantId: string, provider: string) {
    return (
      [...this.items.values()].find(
        (item) => item.organizationId === _tenantId && item.provider === provider,
      ) ?? null
    );
  }

  async listByTenant(_tenantId: string) {
    return [...this.items.values()].filter((item) => item.organizationId === _tenantId);
  }
}

export class MemoryInvocations implements ToolInvocationRepository {
  readonly items = new Map<string, ToolInvocation>();

  async save(invocation: ToolInvocation): Promise<void> {
    this.items.set(invocation.id, invocation);
  }

  async findById(_tenantId: string, invocationId: ToolInvocationId) {
    const item = this.items.get(invocationId);
    return item && item.organizationId === _tenantId ? item : null;
  }

  async listByTenant(_tenantId: string, page: PageRequest): Promise<Page<ToolInvocation>> {
    const all = [...this.items.values()]
      .filter((item) => item.organizationId === _tenantId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const skip = (page.page - 1) * page.pageSize;
    return {
      items: all.slice(skip, skip + page.pageSize),
      total: all.length,
      page: page.page,
      pageSize: page.pageSize,
    };
  }
}

export class RecordingEvents implements EventBus {
  readonly names: string[] = [];
  async publish(event: { eventName: string }): Promise<void> {
    this.names.push(event.eventName);
  }
  subscribe(): void {}
}

export const ownerAccess: TenantAccessPort = {
  async loadActor() {
    return {
      tenantId,
      actorId,
      permissions: Object.values(Permissions),
    };
  },
};

export const agentAccess: TenantAccessPort = {
  async loadActor() {
    return {
      tenantId,
      actorId: 'agent-1',
      permissions: [
        Permissions.ORGANIZATION_READ,
        Permissions.CONVERSATION_READ,
        Permissions.CONVERSATION_WRITE,
        Permissions.CONVERSATION_ESCALATE,
        Permissions.TICKET_MANAGE,
      ],
    };
  },
};

export const cipher: SecretCipherPort = new AesGcmSecretCipher('a'.repeat(32));
export const platform: PlatformToolHandlerPort = new InProcessPlatformToolHandler();

export class FakeHttpInvoker implements HttpToolInvokerPort {
  readonly calls: HttpToolInvokeRequest[] = [];
  constructor(private readonly result: HttpToolInvokeResult) {}

  async invoke(request: HttpToolInvokeRequest): Promise<HttpToolInvokeResult> {
    this.calls.push(request);
    return this.result;
  }
}

export class FakeOAuthExchange implements OAuthTokenExchangePort {
  async exchangeAuthorizationCode(): Promise<OAuthTokenSet> {
    return { accessToken: 'access-token', refreshToken: 'refresh-token', expiresInSeconds: 3600 };
  }

  async refreshAccessToken(): Promise<OAuthTokenSet> {
    return { accessToken: 'refreshed', expiresInSeconds: 3600 };
  }
}

export const security = {
  ipAddress: '127.0.0.1',
  requestId: 'req-1',
  correlationId: 'corr-1',
};
