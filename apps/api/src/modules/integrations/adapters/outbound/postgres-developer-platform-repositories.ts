import type { Page, PageRequest } from '@ai-customer-support/shared';
import type { OrganizationPermission } from '@ai-customer-support/contracts';
import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  ApiUsageListFilter,
  ApiUsageRepository,
  ApiUsageSummary,
  OAuthApplicationRepository,
  OAuthGrantRepository,
  OrganizationApiKeyRepository,
  WebhookDeliveryAttemptRepository,
  WebhookDeliveryRepository,
  WebhookSubscriptionRepository,
} from '../../application/ports.js';
import { OrganizationApiKey } from '../../domain/api-key.js';
import { PublicApiUsageRecord, parsePublicApiAuthKind } from '../../domain/api-usage-record.js';
import {
  createOAuthApplicationId,
  createOAuthGrantId,
  createOrganizationApiKeyId,
  createPublicApiUsageId,
  createWebhookDeliveryAttemptId,
  createWebhookDeliveryId,
  createWebhookSubscriptionId,
  type OAuthApplicationId,
  type OAuthGrantId,
  type OrganizationApiKeyId,
  type PublicApiUsageId,
  type WebhookDeliveryAttemptId,
  type WebhookDeliveryId,
  type WebhookSubscriptionId,
} from '../../domain/ids.js';
import { OrganizationOAuthApplication } from '../../domain/oauth-application.js';
import { OrganizationOAuthGrant } from '../../domain/oauth-grant.js';
import { parseWebhookDeliveryStatus, WebhookDelivery } from '../../domain/webhook-delivery.js';
import {
  parseWebhookAttemptStatus,
  WebhookDeliveryAttempt,
} from '../../domain/webhook-delivery-attempt.js';
import { parseWebhookStatus, WebhookSubscription } from '../../domain/webhook-subscription.js';

export class PostgresOrganizationApiKeyRepository implements OrganizationApiKeyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: string, apiKeyId: OrganizationApiKeyId) {
    const record = await this.prisma.organizationApiKey.findFirst({
      where: { id: apiKeyId, organizationId: tenantId },
    });
    return record ? toApiKey(record) : null;
  }

  async findByTokenHash(tokenHash: string) {
    const record = await this.prisma.organizationApiKey.findUnique({ where: { tokenHash } });
    return record ? toApiKey(record) : null;
  }

  async listByTenant(tenantId: string) {
    const records = await this.prisma.organizationApiKey.findMany({
      where: { organizationId: tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(toApiKey);
  }

  async countActiveByTenant(tenantId: string) {
    return this.prisma.organizationApiKey.count({
      where: { organizationId: tenantId, revokedAt: null },
    });
  }

  async save(apiKey: OrganizationApiKey): Promise<void> {
    const snapshot = apiKey.toSnapshot();
    const data: Prisma.OrganizationApiKeyUncheckedCreateInput = {
      id: snapshot.id,
      organizationId: snapshot.organizationId,
      name: snapshot.name,
      prefix: snapshot.prefix,
      tokenHash: snapshot.tokenHash,
      scopes: [...snapshot.scopes],
      lastUsedAt: snapshot.lastUsedAt ?? null,
      expiresAt: snapshot.expiresAt ?? null,
      createdByUserId: snapshot.createdByUserId,
      createdAt: snapshot.createdAt,
      revokedAt: snapshot.revokedAt ?? null,
    };
    await this.prisma.organizationApiKey.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        lastUsedAt: data.lastUsedAt,
        revokedAt: data.revokedAt,
      },
    });
  }
}

export class PostgresWebhookSubscriptionRepository implements WebhookSubscriptionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: string, subscriptionId: WebhookSubscriptionId) {
    const record = await this.prisma.webhookSubscription.findFirst({
      where: { id: subscriptionId, organizationId: tenantId },
    });
    return record ? toWebhook(record) : null;
  }

  async listByTenant(tenantId: string) {
    const records = await this.prisma.webhookSubscription.findMany({
      where: { organizationId: tenantId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map(toWebhook);
  }

  async listActiveByTenantAndEvent(tenantId: string, eventName: string) {
    const records = await this.prisma.webhookSubscription.findMany({
      where: { organizationId: tenantId, status: 'active', events: { has: eventName } },
    });
    return records.map(toWebhook);
  }

  async countActiveByTenant(tenantId: string) {
    return this.prisma.webhookSubscription.count({
      where: { organizationId: tenantId, status: { in: ['active', 'paused'] } },
    });
  }

  async save(subscription: WebhookSubscription): Promise<void> {
    const snapshot = subscription.toSnapshot();
    const data: Prisma.WebhookSubscriptionUncheckedCreateInput = {
      id: snapshot.id,
      organizationId: snapshot.organizationId,
      url: snapshot.url,
      description: snapshot.description ?? null,
      events: [...snapshot.events],
      secretCiphertext: snapshot.secret.ciphertext,
      secretNonce: snapshot.secret.nonce,
      secretLastFour: snapshot.secretLastFour,
      status: snapshot.status,
      createdByUserId: snapshot.createdByUserId,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
      disabledAt: snapshot.disabledAt ?? null,
    };
    await this.prisma.webhookSubscription.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        url: data.url,
        description: data.description,
        events: data.events,
        secretCiphertext: data.secretCiphertext,
        secretNonce: data.secretNonce,
        secretLastFour: data.secretLastFour,
        status: data.status,
        updatedAt: data.updatedAt,
        disabledAt: data.disabledAt,
      },
    });
  }
}

export class PostgresWebhookDeliveryRepository implements WebhookDeliveryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: string, deliveryId: WebhookDeliveryId) {
    const record = await this.prisma.webhookDelivery.findFirst({
      where: { id: deliveryId, organizationId: tenantId },
    });
    return record ? toDelivery(record) : null;
  }

  async listBySubscription(
    tenantId: string,
    subscriptionId: WebhookSubscriptionId,
    page: PageRequest,
  ): Promise<Page<WebhookDelivery>> {
    const skip = (page.page - 1) * page.pageSize;
    const where = { organizationId: tenantId, subscriptionId };
    const [total, records] = await this.prisma.$transaction([
      this.prisma.webhookDelivery.count({ where }),
      this.prisma.webhookDelivery.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: page.pageSize,
      }),
    ]);
    return { items: records.map(toDelivery), total, page: page.page, pageSize: page.pageSize };
  }

  async save(delivery: WebhookDelivery): Promise<void> {
    const snapshot = delivery.toSnapshot();
    const data: Prisma.WebhookDeliveryUncheckedCreateInput = {
      id: snapshot.id,
      organizationId: snapshot.organizationId,
      subscriptionId: snapshot.subscriptionId,
      eventName: snapshot.eventName,
      payload: snapshot.payload as Prisma.InputJsonValue,
      status: snapshot.status,
      attemptCount: snapshot.attemptCount,
      responseStatus: snapshot.responseStatus ?? null,
      errorMessage: snapshot.errorMessage ?? null,
      nextAttemptAt: snapshot.nextAttemptAt ?? null,
      createdAt: snapshot.createdAt,
      completedAt: snapshot.completedAt ?? null,
    };
    await this.prisma.webhookDelivery.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        status: data.status,
        attemptCount: data.attemptCount,
        responseStatus: data.responseStatus,
        errorMessage: data.errorMessage,
        nextAttemptAt: data.nextAttemptAt,
        completedAt: data.completedAt,
      },
    });
  }

  async listDue(now: Date, limit: number, tenantId?: string): Promise<WebhookDelivery[]> {
    const records = await this.prisma.webhookDelivery.findMany({
      where: {
        ...(tenantId ? { organizationId: tenantId } : {}),
        OR: [
          { status: 'pending', nextAttemptAt: null },
          { status: 'pending', nextAttemptAt: { lte: now } },
          { status: 'failed', nextAttemptAt: { lte: now } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return records.map(toDelivery);
  }
}

export class PostgresWebhookDeliveryAttemptRepository implements WebhookDeliveryAttemptRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: string, attemptId: WebhookDeliveryAttemptId) {
    const record = await this.prisma.webhookDeliveryAttempt.findFirst({
      where: { id: attemptId, organizationId: tenantId },
    });
    return record ? toAttempt(record) : null;
  }

  async listByDelivery(tenantId: string, deliveryId: WebhookDeliveryId) {
    const records = await this.prisma.webhookDeliveryAttempt.findMany({
      where: { organizationId: tenantId, deliveryId },
      orderBy: { attempt: 'asc' },
    });
    return records.map(toAttempt);
  }

  async save(attempt: WebhookDeliveryAttempt): Promise<void> {
    const snapshot = attempt.toSnapshot();
    const data: Prisma.WebhookDeliveryAttemptUncheckedCreateInput = {
      id: snapshot.id,
      organizationId: snapshot.organizationId,
      deliveryId: snapshot.deliveryId,
      attempt: snapshot.attempt,
      status: snapshot.status,
      responseStatus: snapshot.responseStatus ?? null,
      durationMs: snapshot.durationMs,
      signatureTimestamp: snapshot.signatureTimestamp,
      signatureHeader: snapshot.signatureHeader,
      errorMessage: snapshot.errorMessage ?? null,
      responseBodyPreview: snapshot.responseBodyPreview ?? null,
      startedAt: snapshot.startedAt,
      finishedAt: snapshot.finishedAt,
    };
    await this.prisma.webhookDeliveryAttempt.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        status: data.status,
        responseStatus: data.responseStatus,
        durationMs: data.durationMs,
        errorMessage: data.errorMessage,
        responseBodyPreview: data.responseBodyPreview,
        finishedAt: data.finishedAt,
      },
    });
  }
}

export class PostgresApiUsageRepository implements ApiUsageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: string, usageId: PublicApiUsageId) {
    const record = await this.prisma.publicApiUsageRecord.findFirst({
      where: { id: usageId, organizationId: tenantId },
    });
    return record ? toUsage(record) : null;
  }

  async save(record: PublicApiUsageRecord): Promise<void> {
    const snapshot = record.toSnapshot();
    await this.prisma.publicApiUsageRecord.create({
      data: {
        id: snapshot.id,
        organizationId: snapshot.organizationId,
        actorId: snapshot.actorId ?? null,
        authKind: snapshot.authKind,
        credentialId: snapshot.credentialId ?? null,
        method: snapshot.method,
        path: snapshot.path,
        route: snapshot.route,
        statusCode: snapshot.statusCode,
        durationMs: snapshot.durationMs,
        ipAddress: snapshot.ipAddress ?? null,
        userAgent: snapshot.userAgent ?? null,
        requestId: snapshot.requestId ?? null,
        occurredAt: snapshot.occurredAt,
      },
    });
  }

  async listByTenant(tenantId: string, page: PageRequest, filter: ApiUsageListFilter) {
    const skip = (page.page - 1) * page.pageSize;
    const where: Prisma.PublicApiUsageRecordWhereInput = {
      organizationId: tenantId,
      ...(filter.method ? { method: filter.method.toUpperCase() } : {}),
      ...(filter.route ? { route: filter.route } : {}),
      ...(filter.statusCode ? { statusCode: filter.statusCode } : {}),
      ...(filter.authKind ? { authKind: filter.authKind } : {}),
      ...(filter.credentialId ? { credentialId: filter.credentialId } : {}),
      ...(filter.from || filter.to
        ? {
            occurredAt: {
              ...(filter.from ? { gte: filter.from } : {}),
              ...(filter.to ? { lte: filter.to } : {}),
            },
          }
        : {}),
    };
    const [total, records] = await this.prisma.$transaction([
      this.prisma.publicApiUsageRecord.count({ where }),
      this.prisma.publicApiUsageRecord.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip,
        take: page.pageSize,
      }),
    ]);
    return { items: records.map(toUsage), total, page: page.page, pageSize: page.pageSize };
  }

  async summarize(tenantId: string, from: Date, to: Date): Promise<ApiUsageSummary> {
    const where = { organizationId: tenantId, occurredAt: { gte: from, lte: to } };
    const [aggregates, errorCount, byRoute, routeErrors, byStatus, byAuth, byDay] = await Promise.all([
      this.prisma.publicApiUsageRecord.aggregate({
        where,
        _count: { _all: true },
        _avg: { durationMs: true },
      }),
      this.prisma.publicApiUsageRecord.count({
        where: { ...where, statusCode: { gte: 400 } },
      }),
      this.prisma.publicApiUsageRecord.groupBy({
        by: ['method', 'route'],
        where,
        _count: { _all: true },
        _avg: { durationMs: true },
      }),
      this.prisma.publicApiUsageRecord.groupBy({
        by: ['method', 'route'],
        where: { ...where, statusCode: { gte: 400 } },
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<Array<{ status_class: string; count: bigint }>>`
        SELECT ((status_code / 100)::text || 'xx') AS status_class, COUNT(*)::bigint AS count
        FROM public_api_usage_records
        WHERE organization_id = ${tenantId}::uuid
          AND occurred_at >= ${from}
          AND occurred_at <= ${to}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      this.prisma.publicApiUsageRecord.groupBy({
        by: ['authKind'],
        where,
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<Array<{ date: Date; count: bigint; error_count: bigint }>>`
        SELECT date_trunc('day', occurred_at) AS date,
               COUNT(*)::bigint AS count,
               COUNT(*) FILTER (WHERE status_code >= 400)::bigint AS error_count
        FROM public_api_usage_records
        WHERE organization_id = ${tenantId}::uuid
          AND occurred_at >= ${from}
          AND occurred_at <= ${to}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
    ]);
    const routeErrorCounts = new Map(
      routeErrors.map((row) => [`${row.method} ${row.route}`, row._count._all] as const),
    );
    return {
      totalRequests: aggregates._count._all,
      errorCount,
      averageDurationMs: Math.round(aggregates._avg.durationMs ?? 0),
      byRoute: byRoute.map((row) => ({
        method: row.method,
        route: row.route,
        count: row._count._all,
        errorCount: routeErrorCounts.get(`${row.method} ${row.route}`) ?? 0,
        averageDurationMs: Math.round(row._avg.durationMs ?? 0),
      })),
      byStatus: byStatus.map((row) => ({ statusClass: row.status_class, count: Number(row.count) })),
      byAuthKind: byAuth.map((row) => ({ authKind: row.authKind, count: row._count._all })),
      byDay: byDay.map((row) => ({
        date: row.date.toISOString().slice(0, 10),
        count: Number(row.count),
        errorCount: Number(row.error_count),
      })),
    };
  }
}

export class PostgresOAuthApplicationRepository implements OAuthApplicationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: string, applicationId: OAuthApplicationId) {
    const record = await this.prisma.organizationOAuthApplication.findFirst({
      where: { id: applicationId, organizationId: tenantId },
    });
    return record ? toOAuthApp(record) : null;
  }

  async findByClientId(clientId: string) {
    const record = await this.prisma.organizationOAuthApplication.findUnique({ where: { clientId } });
    return record ? toOAuthApp(record) : null;
  }

  async listByTenant(tenantId: string) {
    const records = await this.prisma.organizationOAuthApplication.findMany({
      where: { organizationId: tenantId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map(toOAuthApp);
  }

  async countActiveByTenant(tenantId: string) {
    return this.prisma.organizationOAuthApplication.count({
      where: { organizationId: tenantId, revokedAt: null },
    });
  }

  async save(application: OrganizationOAuthApplication): Promise<void> {
    const snapshot = application.toSnapshot();
    const data: Prisma.OrganizationOAuthApplicationUncheckedCreateInput = {
      id: snapshot.id,
      organizationId: snapshot.organizationId,
      name: snapshot.name,
      clientId: snapshot.clientId,
      clientSecretHash: snapshot.clientSecretHash,
      clientSecretLastFour: snapshot.clientSecretLastFour,
      redirectUris: [...snapshot.redirectUris],
      scopes: [...snapshot.scopes],
      createdByUserId: snapshot.createdByUserId,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
      revokedAt: snapshot.revokedAt ?? null,
    };
    await this.prisma.organizationOAuthApplication.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        name: data.name,
        revokedAt: data.revokedAt,
        updatedAt: data.updatedAt,
      },
    });
  }
}

export class PostgresOAuthGrantRepository implements OAuthGrantRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: string, grantId: OAuthGrantId) {
    const record = await this.prisma.organizationOAuthGrant.findFirst({
      where: { id: grantId, organizationId: tenantId },
    });
    return record ? toGrant(record) : null;
  }

  async findByCodeHash(codeHash: string) {
    const record = await this.prisma.organizationOAuthGrant.findUnique({ where: { codeHash } });
    return record ? toGrant(record) : null;
  }

  async findByAccessTokenHash(tokenHash: string) {
    const record = await this.prisma.organizationOAuthGrant.findUnique({
      where: { accessTokenHash: tokenHash },
    });
    return record ? toGrant(record) : null;
  }

  async findByRefreshTokenHash(tokenHash: string) {
    const record = await this.prisma.organizationOAuthGrant.findUnique({
      where: { refreshTokenHash: tokenHash },
    });
    return record ? toGrant(record) : null;
  }

  async save(grant: OrganizationOAuthGrant): Promise<void> {
    const snapshot = grant.toSnapshot();
    const data: Prisma.OrganizationOAuthGrantUncheckedCreateInput = {
      id: snapshot.id,
      organizationId: snapshot.organizationId,
      applicationId: snapshot.applicationId,
      userId: snapshot.userId,
      codeHash: snapshot.codeHash ?? null,
      codeChallenge: snapshot.codeChallenge,
      redirectUri: snapshot.redirectUri,
      scopes: [...snapshot.scopes],
      accessTokenHash: snapshot.accessTokenHash ?? null,
      refreshTokenHash: snapshot.refreshTokenHash ?? null,
      accessExpiresAt: snapshot.accessExpiresAt ?? null,
      refreshExpiresAt: snapshot.refreshExpiresAt ?? null,
      createdAt: snapshot.createdAt,
      consumedAt: snapshot.consumedAt ?? null,
      revokedAt: snapshot.revokedAt ?? null,
    };
    await this.prisma.organizationOAuthGrant.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        accessTokenHash: data.accessTokenHash,
        refreshTokenHash: data.refreshTokenHash,
        accessExpiresAt: data.accessExpiresAt,
        refreshExpiresAt: data.refreshExpiresAt,
        consumedAt: data.consumedAt,
        revokedAt: data.revokedAt,
      },
    });
  }
}

function toApiKey(record: {
  id: string;
  organizationId: string;
  name: string;
  prefix: string;
  tokenHash: string;
  scopes: string[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdByUserId: string;
  createdAt: Date;
  revokedAt: Date | null;
}): OrganizationApiKey {
  return OrganizationApiKey.reconstitute({
    id: createOrganizationApiKeyId(record.id),
    organizationId: record.organizationId,
    name: record.name,
    prefix: record.prefix,
    tokenHash: record.tokenHash,
    scopes: record.scopes as OrganizationPermission[],
    lastUsedAt: record.lastUsedAt ?? undefined,
    expiresAt: record.expiresAt ?? undefined,
    createdByUserId: record.createdByUserId,
    createdAt: record.createdAt,
    revokedAt: record.revokedAt ?? undefined,
  });
}

function toWebhook(record: {
  id: string;
  organizationId: string;
  url: string;
  description: string | null;
  events: string[];
  secretCiphertext: string;
  secretNonce: string;
  secretLastFour: string;
  status: string;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  disabledAt: Date | null;
}): WebhookSubscription {
  return WebhookSubscription.reconstitute({
    id: createWebhookSubscriptionId(record.id),
    organizationId: record.organizationId,
    url: record.url,
    description: record.description ?? undefined,
    events: record.events as WebhookSubscription['events'],
    secret: { ciphertext: record.secretCiphertext, nonce: record.secretNonce },
    secretLastFour: record.secretLastFour,
    status: parseWebhookStatus(record.status),
    createdByUserId: record.createdByUserId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    disabledAt: record.disabledAt ?? undefined,
  });
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toDelivery(record: {
  id: string;
  organizationId: string;
  subscriptionId: string;
  eventName: string;
  payload: unknown;
  status: string;
  attemptCount: number;
  responseStatus: number | null;
  errorMessage: string | null;
  nextAttemptAt: Date | null;
  createdAt: Date;
  completedAt: Date | null;
}): WebhookDelivery {
  return WebhookDelivery.reconstitute({
    id: createWebhookDeliveryId(record.id),
    organizationId: record.organizationId,
    subscriptionId: createWebhookSubscriptionId(record.subscriptionId),
    eventName: record.eventName as WebhookDelivery['eventName'],
    payload: isJsonObject(record.payload) ? record.payload : {},
    status: parseWebhookDeliveryStatus(record.status),
    attemptCount: record.attemptCount,
    responseStatus: record.responseStatus ?? undefined,
    errorMessage: record.errorMessage ?? undefined,
    nextAttemptAt: record.nextAttemptAt ?? undefined,
    createdAt: record.createdAt,
    completedAt: record.completedAt ?? undefined,
  });
}

function toAttempt(record: {
  id: string;
  organizationId: string;
  deliveryId: string;
  attempt: number;
  status: string;
  responseStatus: number | null;
  durationMs: number;
  signatureTimestamp: number;
  signatureHeader: string;
  errorMessage: string | null;
  responseBodyPreview: string | null;
  startedAt: Date;
  finishedAt: Date;
}): WebhookDeliveryAttempt {
  return WebhookDeliveryAttempt.reconstitute({
    id: createWebhookDeliveryAttemptId(record.id),
    organizationId: record.organizationId,
    deliveryId: createWebhookDeliveryId(record.deliveryId),
    attempt: record.attempt,
    status: parseWebhookAttemptStatus(record.status),
    responseStatus: record.responseStatus ?? undefined,
    durationMs: record.durationMs,
    signatureTimestamp: record.signatureTimestamp,
    signatureHeader: record.signatureHeader,
    errorMessage: record.errorMessage ?? undefined,
    responseBodyPreview: record.responseBodyPreview ?? undefined,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
  });
}

function toUsage(record: {
  id: string;
  organizationId: string;
  actorId: string | null;
  authKind: string;
  credentialId: string | null;
  method: string;
  path: string;
  route: string;
  statusCode: number;
  durationMs: number;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  occurredAt: Date;
}): PublicApiUsageRecord {
  return PublicApiUsageRecord.reconstitute({
    id: createPublicApiUsageId(record.id),
    organizationId: record.organizationId,
    actorId: record.actorId ?? undefined,
    authKind: parsePublicApiAuthKind(record.authKind),
    credentialId: record.credentialId ?? undefined,
    method: record.method,
    path: record.path,
    route: record.route,
    statusCode: record.statusCode,
    durationMs: record.durationMs,
    ipAddress: record.ipAddress ?? undefined,
    userAgent: record.userAgent ?? undefined,
    requestId: record.requestId ?? undefined,
    occurredAt: record.occurredAt,
  });
}

function toOAuthApp(record: {
  id: string;
  organizationId: string;
  name: string;
  clientId: string;
  clientSecretHash: string;
  clientSecretLastFour: string;
  redirectUris: string[];
  scopes: string[];
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  revokedAt: Date | null;
}): OrganizationOAuthApplication {
  return OrganizationOAuthApplication.reconstitute({
    id: createOAuthApplicationId(record.id),
    organizationId: record.organizationId,
    name: record.name,
    clientId: record.clientId,
    clientSecretHash: record.clientSecretHash,
    clientSecretLastFour: record.clientSecretLastFour,
    redirectUris: record.redirectUris,
    scopes: record.scopes as OrganizationPermission[],
    createdByUserId: record.createdByUserId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    revokedAt: record.revokedAt ?? undefined,
  });
}

function toGrant(record: {
  id: string;
  organizationId: string;
  applicationId: string;
  userId: string;
  codeHash: string | null;
  codeChallenge: string;
  redirectUri: string;
  scopes: string[];
  accessTokenHash: string | null;
  refreshTokenHash: string | null;
  accessExpiresAt: Date | null;
  refreshExpiresAt: Date | null;
  createdAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
}): OrganizationOAuthGrant {
  return OrganizationOAuthGrant.reconstitute({
    id: createOAuthGrantId(record.id),
    organizationId: record.organizationId,
    applicationId: createOAuthApplicationId(record.applicationId),
    userId: record.userId,
    codeHash: record.codeHash ?? undefined,
    codeChallenge: record.codeChallenge,
    redirectUri: record.redirectUri,
    scopes: record.scopes as OrganizationPermission[],
    accessTokenHash: record.accessTokenHash ?? undefined,
    refreshTokenHash: record.refreshTokenHash ?? undefined,
    accessExpiresAt: record.accessExpiresAt ?? undefined,
    refreshExpiresAt: record.refreshExpiresAt ?? undefined,
    createdAt: record.createdAt,
    consumedAt: record.consumedAt ?? undefined,
    revokedAt: record.revokedAt ?? undefined,
  });
}
