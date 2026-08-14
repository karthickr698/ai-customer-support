import type { OrganizationAuditLogListResponse } from '@ai-customer-support/contracts';
import type { PageRequest } from '@ai-customer-support/shared';
import { MembershipPolicy } from '../../domain/membership-policy.js';
import { Permissions } from '../../domain/permissions.js';
import { toAuditLogDto } from '../dtos.js';
import type { LoadTenantMembershipService } from '../load-tenant-membership-service.js';
import type { OrganizationAuditLogPort } from '../ports/organization-audit-log-port.js';

export class ListOrganizationAuditLogsUseCase {
  constructor(
    private readonly tenantMemberships: LoadTenantMembershipService,
    private readonly auditLog: OrganizationAuditLogPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly page: PageRequest;
  }): Promise<OrganizationAuditLogListResponse> {
    const { membership } = await this.tenantMemberships.execute(input.tenantId, input.actorId);
    MembershipPolicy.assertPermission(membership.role, Permissions.ORGANIZATION_AUDIT_VIEW);

    const result = await this.auditLog.list(membership.organizationId, input.page);
    return {
      items: result.items.map(toAuditLogDto),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }
}
