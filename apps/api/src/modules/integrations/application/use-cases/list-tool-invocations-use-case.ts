import type { PageRequest } from '@ai-customer-support/shared';
import type { ToolInvocationListResponse } from '@ai-customer-support/contracts';
import { IntegrationPolicy } from '../../domain/integration-policy.js';
import { toInvocationDto } from '../dtos.js';
import type { TenantAccessPort, ToolInvocationRepository } from '../ports.js';

export class ListToolInvocationsUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly invocations: ToolInvocationRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly page: PageRequest;
  }): Promise<ToolInvocationListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertCanListAudit(actor.permissions);
    const result = await this.invocations.listByTenant(actor.tenantId, input.page);
    return {
      items: result.items.map(toInvocationDto),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }
}
