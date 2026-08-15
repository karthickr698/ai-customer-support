import type { SecurityAuditLogListResponse } from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { SecurityPolicy } from '../../domain/security-policy.js';
import { parseAuditOutcome } from '../../domain/values.js';
import { toAuditEventDto } from '../dtos.js';
import type { SecurityAuditRepository, TenantAccessPort } from '../ports.js';

export class ListSecurityAuditLogsUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly audit: SecurityAuditRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly page: { readonly page: number; readonly pageSize: number };
    readonly action?: string;
    readonly outcome?: string;
    readonly resourceType?: string;
  }): Promise<SecurityAuditLogListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    SecurityPolicy.assertPermission(actor.permissions, Permissions.SECURITY_READ);
    const result = await this.audit.listByTenant(actor.tenantId, input.page, {
      action: input.action?.trim() || undefined,
      outcome: input.outcome ? parseAuditOutcome(input.outcome) : undefined,
      resourceType: input.resourceType?.trim() || undefined,
    });
    return {
      items: result.items.filter((event) => event.belongsTo(actor.tenantId)).map(toAuditEventDto),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }
}
