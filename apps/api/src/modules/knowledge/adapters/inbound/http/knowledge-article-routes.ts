import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ValidationError } from '@ai-customer-support/shared';
import {
  createRequirePermissionPreHandler,
  createResolveTenantPreHandler,
  Permissions,
  type ResolveTenantAccessUseCase,
} from '../../../../organizations/index.js';
import type { CreateKnowledgeArticleUseCase } from '../../../application/use-cases/create-knowledge-article-use-case.js';
import type { DeleteKnowledgeArticleUseCase } from '../../../application/use-cases/delete-knowledge-article-use-case.js';
import type {
  ArchiveKnowledgeArticleUseCase,
  PublishKnowledgeArticleUseCase,
  UnpublishKnowledgeArticleUseCase,
} from '../../../application/use-cases/knowledge-article-lifecycle-use-cases.js';
import type {
  ListKnowledgeArticleVersionsUseCase,
  RestoreKnowledgeArticleVersionUseCase,
} from '../../../application/use-cases/knowledge-article-version-use-cases.js';
import type {
  CreateKnowledgeCategoryUseCase,
  DeleteKnowledgeCategoryUseCase,
  ListKnowledgeCategoriesUseCase,
  UpdateKnowledgeCategoryUseCase,
} from '../../../application/use-cases/knowledge-category-use-cases.js';
import type {
  GetKnowledgeArticleUseCase,
  ListKnowledgeArticlesUseCase,
  ListKnowledgeTagsUseCase,
} from '../../../application/use-cases/list-knowledge-articles-use-case.js';
import type { UpdateKnowledgeArticleUseCase } from '../../../application/use-cases/update-knowledge-article-use-case.js';
import { UnauthorizedError } from '../../../domain/errors.js';
import type { RequestSecurityContext } from '../../../application/dtos.js';
import {
  createKnowledgeArticleBodySchema,
  createKnowledgeCategoryBodySchema,
  knowledgeArticleListQuerySchema,
  updateKnowledgeArticleBodySchema,
  updateKnowledgeCategoryBodySchema,
} from './knowledge-schemas.js';
import { parseBody } from './parse-body.js';

type AuthenticatePreHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

export type KnowledgeArticleHttpUseCases = {
  readonly listKnowledgeCategories: ListKnowledgeCategoriesUseCase;
  readonly createKnowledgeCategory: CreateKnowledgeCategoryUseCase;
  readonly updateKnowledgeCategory: UpdateKnowledgeCategoryUseCase;
  readonly deleteKnowledgeCategory: DeleteKnowledgeCategoryUseCase;
  readonly listKnowledgeArticles: ListKnowledgeArticlesUseCase;
  readonly getKnowledgeArticle: GetKnowledgeArticleUseCase;
  readonly createKnowledgeArticle: CreateKnowledgeArticleUseCase;
  readonly updateKnowledgeArticle: UpdateKnowledgeArticleUseCase;
  readonly publishKnowledgeArticle: PublishKnowledgeArticleUseCase;
  readonly unpublishKnowledgeArticle: UnpublishKnowledgeArticleUseCase;
  readonly archiveKnowledgeArticle: ArchiveKnowledgeArticleUseCase;
  readonly deleteKnowledgeArticle: DeleteKnowledgeArticleUseCase;
  readonly listKnowledgeArticleVersions: ListKnowledgeArticleVersionsUseCase;
  readonly restoreKnowledgeArticleVersion: RestoreKnowledgeArticleVersionUseCase;
  readonly listKnowledgeTags: ListKnowledgeTagsUseCase;
};

export async function registerKnowledgeArticleRoutes(
  app: FastifyInstance,
  useCases: KnowledgeArticleHttpUseCases,
  authenticate: AuthenticatePreHandler,
  resolveTenantAccess: ResolveTenantAccessUseCase,
): Promise<void> {
  const resolveTenant = createResolveTenantPreHandler(resolveTenantAccess);
  const requireRead = createRequirePermissionPreHandler(Permissions.ORGANIZATION_READ);
  const requireManage = createRequirePermissionPreHandler(Permissions.KNOWLEDGE_MANAGE);
  const tenantAuth = [authenticate, resolveTenant];

  app.get(
    '/api/organizations/:organizationId/knowledge/categories',
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const result = await useCases.listKnowledgeCategories.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    '/api/organizations/:organizationId/knowledge/categories',
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const body = parseBody(createKnowledgeCategoryBodySchema, request.body);
      const result = await useCases.createKnowledgeCategory.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        name: body.name,
        slug: body.slug,
        description: body.description,
        security: securityContext(request),
      });
      return reply.status(201).send(result);
    },
  );

  app.patch(
    '/api/organizations/:organizationId/knowledge/categories/:categoryId',
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const body = parseBody(updateKnowledgeCategoryBodySchema, request.body);
      const result = await useCases.updateKnowledgeCategory.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        categoryId: routeParam(request, 'categoryId'),
        name: body.name,
        slug: body.slug,
        description: body.description,
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.delete(
    '/api/organizations/:organizationId/knowledge/categories/:categoryId',
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      await useCases.deleteKnowledgeCategory.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        categoryId: routeParam(request, 'categoryId'),
        security: securityContext(request),
      });
      return reply.status(204).send();
    },
  );

  app.get(
    '/api/organizations/:organizationId/knowledge/tags',
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const result = await useCases.listKnowledgeTags.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.get(
    '/api/organizations/:organizationId/knowledge/articles',
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const query = parseBody(knowledgeArticleListQuerySchema, request.query);
      const result = await useCases.listKnowledgeArticles.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        page: { page: query.page, pageSize: query.pageSize },
        query: query.q,
        status: query.status,
        categoryId: query.categoryId,
        tag: query.tag,
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    '/api/organizations/:organizationId/knowledge/articles',
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const body = parseBody(createKnowledgeArticleBodySchema, request.body);
      const result = await useCases.createKnowledgeArticle.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        title: body.title,
        slug: body.slug,
        summary: body.summary,
        body: body.body,
        categoryId: body.categoryId,
        tags: body.tags,
        security: securityContext(request),
      });
      return reply.status(201).send(result);
    },
  );

  app.get(
    '/api/organizations/:organizationId/knowledge/articles/:articleId',
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const result = await useCases.getKnowledgeArticle.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        articleId: routeParam(request, 'articleId'),
      });
      return reply.status(200).send(result);
    },
  );

  app.patch(
    '/api/organizations/:organizationId/knowledge/articles/:articleId',
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const body = parseBody(updateKnowledgeArticleBodySchema, request.body);
      const result = await useCases.updateKnowledgeArticle.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        articleId: routeParam(request, 'articleId'),
        title: body.title,
        slug: body.slug,
        summary: body.summary,
        body: body.body,
        categoryId: body.categoryId,
        tags: body.tags,
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    '/api/organizations/:organizationId/knowledge/articles/:articleId/publish',
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const result = await useCases.publishKnowledgeArticle.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        articleId: routeParam(request, 'articleId'),
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    '/api/organizations/:organizationId/knowledge/articles/:articleId/unpublish',
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const result = await useCases.unpublishKnowledgeArticle.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        articleId: routeParam(request, 'articleId'),
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    '/api/organizations/:organizationId/knowledge/articles/:articleId/archive',
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const result = await useCases.archiveKnowledgeArticle.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        articleId: routeParam(request, 'articleId'),
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.delete(
    '/api/organizations/:organizationId/knowledge/articles/:articleId',
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      await useCases.deleteKnowledgeArticle.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        articleId: routeParam(request, 'articleId'),
        security: securityContext(request),
      });
      return reply.status(204).send();
    },
  );

  app.get(
    '/api/organizations/:organizationId/knowledge/articles/:articleId/versions',
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const result = await useCases.listKnowledgeArticleVersions.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        articleId: routeParam(request, 'articleId'),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    '/api/organizations/:organizationId/knowledge/articles/:articleId/versions/:version/restore',
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const version = Number(routeParam(request, 'version'));
      if (!Number.isInteger(version) || version < 1) {
        throw new ValidationError('Version must be a positive integer');
      }
      const result = await useCases.restoreKnowledgeArticleVersion.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        articleId: routeParam(request, 'articleId'),
        version,
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    },
  );
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
