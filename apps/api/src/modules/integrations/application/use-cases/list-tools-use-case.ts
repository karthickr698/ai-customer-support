import type { ToolDefinitionListResponse } from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { IntegrationPolicy } from '../../domain/integration-policy.js';
import { TOOL_CATALOG } from '../../domain/tool-catalog.js';
import type { TenantAccessPort } from '../ports.js';

export class ListToolsUseCase {
  constructor(private readonly tenantAccess: TenantAccessPort) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
  }): Promise<ToolDefinitionListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertPermission(actor.permissions, Permissions.ORGANIZATION_READ);
    return { items: TOOL_CATALOG };
  }
}
