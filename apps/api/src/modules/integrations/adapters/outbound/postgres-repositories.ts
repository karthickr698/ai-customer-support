import type { Page, PageRequest } from '@ai-customer-support/shared';
import type { ToolName } from '@ai-customer-support/contracts';
import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  IntegrationCredentialRepository,
  OAuthConnectorRepository,
  ToolInvocationRepository,
} from '../../application/ports.js';
import {
  createIntegrationCredentialId,
  createOAuthConnectorId,
  createToolInvocationId,
  type IntegrationCredentialId,
  type OAuthConnectorId,
  type ToolInvocationId,
} from '../../domain/ids.js';
import { IntegrationCredential } from '../../domain/integration-credential.js';
import { OAuthConnector, parseOAuthProvider, parseOAuthStatus } from '../../domain/oauth-connector.js';
import { parseToolName } from '../../domain/tool-catalog.js';
import { parseInvocationStatus, ToolInvocation } from '../../domain/tool-invocation.js';

export class PostgresIntegrationCredentialRepository implements IntegrationCredentialRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: string, credentialId: IntegrationCredentialId) {
    const record = await this.prisma.integrationCredential.findFirst({
      where: { id: credentialId, organizationId: tenantId },
    });
    return record ? toCredential(record) : null;
  }

  async findActiveByTool(tenantId: string, toolName: ToolName) {
    const record = await this.prisma.integrationCredential.findFirst({
      where: { organizationId: tenantId, toolName, revokedAt: null },
    });
    return record ? toCredential(record) : null;
  }

  async listActiveByTenant(tenantId: string) {
    const records = await this.prisma.integrationCredential.findMany({
      where: { organizationId: tenantId, revokedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return records.map(toCredential);
  }

  async save(credential: IntegrationCredential): Promise<void> {
    const snapshot = credential.toSnapshot();
    const data: Prisma.IntegrationCredentialUncheckedCreateInput = {
      id: snapshot.id,
      organizationId: snapshot.organizationId,
      toolName: snapshot.toolName,
      provider: snapshot.provider ?? null,
      name: snapshot.name,
      kind: snapshot.kind,
      headerName: snapshot.headerName,
      baseUrl: snapshot.baseUrl,
      secretCiphertext: snapshot.secret.ciphertext,
      secretNonce: snapshot.secret.nonce,
      secretLastFour: snapshot.secretLastFour,
      createdByUserId: snapshot.createdByUserId,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
      revokedAt: snapshot.revokedAt ?? null,
    };
    await this.prisma.integrationCredential.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        provider: data.provider,
        name: data.name,
        kind: data.kind,
        headerName: data.headerName,
        baseUrl: data.baseUrl,
        secretCiphertext: data.secretCiphertext,
        secretNonce: data.secretNonce,
        secretLastFour: data.secretLastFour,
        updatedAt: data.updatedAt,
        revokedAt: data.revokedAt,
      },
    });
  }
}

export class PostgresOAuthConnectorRepository implements OAuthConnectorRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: string, connectorId: OAuthConnectorId) {
    const record = await this.prisma.oAuthConnector.findFirst({
      where: { id: connectorId, organizationId: tenantId },
    });
    return record ? toConnector(record) : null;
  }

  async findByProvider(tenantId: string, provider: string) {
    const record = await this.prisma.oAuthConnector.findFirst({
      where: { organizationId: tenantId, provider },
    });
    return record ? toConnector(record) : null;
  }

  async listByTenant(tenantId: string) {
    const records = await this.prisma.oAuthConnector.findMany({
      where: { organizationId: tenantId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map(toConnector);
  }

  async save(connector: OAuthConnector): Promise<void> {
    const snapshot = connector.toSnapshot();
    const data: Prisma.OAuthConnectorUncheckedCreateInput = {
      id: snapshot.id,
      organizationId: snapshot.organizationId,
      provider: snapshot.provider,
      name: snapshot.name,
      status: snapshot.status,
      authorizationUrl: snapshot.authorizationUrl,
      tokenUrl: snapshot.tokenUrl,
      clientId: snapshot.clientId,
      clientSecretCiphertext: snapshot.clientSecret.ciphertext,
      clientSecretNonce: snapshot.clientSecret.nonce,
      scopes: [...snapshot.scopes],
      accessTokenCiphertext: snapshot.accessToken?.ciphertext ?? null,
      accessTokenNonce: snapshot.accessToken?.nonce ?? null,
      refreshTokenCiphertext: snapshot.refreshToken?.ciphertext ?? null,
      refreshTokenNonce: snapshot.refreshToken?.nonce ?? null,
      tokenExpiresAt: snapshot.tokenExpiresAt ?? null,
      externalAccountId: snapshot.externalAccountId ?? null,
      createdByUserId: snapshot.createdByUserId,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
      disconnectedAt: snapshot.disconnectedAt ?? null,
    };
    await this.prisma.oAuthConnector.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        name: data.name,
        status: data.status,
        authorizationUrl: data.authorizationUrl,
        tokenUrl: data.tokenUrl,
        clientId: data.clientId,
        clientSecretCiphertext: data.clientSecretCiphertext,
        clientSecretNonce: data.clientSecretNonce,
        scopes: data.scopes,
        accessTokenCiphertext: data.accessTokenCiphertext,
        accessTokenNonce: data.accessTokenNonce,
        refreshTokenCiphertext: data.refreshTokenCiphertext,
        refreshTokenNonce: data.refreshTokenNonce,
        tokenExpiresAt: data.tokenExpiresAt,
        externalAccountId: data.externalAccountId,
        updatedAt: data.updatedAt,
        disconnectedAt: data.disconnectedAt,
      },
    });
  }
}

export class PostgresToolInvocationRepository implements ToolInvocationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: string, invocationId: ToolInvocationId) {
    const record = await this.prisma.toolInvocation.findFirst({
      where: { id: invocationId, organizationId: tenantId },
    });
    return record ? toInvocation(record) : null;
  }

  async listByTenant(tenantId: string, page: PageRequest): Promise<Page<ToolInvocation>> {
    const skip = (page.page - 1) * page.pageSize;
    const where = { organizationId: tenantId };
    const [total, records] = await this.prisma.$transaction([
      this.prisma.toolInvocation.count({ where }),
      this.prisma.toolInvocation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: page.pageSize,
      }),
    ]);
    return {
      items: records.map(toInvocation),
      total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }

  async save(invocation: ToolInvocation): Promise<void> {
    const snapshot = invocation.toSnapshot();
    const data: Prisma.ToolInvocationUncheckedCreateInput = {
      id: snapshot.id,
      organizationId: snapshot.organizationId,
      toolName: snapshot.toolName,
      conversationId: snapshot.conversationId ?? null,
      actorId: snapshot.actorId ?? null,
      actorType: snapshot.actorType,
      status: snapshot.status,
      arguments: snapshot.arguments as Prisma.InputJsonValue,
      result: (snapshot.result ?? undefined) as Prisma.InputJsonValue | undefined,
      errorCode: snapshot.errorCode ?? null,
      errorMessage: snapshot.errorMessage ?? null,
      attemptCount: snapshot.attemptCount,
      durationMs: snapshot.durationMs,
      credentialId: snapshot.credentialId ?? null,
      connectorId: snapshot.connectorId ?? null,
      ipAddress: snapshot.ipAddress ?? null,
      userAgent: snapshot.userAgent ?? null,
      requestId: snapshot.requestId ?? null,
      correlationId: snapshot.correlationId ?? null,
      createdAt: snapshot.createdAt,
      completedAt: snapshot.completedAt ?? null,
    };
    await this.prisma.toolInvocation.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        status: data.status,
        result: data.result,
        errorCode: data.errorCode,
        errorMessage: data.errorMessage,
        attemptCount: data.attemptCount,
        durationMs: data.durationMs,
        credentialId: data.credentialId,
        connectorId: data.connectorId,
        completedAt: data.completedAt,
      },
    });
  }
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toCredential(record: {
  id: string;
  organizationId: string;
  toolName: string;
  provider: string | null;
  name: string;
  kind: string;
  headerName: string;
  baseUrl: string;
  secretCiphertext: string;
  secretNonce: string;
  secretLastFour: string;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  revokedAt: Date | null;
}): IntegrationCredential {
  return IntegrationCredential.reconstitute({
    id: createIntegrationCredentialId(record.id),
    organizationId: record.organizationId,
    toolName: parseToolName(record.toolName),
    provider: record.provider ?? undefined,
    name: record.name,
    kind: record.kind as IntegrationCredential['kind'],
    headerName: record.headerName,
    baseUrl: record.baseUrl,
    secret: { ciphertext: record.secretCiphertext, nonce: record.secretNonce },
    secretLastFour: record.secretLastFour,
    createdByUserId: record.createdByUserId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    revokedAt: record.revokedAt ?? undefined,
  });
}

function toConnector(record: {
  id: string;
  organizationId: string;
  provider: string;
  name: string;
  status: string;
  authorizationUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecretCiphertext: string;
  clientSecretNonce: string;
  scopes: string[];
  accessTokenCiphertext: string | null;
  accessTokenNonce: string | null;
  refreshTokenCiphertext: string | null;
  refreshTokenNonce: string | null;
  tokenExpiresAt: Date | null;
  externalAccountId: string | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  disconnectedAt: Date | null;
}): OAuthConnector {
  return OAuthConnector.reconstitute({
    id: createOAuthConnectorId(record.id),
    organizationId: record.organizationId,
    provider: parseOAuthProvider(record.provider),
    name: record.name,
    status: parseOAuthStatus(record.status),
    authorizationUrl: record.authorizationUrl,
    tokenUrl: record.tokenUrl,
    clientId: record.clientId,
    clientSecret: { ciphertext: record.clientSecretCiphertext, nonce: record.clientSecretNonce },
    scopes: record.scopes,
    accessToken:
      record.accessTokenCiphertext && record.accessTokenNonce
        ? { ciphertext: record.accessTokenCiphertext, nonce: record.accessTokenNonce }
        : undefined,
    refreshToken:
      record.refreshTokenCiphertext && record.refreshTokenNonce
        ? { ciphertext: record.refreshTokenCiphertext, nonce: record.refreshTokenNonce }
        : undefined,
    tokenExpiresAt: record.tokenExpiresAt ?? undefined,
    externalAccountId: record.externalAccountId ?? undefined,
    createdByUserId: record.createdByUserId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    disconnectedAt: record.disconnectedAt ?? undefined,
  });
}

function toInvocation(record: {
  id: string;
  organizationId: string;
  toolName: string;
  conversationId: string | null;
  actorId: string | null;
  actorType: string;
  status: string;
  arguments: unknown;
  result: unknown;
  errorCode: string | null;
  errorMessage: string | null;
  attemptCount: number;
  durationMs: number;
  credentialId: string | null;
  connectorId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  correlationId: string | null;
  createdAt: Date;
  completedAt: Date | null;
}): ToolInvocation {
  return ToolInvocation.reconstitute({
    id: createToolInvocationId(record.id),
    organizationId: record.organizationId,
    toolName: parseToolName(record.toolName),
    conversationId: record.conversationId ?? undefined,
    actorId: record.actorId ?? undefined,
    actorType: record.actorType as ToolInvocation['actorType'],
    status: parseInvocationStatus(record.status),
    arguments: isJsonObject(record.arguments) ? record.arguments : {},
    result: isJsonObject(record.result) ? record.result : undefined,
    errorCode: record.errorCode ?? undefined,
    errorMessage: record.errorMessage ?? undefined,
    attemptCount: record.attemptCount,
    durationMs: record.durationMs,
    credentialId: record.credentialId ?? undefined,
    connectorId: record.connectorId ?? undefined,
    ipAddress: record.ipAddress ?? undefined,
    userAgent: record.userAgent ?? undefined,
    requestId: record.requestId ?? undefined,
    correlationId: record.correlationId ?? undefined,
    createdAt: record.createdAt,
    completedAt: record.completedAt ?? undefined,
  });
}
