import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  createRequirePermissionPreHandler,
  createResolveTenantPreHandler,
  Permissions,
  type ResolveTenantAccessUseCase,
} from '../../../../organizations/index.js';
import type { RequestSecurityContext } from '../../../application/dtos.js';
import type { ListSecurityAuditLogsUseCase } from '../../../application/use-cases/audit-use-cases.js';
import type {
  DecryptPayloadUseCase,
  EncryptPayloadUseCase,
} from '../../../application/use-cases/encryption-use-cases.js';
import type {
  AddSecurityIpAllowlistEntryUseCase,
  ListSecurityIpAllowlistUseCase,
  RemoveSecurityIpAllowlistEntryUseCase,
} from '../../../application/use-cases/ip-allowlist-use-cases.js';
import type {
  GetSecurityPolicyUseCase,
  UpdateSecurityPolicyUseCase,
} from '../../../application/use-cases/policy-use-cases.js';
import type { GetSecurityRateLimitsUseCase } from '../../../application/use-cases/rate-limit-use-cases.js';
import type {
  CreateSecuritySecretUseCase,
  GetSecuritySecretUseCase,
  ListSecuritySecretsUseCase,
  RevealSecuritySecretUseCase,
  RevokeSecuritySecretUseCase,
  RotateSecuritySecretUseCase,
} from '../../../application/use-cases/secret-use-cases.js';
import { UnauthorizedError } from '../../../domain/errors.js';
import { parseBody } from './parse-body.js';
import {
  addIpAllowlistBodySchema,
  auditLogQuerySchema,
  createSecretBodySchema,
  decryptBodySchema,
  encryptBodySchema,
  rotateSecretBodySchema,
  updatePolicyBodySchema,
} from './security-schemas.js';

export type SecurityHttpUseCases = {
  readonly getPolicy: GetSecurityPolicyUseCase;
  readonly updatePolicy: UpdateSecurityPolicyUseCase;
  readonly listIpAllowlist: ListSecurityIpAllowlistUseCase;
  readonly addIpAllowlist: AddSecurityIpAllowlistEntryUseCase;
  readonly removeIpAllowlist: RemoveSecurityIpAllowlistEntryUseCase;
  readonly listSecrets: ListSecuritySecretsUseCase;
  readonly getSecret: GetSecuritySecretUseCase;
  readonly createSecret: CreateSecuritySecretUseCase;
  readonly revealSecret: RevealSecuritySecretUseCase;
  readonly rotateSecret: RotateSecuritySecretUseCase;
  readonly revokeSecret: RevokeSecuritySecretUseCase;
  readonly encrypt: EncryptPayloadUseCase;
  readonly decrypt: DecryptPayloadUseCase;
  readonly listAuditLogs: ListSecurityAuditLogsUseCase;
  readonly getRateLimits: GetSecurityRateLimitsUseCase;
};

export type AuthenticatePreHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

export async function registerSecurityRoutes(
  app: FastifyInstance,
  useCases: SecurityHttpUseCases,
  authenticate: AuthenticatePreHandler,
  resolveTenantAccess: ResolveTenantAccessUseCase,
): Promise<void> {
  const resolveTenant = createResolveTenantPreHandler(resolveTenantAccess);
  const requireRead = createRequirePermissionPreHandler(Permissions.SECURITY_READ);
  const requireManage = createRequirePermissionPreHandler(Permissions.SECURITY_MANAGE);
  const tenantAuth = [authenticate, resolveTenant];
  const org = '/api/organizations/:organizationId/security';

  app.get(`${org}/policy`, { preHandler: [...tenantAuth, requireRead] }, async (request, reply) => {
    const result = await useCases.getPolicy.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
    });
    return reply.status(200).send(result);
  });

  app.put(`${org}/policy`, { preHandler: [...tenantAuth, requireManage] }, async (request, reply) => {
    const body = parseBody(updatePolicyBodySchema, request.body);
    const result = await useCases.updatePolicy.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      ...body,
      security: securityContext(request),
      correlationId: request.requestContext.correlationId,
    });
    return reply.status(200).send(result);
  });

  app.get(`${org}/ip-allowlist`, { preHandler: [...tenantAuth, requireRead] }, async (request, reply) => {
    const result = await useCases.listIpAllowlist.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
    });
    return reply.status(200).send(result);
  });

  app.post(`${org}/ip-allowlist`, { preHandler: [...tenantAuth, requireManage] }, async (request, reply) => {
    const body = parseBody(addIpAllowlistBodySchema, request.body);
    const result = await useCases.addIpAllowlist.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      cidr: body.cidr,
      label: body.label,
      security: securityContext(request),
      correlationId: request.requestContext.correlationId,
    });
    return reply.status(201).send(result);
  });

  app.delete(
    `${org}/ip-allowlist/:entryId`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const result = await useCases.removeIpAllowlist.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        entryId: routeParam(request, 'entryId'),
        security: securityContext(request),
        correlationId: request.requestContext.correlationId,
      });
      return reply.status(200).send(result);
    },
  );

  app.get(`${org}/secrets`, { preHandler: [...tenantAuth, requireRead] }, async (request, reply) => {
    const result = await useCases.listSecrets.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
    });
    return reply.status(200).send(result);
  });

  app.post(`${org}/secrets`, { preHandler: [...tenantAuth, requireManage] }, async (request, reply) => {
    const body = parseBody(createSecretBodySchema, request.body);
    const result = await useCases.createSecret.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      name: body.name,
      purpose: body.purpose,
      plaintext: body.plaintext,
      security: securityContext(request),
      correlationId: request.requestContext.correlationId,
    });
    return reply.status(201).send(result);
  });

  app.get(`${org}/secrets/:secretId`, { preHandler: [...tenantAuth, requireRead] }, async (request, reply) => {
    const result = await useCases.getSecret.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      secretId: routeParam(request, 'secretId'),
    });
    return reply.status(200).send(result);
  });

  app.post(
    `${org}/secrets/:secretId/reveal`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const result = await useCases.revealSecret.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        secretId: routeParam(request, 'secretId'),
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    `${org}/secrets/:secretId/rotate`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const body = parseBody(rotateSecretBodySchema, request.body);
      const result = await useCases.rotateSecret.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        secretId: routeParam(request, 'secretId'),
        plaintext: body.plaintext,
        security: securityContext(request),
        correlationId: request.requestContext.correlationId,
      });
      return reply.status(200).send(result);
    },
  );

  app.delete(
    `${org}/secrets/:secretId`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const result = await useCases.revokeSecret.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        secretId: routeParam(request, 'secretId'),
        security: securityContext(request),
        correlationId: request.requestContext.correlationId,
      });
      return reply.status(200).send(result);
    },
  );

  app.post(`${org}/encrypt`, { preHandler: [...tenantAuth, requireManage] }, async (request, reply) => {
    const body = parseBody(encryptBodySchema, request.body);
    const result = await useCases.encrypt.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      plaintext: body.plaintext,
      security: securityContext(request),
    });
    return reply.status(200).send(result);
  });

  app.post(`${org}/decrypt`, { preHandler: [...tenantAuth, requireManage] }, async (request, reply) => {
    const body = parseBody(decryptBodySchema, request.body);
    const result = await useCases.decrypt.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      algorithm: body.algorithm,
      keyVersion: body.keyVersion,
      ciphertext: body.ciphertext,
      nonce: body.nonce,
      security: securityContext(request),
    });
    return reply.status(200).send(result);
  });

  app.get(`${org}/audit-logs`, { preHandler: [...tenantAuth, requireRead] }, async (request, reply) => {
    const query = parseBody(auditLogQuerySchema, request.query);
    const result = await useCases.listAuditLogs.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      page: { page: query.page, pageSize: query.pageSize },
      action: query.action,
      outcome: query.outcome,
      resourceType: query.resourceType,
    });
    return reply.status(200).send(result);
  });

  app.get(`${org}/rate-limits`, { preHandler: [...tenantAuth, requireRead] }, async (request, reply) => {
    const result = await useCases.getRateLimits.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      ipAddress: request.ip,
    });
    return reply.status(200).send(result);
  });
}

function requireUserId(request: FastifyRequest): string {
  if (!request.auth) {
    throw new UnauthorizedError();
  }
  return request.auth.userId;
}

function requireTenantId(request: FastifyRequest): string {
  const tenantId = request.tenantAccess?.tenantId ?? request.requestContext.tenantId;
  if (!tenantId) {
    throw new UnauthorizedError('Select an organization to continue');
  }
  return tenantId;
}

function routeParam(request: FastifyRequest, key: string): string {
  const params = request.params as Record<string, unknown>;
  const value = params[key];
  return typeof value === 'string' ? value : '';
}

function securityContext(request: FastifyRequest): RequestSecurityContext {
  const userAgentHeader = request.headers['user-agent'];
  return {
    ipAddress: request.ip,
    userAgent: typeof userAgentHeader === 'string' ? userAgentHeader : undefined,
    requestId: request.requestContext.requestId,
    correlationId: request.requestContext.correlationId,
  };
}
