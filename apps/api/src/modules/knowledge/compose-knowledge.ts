import type { EventBus, Logger } from '@ai-customer-support/shared';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import type { AIServicePort } from '../ai/application/ports/ai-service-port.js';
import type { QueuePort } from '../../shared/application/ports/queue-port.js';
import type { ResolveTenantAccessUseCase } from '../organizations/application/use-cases/resolve-tenant-access-use-case.js';
import {
  registerKnowledgeRoutes,
  type AuthenticatePreHandler,
} from './adapters/inbound/http/knowledge-routes.js';
import { SystemClock } from './adapters/outbound/clock/system-clock.js';
import { OrganizationsTenantAccessAdapter } from './adapters/outbound/organizations/organizations-tenant-access-adapter.js';
import { PostgresKnowledgeArticleRepository } from './adapters/outbound/persistence/postgres-knowledge-article-repository.js';
import { PostgresKnowledgeCategoryRepository } from './adapters/outbound/persistence/postgres-knowledge-category-repository.js';
import { PostgresKnowledgeDocumentRepository } from './adapters/outbound/persistence/postgres-knowledge-document-repository.js';
import { PostgresKnowledgeSourceRepository } from './adapters/outbound/persistence/postgres-knowledge-source-repository.js';
import { LocalKnowledgeDocumentStorageAdapter } from './adapters/outbound/storage/local-knowledge-document-storage-adapter.js';
import { KnowledgeSourceQuery } from './application/knowledge-source-query.js';
import { SyncPublishedArticleIndex } from './application/sync-published-article-index.js';
import {
  KNOWLEDGE_DOCUMENT_DELETE_INDEX_QUEUE,
  KNOWLEDGE_DOCUMENT_INGEST_QUEUE,
  type KnowledgeDocumentDeleteIndexJob,
  type KnowledgeDocumentIngestJob,
} from './application/knowledge-queues.js';
import { ProcessKnowledgeDocumentIngestion } from './application/process-knowledge-document-ingestion.js';
import { RegisterDocumentFromKnowledgeSource } from './application/register-document-from-knowledge-source.js';
import { ApplyKnowledgeDocumentIngestionResultUseCase } from './application/use-cases/apply-knowledge-document-ingestion-result-use-case.js';
import { DeleteKnowledgeDocumentUseCase } from './application/use-cases/delete-knowledge-document-use-case.js';
import { DeleteKnowledgeSourceUseCase } from './application/use-cases/delete-knowledge-source-use-case.js';
import { ListKnowledgeDocumentsUseCase } from './application/use-cases/list-knowledge-documents-use-case.js';
import { ListKnowledgeSourcesUseCase } from './application/use-cases/list-knowledge-sources-use-case.js';
import { RegisterKnowledgeDocumentUseCase } from './application/use-cases/register-knowledge-document-use-case.js';
import { RegisterKnowledgeSourceUseCase } from './application/use-cases/register-knowledge-source-use-case.js';
import { ReindexKnowledgeDocumentUseCase } from './application/use-cases/reindex-knowledge-document-use-case.js';
import { UploadKnowledgeDocumentUseCase } from './application/use-cases/upload-knowledge-document-use-case.js';
import { CreateKnowledgeArticleUseCase } from './application/use-cases/create-knowledge-article-use-case.js';
import { DeleteKnowledgeArticleUseCase } from './application/use-cases/delete-knowledge-article-use-case.js';
import {
  ArchiveKnowledgeArticleUseCase,
  PublishKnowledgeArticleUseCase,
  UnpublishKnowledgeArticleUseCase,
} from './application/use-cases/knowledge-article-lifecycle-use-cases.js';
import {
  ListKnowledgeArticleVersionsUseCase,
  RestoreKnowledgeArticleVersionUseCase,
} from './application/use-cases/knowledge-article-version-use-cases.js';
import {
  CreateKnowledgeCategoryUseCase,
  DeleteKnowledgeCategoryUseCase,
  ListKnowledgeCategoriesUseCase,
  UpdateKnowledgeCategoryUseCase,
} from './application/use-cases/knowledge-category-use-cases.js';
import {
  GetKnowledgeArticleUseCase,
  ListKnowledgeArticlesUseCase,
  ListKnowledgeTagsUseCase,
} from './application/use-cases/list-knowledge-articles-use-case.js';
import { UpdateKnowledgeArticleUseCase } from './application/use-cases/update-knowledge-article-use-case.js';

export type KnowledgeModule = {
  readonly sourceQuery: KnowledgeSourceQuery;
  readonly registerKnowledgeSource: RegisterKnowledgeSourceUseCase;
  register(app: FastifyInstance): Promise<void>;
};

export function composeKnowledge(input: {
  readonly prisma: PrismaClient;
  readonly eventBus: EventBus;
  readonly queue: QueuePort;
  readonly aiService: AIServicePort;
  readonly logger: Logger;
  readonly knowledgeStorageDir: string;
  readonly authenticate: AuthenticatePreHandler;
  readonly resolveTenantAccess: ResolveTenantAccessUseCase;
}): KnowledgeModule {
  const sources = new PostgresKnowledgeSourceRepository(input.prisma);
  const documents = new PostgresKnowledgeDocumentRepository(input.prisma);
  const articles = new PostgresKnowledgeArticleRepository(input.prisma);
  const categories = new PostgresKnowledgeCategoryRepository(input.prisma);
  const storage = new LocalKnowledgeDocumentStorageAdapter(input.knowledgeStorageDir);
  const clock = new SystemClock();
  const tenantAccess = new OrganizationsTenantAccessAdapter(input.resolveTenantAccess);
  const publishedIndex = new SyncPublishedArticleIndex(documents, storage, input.eventBus, input.queue);
  const registerKnowledgeSource = new RegisterKnowledgeSourceUseCase(
    tenantAccess,
    sources,
    clock,
    input.eventBus,
  );
  const listKnowledgeSources = new ListKnowledgeSourcesUseCase(tenantAccess, sources);
  const deleteKnowledgeSource = new DeleteKnowledgeSourceUseCase(
    tenantAccess,
    sources,
    documents,
    storage,
    clock,
    input.eventBus,
    input.queue,
  );
  const registerKnowledgeDocument = new RegisterKnowledgeDocumentUseCase(
    tenantAccess,
    documents,
    clock,
    input.eventBus,
    input.queue,
  );
  const uploadKnowledgeDocument = new UploadKnowledgeDocumentUseCase(
    tenantAccess,
    documents,
    storage,
    clock,
    input.eventBus,
    input.queue,
  );
  const listKnowledgeDocuments = new ListKnowledgeDocumentsUseCase(tenantAccess, documents);
  const reindexKnowledgeDocument = new ReindexKnowledgeDocumentUseCase(
    tenantAccess,
    documents,
    clock,
    input.eventBus,
    input.queue,
  );
  const deleteKnowledgeDocument = new DeleteKnowledgeDocumentUseCase(
    tenantAccess,
    documents,
    storage,
    clock,
    input.eventBus,
    input.queue,
  );
  const applyResult = new ApplyKnowledgeDocumentIngestionResultUseCase(documents, clock, input.eventBus);
  const listKnowledgeCategories = new ListKnowledgeCategoriesUseCase(tenantAccess, categories);
  const createKnowledgeCategory = new CreateKnowledgeCategoryUseCase(tenantAccess, categories, clock);
  const updateKnowledgeCategory = new UpdateKnowledgeCategoryUseCase(tenantAccess, categories, clock);
  const deleteKnowledgeCategory = new DeleteKnowledgeCategoryUseCase(tenantAccess, categories, articles);
  const listKnowledgeArticles = new ListKnowledgeArticlesUseCase(tenantAccess, articles, categories);
  const getKnowledgeArticle = new GetKnowledgeArticleUseCase(tenantAccess, articles, categories);
  const listKnowledgeTags = new ListKnowledgeTagsUseCase(tenantAccess, articles);
  const createKnowledgeArticle = new CreateKnowledgeArticleUseCase(
    tenantAccess,
    articles,
    categories,
    clock,
    input.eventBus,
  );
  const updateKnowledgeArticle = new UpdateKnowledgeArticleUseCase(
    tenantAccess,
    articles,
    categories,
    clock,
    publishedIndex,
  );
  const publishKnowledgeArticle = new PublishKnowledgeArticleUseCase(
    tenantAccess,
    articles,
    categories,
    clock,
    input.eventBus,
    publishedIndex,
  );
  const unpublishKnowledgeArticle = new UnpublishKnowledgeArticleUseCase(
    tenantAccess,
    articles,
    categories,
    clock,
    input.eventBus,
    publishedIndex,
  );
  const archiveKnowledgeArticle = new ArchiveKnowledgeArticleUseCase(
    tenantAccess,
    articles,
    categories,
    clock,
    input.eventBus,
    publishedIndex,
  );
  const deleteKnowledgeArticle = new DeleteKnowledgeArticleUseCase(
    tenantAccess,
    articles,
    clock,
    input.eventBus,
    publishedIndex,
  );
  const listKnowledgeArticleVersions = new ListKnowledgeArticleVersionsUseCase(tenantAccess, articles);
  const restoreKnowledgeArticleVersion = new RestoreKnowledgeArticleVersionUseCase(
    tenantAccess,
    articles,
    categories,
    clock,
    publishedIndex,
  );
  const processor = new ProcessKnowledgeDocumentIngestion(
    documents,
    storage,
    input.aiService,
    applyResult,
    input.logger,
  );
  const fromSource = new RegisterDocumentFromKnowledgeSource(
    sources,
    documents,
    clock,
    input.eventBus,
    input.queue,
    input.logger,
  );

  input.queue.process<KnowledgeDocumentIngestJob>(KNOWLEDGE_DOCUMENT_INGEST_QUEUE, (job) =>
    processor.ingest(job),
  );
  input.queue.process<KnowledgeDocumentDeleteIndexJob>(KNOWLEDGE_DOCUMENT_DELETE_INDEX_QUEUE, (job) =>
    processor.deleteIndex(job),
  );
  input.eventBus.subscribe('KnowledgeSourceRegistered', (event) => fromSource.handle(event));

  return {
    sourceQuery: new KnowledgeSourceQuery(sources),
    registerKnowledgeSource,
    async register(app: FastifyInstance): Promise<void> {
      await registerKnowledgeRoutes(
        app,
        {
          registerKnowledgeSource,
          listKnowledgeSources,
          deleteKnowledgeSource,
          registerKnowledgeDocument,
          uploadKnowledgeDocument,
          listKnowledgeDocuments,
          reindexKnowledgeDocument,
          deleteKnowledgeDocument,
          listKnowledgeCategories,
          createKnowledgeCategory,
          updateKnowledgeCategory,
          deleteKnowledgeCategory,
          listKnowledgeArticles,
          getKnowledgeArticle,
          createKnowledgeArticle,
          updateKnowledgeArticle,
          publishKnowledgeArticle,
          unpublishKnowledgeArticle,
          archiveKnowledgeArticle,
          deleteKnowledgeArticle,
          listKnowledgeArticleVersions,
          restoreKnowledgeArticleVersion,
          listKnowledgeTags,
        },
        input.authenticate,
        input.resolveTenantAccess,
      );
    },
  };
}
