import type { EventBus } from '@ai-customer-support/shared';
import type { QueuePort } from '../../../../shared/application/ports/queue-port.js';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { KnowledgeDocumentRemovedEvent } from '../../domain/events.js';
import { KnowledgeDocumentNotFoundError } from '../../domain/errors.js';
import { createKnowledgeDocumentId } from '../../domain/knowledge-document-id.js';
import { KnowledgePolicy } from '../../domain/knowledge-policy.js';
import { KNOWLEDGE_DOCUMENT_DELETE_INDEX_QUEUE } from '../knowledge-queues.js';
import type { RequestSecurityContext } from '../dtos.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { KnowledgeDocumentRepository } from '../ports/knowledge-document-repository.js';
import type { KnowledgeDocumentStoragePort } from '../ports/knowledge-document-storage-port.js';
import type { TenantAccessPort } from '../ports/tenant-access-port.js';

export class DeleteKnowledgeDocumentUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly documents: KnowledgeDocumentRepository,
    private readonly storage: KnowledgeDocumentStoragePort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly queue: QueuePort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly documentId: string;
    readonly security: RequestSecurityContext;
  }): Promise<void> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    KnowledgePolicy.assertPermission(actor.permissions, Permissions.KNOWLEDGE_MANAGE);

    const documentId = createKnowledgeDocumentId(input.documentId);
    const existing = await this.documents.findById(actor.tenantId, documentId);
    if (!existing) {
      throw new KnowledgeDocumentNotFoundError();
    }

    if (existing.storageKey) {
      await this.storage.delete(existing.storageKey);
    }
    await this.documents.delete(actor.tenantId, documentId);
    await this.eventBus.publish(
      new KnowledgeDocumentRemovedEvent(
        crypto.randomUUID(),
        this.clock.now(),
        actor.tenantId,
        existing.id,
        actor.actorId,
        input.security.correlationId,
      ),
    );
    await this.queue.enqueue(KNOWLEDGE_DOCUMENT_DELETE_INDEX_QUEUE, {
      tenantId: actor.tenantId,
      documentId: existing.id,
      requestId: input.security.requestId,
      correlationId: input.security.correlationId ?? input.security.requestId,
    });
  }
}
