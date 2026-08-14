import type { EventBus } from '@ai-customer-support/shared';
import type { QueuePort } from '../../../../shared/application/ports/queue-port.js';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { KnowledgeDocumentNotFoundError } from '../../domain/errors.js';
import { createKnowledgeDocumentId } from '../../domain/knowledge-document-id.js';
import { KnowledgePolicy } from '../../domain/knowledge-policy.js';
import { toKnowledgeDocumentDto, type RequestSecurityContext } from '../dtos.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { KnowledgeDocumentRepository } from '../ports/knowledge-document-repository.js';
import type { TenantAccessPort } from '../ports/tenant-access-port.js';
import { publishAndEnqueue } from './register-knowledge-document-use-case.js';

export class ReindexKnowledgeDocumentUseCase {
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
    readonly documentId: string;
    readonly security: RequestSecurityContext;
  }) {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    KnowledgePolicy.assertPermission(actor.permissions, Permissions.KNOWLEDGE_MANAGE);

    const document = await this.documents.findById(actor.tenantId, createKnowledgeDocumentId(input.documentId));
    if (!document) {
      throw new KnowledgeDocumentNotFoundError();
    }

    const now = this.clock.now();
    document.startReindex(now);
    await this.documents.save(document);
    await publishAndEnqueue(this.eventBus, this.queue, {
      document,
      actorId: actor.actorId,
      now,
      replacePreviousVersion: true,
      security: input.security,
    });
    return { document: toKnowledgeDocumentDto(document) };
  }
}
