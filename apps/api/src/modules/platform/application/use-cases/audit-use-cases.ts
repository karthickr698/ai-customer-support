import type { PlatformAuditLogListResponse } from '@ai-customer-support/contracts';
import { parseAuditOutcome } from '../../domain/values.js';
import { assertPlatformPermission, permissionsForPlatformRole, PlatformPermissions } from '../../domain/permissions.js';
import { toAuditEventDto } from '../dtos.js';
import type { OperationalAuditRepository } from '../ports.js';
import type { LoadPlatformActorService } from './operator-use-cases.js';

export class ListOperationalAuditLogsUseCase {
  constructor(
    private readonly actors: LoadPlatformActorService,
    private readonly audit: OperationalAuditRepository,
  ) {}

  async execute(input: {
    readonly actorId: string;
    readonly page: { readonly page: number; readonly pageSize: number };
    readonly action?: string;
    readonly outcome?: string;
    readonly resourceType?: string;
    readonly organizationId?: string;
    readonly actorFilterId?: string;
  }): Promise<PlatformAuditLogListResponse> {
    const actor = await this.actors.execute(input.actorId);
    assertPlatformPermission(permissionsForPlatformRole(actor.role), PlatformPermissions.AUDIT_VIEW);
    const result = await this.audit.list(input.page, {
      action: input.action?.trim() || undefined,
      outcome: input.outcome ? parseAuditOutcome(input.outcome) : undefined,
      resourceType: input.resourceType?.trim() || undefined,
      organizationId: input.organizationId?.trim() || undefined,
      actorId: input.actorFilterId?.trim() || undefined,
    });
    return {
      items: result.items.map(toAuditEventDto),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }
}
