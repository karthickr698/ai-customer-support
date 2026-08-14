import type { KnowledgeSourceBriefDto, KnowledgeSourceDto } from '@ai-customer-support/contracts';

export interface KnowledgeSourceDirectoryPort {
  listByTenant(tenantId: string): Promise<readonly KnowledgeSourceDto[]>;
}

export interface KnowledgeSourceRegistrationPort {
  register(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly source: KnowledgeSourceBriefDto;
    readonly requestId: string;
    readonly correlationId?: string;
    readonly ipAddress: string;
    readonly userAgent?: string;
  }): Promise<KnowledgeSourceDto>;
}
