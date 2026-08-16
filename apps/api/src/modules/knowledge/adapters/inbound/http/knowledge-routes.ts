import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  createRequirePermissionPreHandler,
  createResolveTenantPreHandler,
  Permissions,
  type ResolveTenantAccessUseCase,
} from '../../../../organizations/index.js';
import type { RequestSecurityContext } from '../../../application/dtos.js';
import type { DeleteKnowledgeDocumentUseCase } from '../../../application/use-cases/delete-knowledge-document-use-case.js';
import type { DeleteKnowledgeSourceUseCase } from '../../../application/use-cases/delete-knowledge-source-use-case.js';
import type { ListKnowledgeDocumentsUseCase } from '../../../application/use-cases/list-knowledge-documents-use-case.js';
import type { ListKnowledgeSourcesUseCase } from '../../../application/use-cases/list-knowledge-sources-use-case.js';
import type { RegisterKnowledgeDocumentUseCase } from '../../../application/use-cases/register-knowledge-document-use-case.js';
import type { RegisterKnowledgeSourceUseCase } from '../../../application/use-cases/register-knowledge-source-use-case.js';
import type { ReindexKnowledgeDocumentUseCase } from '../../../application/use-cases/reindex-knowledge-document-use-case.js';
import type { RunRagPlaygroundUseCase } from '../../../application/use-cases/run-rag-playground-use-case.js';
import type { UploadKnowledgeDocumentUseCase } from '../../../application/use-cases/upload-knowledge-document-use-case.js';
import { UnauthorizedError } from '../../../domain/errors.js';
import {
  ragPlaygroundBodySchema,
  registerKnowledgeDocumentBodySchema,
  registerKnowledgeSourceBodySchema,
  uploadKnowledgeDocumentFieldsSchema,
} from './knowledge-schemas.js';
import { parseBody } from './parse-body.js';
import { readKnowledgeDocumentUpload } from './read-knowledge-document-upload.js';
import {
  registerKnowledgeArticleRoutes,
  type KnowledgeArticleHttpUseCases,
} from './knowledge-article-routes.js';

export type KnowledgeHttpUseCases = {
  readonly registerKnowledgeSource: RegisterKnowledgeSourceUseCase;
  readonly listKnowledgeSources: ListKnowledgeSourcesUseCase;
  readonly deleteKnowledgeSource: DeleteKnowledgeSourceUseCase;
  readonly registerKnowledgeDocument: RegisterKnowledgeDocumentUseCase;
  readonly uploadKnowledgeDocument: UploadKnowledgeDocumentUseCase;
  readonly listKnowledgeDocuments: ListKnowledgeDocumentsUseCase;
  readonly reindexKnowledgeDocument: ReindexKnowledgeDocumentUseCase;
  readonly deleteKnowledgeDocument: DeleteKnowledgeDocumentUseCase;
  readonly runRagPlayground: RunRagPlaygroundUseCase;
} & KnowledgeArticleHttpUseCases;

export type AuthenticatePreHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

export async function registerKnowledgeRoutes(
  app: FastifyInstance,
  useCases: KnowledgeHttpUseCases,
  authenticate: AuthenticatePreHandler,
  resolveTenantAccess: ResolveTenantAccessUseCase,
): Promise<void> {
  const resolveTenant = createResolveTenantPreHandler(resolveTenantAccess);
  const requireRead = createRequirePermissionPreHandler(Permissions.ORGANIZATION_READ);
  const requireManage = createRequirePermissionPreHandler(Permissions.KNOWLEDGE_MANAGE);
  const tenantAuth = [authenticate, resolveTenant];

  app.get(
    '/api/organizations/:organizationId/knowledge/sources',
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const result = await useCases.listKnowledgeSources.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    '/api/organizations/:organizationId/knowledge/sources',
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const body = parseBody(registerKnowledgeSourceBodySchema, request.body);
      const result = await useCases.registerKnowledgeSource.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        type: body.type,
        name: body.name,
        url: body.url,
        description: body.description,
        security: securityContext(request),
      });
      return reply.status(201).send(result);
    },
  );

  app.delete(
    '/api/organizations/:organizationId/knowledge/sources/:sourceId',
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      await useCases.deleteKnowledgeSource.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        sourceId: routeParam(request, 'sourceId'),
        security: securityContext(request),
      });
      return reply.status(204).send();
    },
  );

  app.get(
    '/api/organizations/:organizationId/knowledge/documents',
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const result = await useCases.listKnowledgeDocuments.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    '/api/organizations/:organizationId/knowledge/documents',
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const body = parseBody(registerKnowledgeDocumentBodySchema, request.body);
      const result = await useCases.registerKnowledgeDocument.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        kind: body.kind,
        title: body.title,
        url: body.url,
        articleText: body.articleText,
        sourceId: body.sourceId,
        security: securityContext(request),
      });
      return reply.status(201).send(result);
    },
  );

  app.post(
    '/api/organizations/:organizationId/knowledge/documents/upload',
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const upload = await readKnowledgeDocumentUpload(request);
      const fields = parseBody(uploadKnowledgeDocumentFieldsSchema, {
        title: upload.title,
        sourceId: upload.sourceId,
      });
      const result = await useCases.uploadKnowledgeDocument.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        title: fields.title,
        fileName: upload.fileName,
        contentType: upload.contentType,
        bytes: upload.bytes,
        sourceId: fields.sourceId,
        security: securityContext(request),
      });
      return reply.status(201).send(result);
    },
  );

  app.post(
    '/api/organizations/:organizationId/knowledge/documents/:documentId/reindex',
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const result = await useCases.reindexKnowledgeDocument.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        documentId: routeParam(request, 'documentId'),
        security: securityContext(request),
      });
      return reply.status(202).send(result);
    },
  );

  app.delete(
    '/api/organizations/:organizationId/knowledge/documents/:documentId',
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      await useCases.deleteKnowledgeDocument.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        documentId: routeParam(request, 'documentId'),
        security: securityContext(request),
      });
      return reply.status(204).send();
    },
  );

  app.post(
    '/api/organizations/:organizationId/knowledge/playground',
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const body = parseBody(ragPlaygroundBodySchema, request.body);
      const result = await useCases.runRagPlayground.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        query: body.query,
        topK: body.topK,
        generate: body.generate,
        documentId: body.documentId,
        filters: body.filters,
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    },
  );

  await registerKnowledgeArticleRoutes(app, useCases, authenticate, resolveTenantAccess);
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
