import { createHash } from 'node:crypto';
import type { EventBus } from '@ai-customer-support/shared';
import type { QueuePort } from '../../../../shared/application/ports/queue-port.js';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { KnowledgeDocument } from '../../domain/knowledge-document.js';
import { KnowledgePolicy } from '../../domain/knowledge-policy.js';
import { InvalidKnowledgeDocumentError, TooManyKnowledgeDocumentsError } from '../../domain/errors.js';
import {
  kindFromFile,
  MAX_KNOWLEDGE_DOCUMENT_BYTES,
  MAX_KNOWLEDGE_DOCUMENTS_PER_TENANT,
} from '../../domain/knowledge-document-kind.js';
import { createKnowledgeDocumentId } from '../../domain/knowledge-document-id.js';
import { toKnowledgeDocumentDto, type RequestSecurityContext } from '../dtos.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { KnowledgeDocumentRepository } from '../ports/knowledge-document-repository.js';
import type { KnowledgeDocumentStoragePort } from '../ports/knowledge-document-storage-port.js';
import type { TenantAccessPort } from '../ports/tenant-access-port.js';
import { publishAndEnqueue } from './register-knowledge-document-use-case.js';

export class UploadKnowledgeDocumentUseCase {
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
    readonly title?: string;
    readonly fileName: string;
    readonly contentType: string;
    readonly bytes: Buffer;
    readonly sourceId?: string;
    readonly security: RequestSecurityContext;
  }) {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    KnowledgePolicy.assertPermission(actor.permissions, Permissions.KNOWLEDGE_MANAGE);

    if (input.bytes.byteLength > MAX_KNOWLEDGE_DOCUMENT_BYTES) {
      throw new InvalidKnowledgeDocumentError('The document is too large');
    }

    const count = await this.documents.countByTenant(actor.tenantId);
    if (count >= MAX_KNOWLEDGE_DOCUMENTS_PER_TENANT) {
      throw new TooManyKnowledgeDocumentsError();
    }

    const kind = kindFromFile(input.fileName, input.contentType);
    const now = this.clock.now();
    const id = createKnowledgeDocumentId();
    const storageKey = await this.storage.save({
      tenantId: actor.tenantId,
      documentId: id,
      bytes: input.bytes,
    });
    const document = KnowledgeDocument.create({
      id,
      organizationId: actor.tenantId,
      kind,
      title: input.title?.trim() || titleFromFileName(input.fileName),
      mediaType: input.contentType,
      fileName: input.fileName,
      storageKey,
      sourceId: input.sourceId,
      checksum: createHash('sha256').update(input.bytes).digest('hex'),
      byteSize: input.bytes.byteLength,
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

function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').trim();
  return base.length > 0 ? base : 'Untitled document';
}
