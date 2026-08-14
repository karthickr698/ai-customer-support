import type { KnowledgeSourceBriefDto, KnowledgeSourceDto } from '@ai-customer-support/contracts';
import type { KnowledgeSourceQuery } from '../../../../knowledge/application/knowledge-source-query.js';
import type { RegisterKnowledgeSourceUseCase } from '../../../../knowledge/application/use-cases/register-knowledge-source-use-case.js';
import type {
  KnowledgeSourceDirectoryPort,
  KnowledgeSourceRegistrationPort,
} from '../../../application/ports/knowledge-source-ports.js';

export class KnowledgeSourceDirectoryAdapter implements KnowledgeSourceDirectoryPort {
  constructor(private readonly query: KnowledgeSourceQuery) {}

  listByTenant(tenantId: string): Promise<readonly KnowledgeSourceDto[]> {
    return this.query.listByTenant(tenantId);
  }
}

export class KnowledgeSourceRegistrationAdapter implements KnowledgeSourceRegistrationPort {
  constructor(private readonly registerUseCase: RegisterKnowledgeSourceUseCase) {}

  async register(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly source: KnowledgeSourceBriefDto;
    readonly requestId: string;
    readonly correlationId?: string;
    readonly ipAddress: string;
    readonly userAgent?: string;
  }): Promise<KnowledgeSourceDto> {
    const result = await this.registerUseCase.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      type: input.source.type,
      name: input.source.name,
      url: input.source.url,
      description: input.source.description,
      security: {
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        requestId: input.requestId,
        correlationId: input.correlationId,
      },
    });
    return result.source;
  }
}
