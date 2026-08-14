import type { EventBus } from '@ai-customer-support/shared';
import type { QueuePort } from '../../../../shared/application/ports/queue-port.js';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { KnowledgeSourceRemovedEvent } from '../../domain/events.js';
import { KnowledgePolicy } from '../../domain/knowledge-policy.js';
import { KnowledgeSourceNotFoundError } from '../../domain/errors.js';
import { createKnowledgeSourceId } from '../../domain/knowledge-source-id.js';
import { KNOWLEDGE_DOCUMENT_DELETE_INDEX_QUEUE } from '../knowledge-queues.js';
import type { RequestSecurityContext } from '../dtos.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { KnowledgeDocumentRepository } from '../ports/knowledge-document-repository.js';
import type { KnowledgeDocumentStoragePort } from '../ports/knowledge-document-storage-port.js';
import type { KnowledgeSourceRepository } from '../ports/knowledge-source-repository.js';
import type { TenantAccessPort } from '../ports/tenant-access-port.js';

export class DeleteKnowledgeSourceUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly sources: KnowledgeSourceRepository,
    private readonly documents: KnowledgeDocumentRepository,
    private readonly storage: KnowledgeDocumentStoragePort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly queue: QueuePort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly sourceId: string;
    readonly security: RequestSecurityContext;
  }): Promise<void> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    KnowledgePolicy.assertPermission(actor.permissions, Permissions.KNOWLEDGE_MANAGE);

    const sourceId = createKnowledgeSourceId(input.sourceId);
    const existing = await this.sources.findById(actor.tenantId, sourceId);
    if (!existing) {
      throw new KnowledgeSourceNotFoundError();
    }

    const related = await this.documents.listBySource(actor.tenantId, existing.id);
    for (const document of related) {
      if (document.storageKey) {
        await this.storage.delete(document.storageKey);
      }
      await this.documents.delete(actor.tenantId, document.id);
      await this.queue.enqueue(KNOWLEDGE_DOCUMENT_DELETE_INDEX_QUEUE, {
        tenantId: actor.tenantId,
        documentId: document.id,
        requestId: input.security.requestId,
        correlationId: input.security.correlationId ?? input.security.requestId,
      });
    }

    await this.sources.delete(actor.tenantId, sourceId);
    await this.eventBus.publish(
      new KnowledgeSourceRemovedEvent(
        crypto.randomUUID(),
        this.clock.now(),
        actor.tenantId,
        existing.id,
        actor.actorId,
        input.security.correlationId,
      ),
    );
  }
}
