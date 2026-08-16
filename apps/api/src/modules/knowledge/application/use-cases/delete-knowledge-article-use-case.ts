import type { EventBus } from '@ai-customer-support/shared';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { KnowledgeArticleDeletedEvent } from '../../domain/events.js';
import { KnowledgeArticleNotFoundError } from '../../domain/errors.js';
import { createKnowledgeArticleId } from '../../domain/knowledge-article-id.js';
import { KnowledgePolicy } from '../../domain/knowledge-policy.js';
import type { RequestSecurityContext } from '../dtos.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { KnowledgeArticleRepository } from '../ports/knowledge-article-repository.js';
import type { TenantAccessPort } from '../ports/tenant-access-port.js';
import type { SyncPublishedArticleIndex } from '../sync-published-article-index.js';

export class DeleteKnowledgeArticleUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly articles: KnowledgeArticleRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly publishedIndex: SyncPublishedArticleIndex,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly articleId: string;
    readonly security: RequestSecurityContext;
  }): Promise<void> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    KnowledgePolicy.assertPermission(actor.permissions, Permissions.KNOWLEDGE_MANAGE);
    const article = await this.articles.findById(actor.tenantId, createKnowledgeArticleId(input.articleId));
    if (!article) {
      throw new KnowledgeArticleNotFoundError();
    }
    const now = this.clock.now();
    await this.publishedIndex.remove({
      article,
      actorId: actor.actorId,
      now,
      security: input.security,
    });
    await this.articles.delete(actor.tenantId, article.id);
    await this.eventBus.publish(
      new KnowledgeArticleDeletedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        article.id,
        actor.actorId,
        input.security.correlationId,
      ),
    );
  }
}
