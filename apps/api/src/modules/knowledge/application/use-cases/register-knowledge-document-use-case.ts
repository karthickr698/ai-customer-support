import type { EventBus } from '@ai-customer-support/shared';
import type { QueuePort } from '../../../../shared/application/ports/queue-port.js';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { KnowledgeDocumentUploadedEvent, KnowledgeDocumentProcessingRequestedEvent } from '../../domain/events.js';
import { KnowledgeDocument } from '../../domain/knowledge-document.js';
import { KnowledgePolicy } from '../../domain/knowledge-policy.js';
import { TooManyKnowledgeDocumentsError } from '../../domain/errors.js';
import { MAX_KNOWLEDGE_DOCUMENTS_PER_TENANT } from '../../domain/knowledge-document-kind.js';
import { toKnowledgeDocumentDto, type RequestSecurityContext } from '../dtos.js';
import { KNOWLEDGE_DOCUMENT_INGEST_QUEUE } from '../knowledge-queues.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { KnowledgeDocumentRepository } from '../ports/knowledge-document-repository.js';
import type { TenantAccessPort } from '../ports/tenant-access-port.js';

export class RegisterKnowledgeDocumentUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly documents: KnowledgeDocumentRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly queue: QueuePort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly kind: string;
    readonly title: string;
    readonly url?: string;
    readonly articleText?: string;
    readonly sourceId?: string;
    readonly checksum?: string;
    readonly security: RequestSecurityContext;
  }) {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    KnowledgePolicy.assertPermission(actor.permissions, Permissions.KNOWLEDGE_MANAGE);

    const count = await this.documents.countByTenant(actor.tenantId);
    if (count >= MAX_KNOWLEDGE_DOCUMENTS_PER_TENANT) {
      throw new TooManyKnowledgeDocumentsError();
    }

    const now = this.clock.now();
    const document = KnowledgeDocument.create({
      organizationId: actor.tenantId,
      kind: input.kind,
      title: input.title,
      sourceUri: input.url,
      articleText: input.articleText,
      sourceId: input.sourceId,
      checksum: input.checksum,
      createdByUserId: actor.actorId,
      now,
    });
    document.markProcessing(now);
    await this.documents.save(document);
    await publishAndEnqueue(this.eventBus, this.queue, {
      document,
      actorId: actor.actorId,
      now,
      replacePreviousVersion: false,
      security: input.security,
    });

    return { document: toKnowledgeDocumentDto(document) };
  }
}

export async function publishAndEnqueue(
  eventBus: EventBus,
  queue: QueuePort,
  input: {
    readonly document: KnowledgeDocument;
    readonly actorId: string;
    readonly now: Date;
    readonly replacePreviousVersion: boolean;
    readonly security: RequestSecurityContext;
  },
): Promise<void> {
  const snapshot = input.document.toSnapshot();
  await eventBus.publish(
    new KnowledgeDocumentUploadedEvent(
      crypto.randomUUID(),
      input.now,
      snapshot.organizationId,
      snapshot.id,
      snapshot.kind,
      snapshot.version,
      input.actorId,
      input.security.correlationId,
    ),
  );
  await eventBus.publish(
    new KnowledgeDocumentProcessingRequestedEvent(
      crypto.randomUUID(),
      input.now,
      snapshot.organizationId,
      snapshot.id,
      snapshot.version,
      input.replacePreviousVersion,
      input.actorId,
      input.security.correlationId,
    ),
  );
  await queue.enqueue(KNOWLEDGE_DOCUMENT_INGEST_QUEUE, {
    tenantId: snapshot.organizationId,
    documentId: snapshot.id,
    version: snapshot.version,
    replacePreviousVersion: input.replacePreviousVersion,
    requestId: input.security.requestId,
    correlationId: input.security.correlationId ?? input.security.requestId,
  });
}
