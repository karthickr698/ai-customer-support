import type { RagPlaygroundRequest, RagPlaygroundResponse } from '@ai-customer-support/contracts';
import type { AIServicePort } from '../../../ai/application/ports/ai-service-port.js';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { KnowledgePolicy } from '../../domain/knowledge-policy.js';
import type { RequestSecurityContext } from '../dtos.js';
import type { TenantAccessPort } from '../ports/tenant-access-port.js';

export class RunRagPlaygroundUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly aiService: AIServicePort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly query: string;
    readonly topK?: number;
    readonly generate?: boolean;
    readonly documentId?: string;
    readonly filters?: RagPlaygroundRequest['filters'];
    readonly security: RequestSecurityContext;
  }): Promise<RagPlaygroundResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    KnowledgePolicy.assertPermission(actor.permissions, Permissions.KNOWLEDGE_MANAGE);

    return this.aiService.runRagPlayground(
      {
        tenantId: actor.tenantId,
        requestId: input.security.requestId,
        correlationId: input.security.correlationId ?? input.security.requestId,
      },
      {
        query: input.query,
        topK: input.topK,
        generate: input.generate,
        documentId: input.documentId,
        filters: input.filters,
      },
    );
  }
}
