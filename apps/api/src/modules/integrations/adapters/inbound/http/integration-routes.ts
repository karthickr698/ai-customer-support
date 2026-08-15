import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  createRequirePermissionPreHandler,
  createResolveTenantPreHandler,
  Permissions,
  type ResolveTenantAccessUseCase,
} from '../../../../organizations/index.js';
import type { RequestSecurityContext } from '../../../application/dtos.js';
import type {
  ApplyToolResultsUseCase,
  ProposeToolCallsUseCase,
} from '../../../application/use-cases/ai-tool-bridge-use-cases.js';
import type {
  ListIntegrationCredentialsUseCase,
  RevokeIntegrationCredentialUseCase,
  UpsertIntegrationCredentialUseCase,
} from '../../../application/use-cases/credential-use-cases.js';
import type { ExecuteToolCallUseCase } from '../../../application/use-cases/execute-tool-call-use-case.js';
import type { ListToolInvocationsUseCase } from '../../../application/use-cases/list-tool-invocations-use-case.js';
import type { ListToolsUseCase } from '../../../application/use-cases/list-tools-use-case.js';
import type {
  CompleteOAuthConnectorUseCase,
  DisconnectOAuthConnectorUseCase,
  ListOAuthConnectorsUseCase,
  StartOAuthConnectorUseCase,
  UpsertOAuthConnectorUseCase,
} from '../../../application/use-cases/oauth-connector-use-cases.js';
import { UnauthorizedError } from '../../../domain/errors.js';
import {
  applyToolResultsBodySchema,
  completeOAuthBodySchema,
  executeToolCallBodySchema,
  invocationQuerySchema,
  proposeToolCallsBodySchema,
  upsertCredentialBodySchema,
  upsertOAuthConnectorBodySchema,
} from './integration-schemas.js';
import { parseBody } from './parse-body.js';

export type IntegrationHttpUseCases = {
  readonly listTools: ListToolsUseCase;
  readonly executeToolCall: ExecuteToolCallUseCase;
  readonly listInvocations: ListToolInvocationsUseCase;
  readonly proposeToolCalls: ProposeToolCallsUseCase;
  readonly applyToolResults: ApplyToolResultsUseCase;
  readonly upsertCredential: UpsertIntegrationCredentialUseCase;
  readonly listCredentials: ListIntegrationCredentialsUseCase;
  readonly revokeCredential: RevokeIntegrationCredentialUseCase;
  readonly upsertOAuthConnector: UpsertOAuthConnectorUseCase;
  readonly listOAuthConnectors: ListOAuthConnectorsUseCase;
  readonly startOAuthConnector: StartOAuthConnectorUseCase;
  readonly completeOAuthConnector: CompleteOAuthConnectorUseCase;
  readonly disconnectOAuthConnector: DisconnectOAuthConnectorUseCase;
};

export type AuthenticatePreHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

export async function registerIntegrationRoutes(
  app: FastifyInstance,
  useCases: IntegrationHttpUseCases,
  authenticate: AuthenticatePreHandler,
  resolveTenantAccess: ResolveTenantAccessUseCase,
  options?: { readonly prefixes?: readonly string[] },
): Promise<void> {
  const resolveTenant = createResolveTenantPreHandler(resolveTenantAccess);
  const requireRead = createRequirePermissionPreHandler(Permissions.ORGANIZATION_READ);
  const requireWrite = createRequirePermissionPreHandler(Permissions.CONVERSATION_WRITE);
  const requireManage = createRequirePermissionPreHandler(Permissions.INTEGRATION_MANAGE);
  const tenantAuth = [authenticate, resolveTenant];
  const prefixes = options?.prefixes ?? ['/api'];

  for (const prefix of prefixes) {
    const org = `${prefix}/organizations/:organizationId`;

  app.get(
    `${org}/tools`,
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const result = await useCases.listTools.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    `${org}/tools/calls`,
    { preHandler: tenantAuth },
    async (request, reply) => {
      const body = parseBody(executeToolCallBodySchema, request.body);
      const result = await useCases.executeToolCall.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        name: body.name,
        arguments: body.arguments,
        conversationId: body.conversationId,
        actorType: body.actorType,
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.get(
    `${org}/tools/invocations`,
    { preHandler: tenantAuth },
    async (request, reply) => {
      const query = parseBody(invocationQuerySchema, request.query);
      const result = await useCases.listInvocations.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        page: { page: query.page, pageSize: query.pageSize },
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    `${org}/tools/propose`,
    { preHandler: [...tenantAuth, requireWrite] },
    async (request, reply) => {
      const body = parseBody(proposeToolCallsBodySchema, request.body);
      const result = await useCases.proposeToolCalls.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        requestId: request.requestContext.requestId,
        correlationId: request.requestContext.correlationId,
        traceId: request.requestContext.traceId,
        spanId: request.requestContext.spanId,
        body,
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    `${org}/tools/apply-results`,
    { preHandler: [...tenantAuth, requireWrite] },
    async (request, reply) => {
      const body = parseBody(applyToolResultsBodySchema, request.body);
      const result = await useCases.applyToolResults.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        requestId: request.requestContext.requestId,
        correlationId: request.requestContext.correlationId,
        traceId: request.requestContext.traceId,
        spanId: request.requestContext.spanId,
        body,
      });
      return reply.status(200).send(result);
    },
  );

  app.get(
    `${org}/integrations/credentials`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const result = await useCases.listCredentials.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.put(
    `${org}/integrations/credentials`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const body = parseBody(upsertCredentialBodySchema, request.body);
      const result = await useCases.upsertCredential.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        toolName: body.toolName,
        name: body.name,
        kind: body.kind,
        secret: body.secret,
        baseUrl: body.baseUrl,
        headerName: body.headerName,
        provider: body.provider,
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.delete(
    `${org}/integrations/credentials/:credentialId`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      await useCases.revokeCredential.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        credentialId: routeParam(request, 'credentialId'),
        security: securityContext(request),
      });
      return reply.status(204).send();
    },
  );

  app.get(
    `${org}/integrations/oauth`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const result = await useCases.listOAuthConnectors.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.put(
    `${org}/integrations/oauth`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const body = parseBody(upsertOAuthConnectorBodySchema, request.body);
      const result = await useCases.upsertOAuthConnector.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        provider: body.provider,
        name: body.name,
        clientId: body.clientId,
        clientSecret: body.clientSecret,
        authorizationUrl: body.authorizationUrl,
        tokenUrl: body.tokenUrl,
        scopes: body.scopes,
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    `${org}/integrations/oauth/:connectorId/authorize`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const result = await useCases.startOAuthConnector.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        connectorId: routeParam(request, 'connectorId'),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    `${org}/integrations/oauth/:connectorId/complete`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const body = parseBody(completeOAuthBodySchema, request.body);
      const result = await useCases.completeOAuthConnector.execute({
        code: body.code,
        state: body.state,
        tenantId: requireTenantId(request),
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.delete(
    `${org}/integrations/oauth/:connectorId`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      await useCases.disconnectOAuthConnector.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        connectorId: routeParam(request, 'connectorId'),
        security: securityContext(request),
      });
      return reply.status(204).send();
    },
  );

  app.get(`${prefix}/integrations/oauth/callback`, async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const code = typeof query.code === 'string' ? query.code : '';
    const state = typeof query.state === 'string' ? query.state : '';
    const body = parseBody(completeOAuthBodySchema, { code, state });
    const result = await useCases.completeOAuthConnector.execute({
      code: body.code,
      state: body.state,
      security: securityContext(request),
    });
    return reply.status(200).send(result);
  });
  }
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
