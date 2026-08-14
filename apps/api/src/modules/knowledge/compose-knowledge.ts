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
import { PostgresKnowledgeDocumentRepository } from './adapters/outbound/persistence/postgres-knowledge-document-repository.js';
import { PostgresKnowledgeSourceRepository } from './adapters/outbound/persistence/postgres-knowledge-source-repository.js';
import { LocalKnowledgeDocumentStorageAdapter } from './adapters/outbound/storage/local-knowledge-document-storage-adapter.js';
import { KnowledgeSourceQuery } from './application/knowledge-source-query.js';
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
  const storage = new LocalKnowledgeDocumentStorageAdapter(input.knowledgeStorageDir);
  const clock = new SystemClock();
  const tenantAccess = new OrganizationsTenantAccessAdapter(input.resolveTenantAccess);
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
        },
        input.authenticate,
        input.resolveTenantAccess,
      );
    },
  };
}
