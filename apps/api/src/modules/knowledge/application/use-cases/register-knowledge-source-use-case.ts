import type { EventBus } from '@ai-customer-support/shared';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { KnowledgeSourceRegisteredEvent } from '../../domain/events.js';
import { KnowledgeSource } from '../../domain/knowledge-source.js';
import { KnowledgePolicy } from '../../domain/knowledge-policy.js';
import { TooManyKnowledgeSourcesError } from '../../domain/errors.js';
import { MAX_KNOWLEDGE_SOURCES_PER_TENANT } from '../../domain/knowledge-source-type.js';
import { toKnowledgeSourceDto, type RequestSecurityContext } from '../dtos.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { KnowledgeSourceRepository } from '../ports/knowledge-source-repository.js';
import type { TenantAccessPort } from '../ports/tenant-access-port.js';

export class RegisterKnowledgeSourceUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly sources: KnowledgeSourceRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly type: string;
    readonly name: string;
    readonly url?: string;
    readonly description?: string;
    readonly security: RequestSecurityContext;
  }) {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    KnowledgePolicy.assertPermission(actor.permissions, Permissions.KNOWLEDGE_MANAGE);

    const count = await this.sources.countByTenant(actor.tenantId);
    if (count >= MAX_KNOWLEDGE_SOURCES_PER_TENANT) {
      throw new TooManyKnowledgeSourcesError();
    }

    const now = this.clock.now();
    const source = KnowledgeSource.create({
      organizationId: actor.tenantId,
      type: input.type,
      name: input.name,
      url: input.url,
      description: input.description,
      createdByUserId: actor.actorId,
      now,
    });
    await this.sources.save(source);

    await this.eventBus.publish(
      new KnowledgeSourceRegisteredEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        source.id,
        source.type,
        actor.actorId,
        input.security.correlationId,
      ),
    );

    return { source: toKnowledgeSourceDto(source) };
  }
}
