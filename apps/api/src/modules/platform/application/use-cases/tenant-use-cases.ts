import type { EventBus } from '@ai-customer-support/shared';
import type { PlatformTenantListResponse, PlatformTenantResponse } from '@ai-customer-support/contracts';
import { PlatformTenantNotFoundError } from '../../domain/errors.js';
import { PlatformTenantStatusChangedEvent } from '../../domain/events.js';
import { OperationalAuditEvent } from '../../domain/operational-audit-event.js';
import { assertPlatformPermission, permissionsForPlatformRole, PlatformPermissions } from '../../domain/permissions.js';
import { toTenantDto, type RequestSecurityContext } from '../dtos.js';
import type { LoadPlatformActorService } from './operator-use-cases.js';
import type {
  ClockPort,
  OperationalAuditRepository,
  TenantDirectoryPort,
  TenantListFilter,
} from '../ports.js';

export class ListPlatformTenantsUseCase {
  constructor(
    private readonly actors: LoadPlatformActorService,
    private readonly tenants: TenantDirectoryPort,
  ) {}

  async execute(input: {
    readonly actorId: string;
    readonly page: { readonly page: number; readonly pageSize: number };
    readonly status?: 'active' | 'disabled';
    readonly query?: string;
  }): Promise<PlatformTenantListResponse> {
    const actor = await this.actors.execute(input.actorId);
    assertPlatformPermission(permissionsForPlatformRole(actor.role), PlatformPermissions.TENANTS_READ);
    const filter: TenantListFilter = {
      status: input.status,
      query: input.query?.trim() || undefined,
    };
    const result = await this.tenants.list(input.page, filter);
    return {
      items: result.items.map(toTenantDto),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }
}

export class GetPlatformTenantUseCase {
  constructor(
    private readonly actors: LoadPlatformActorService,
    private readonly tenants: TenantDirectoryPort,
  ) {}

  async execute(input: {
    readonly actorId: string;
    readonly organizationId: string;
  }): Promise<PlatformTenantResponse> {
    const actor = await this.actors.execute(input.actorId);
    assertPlatformPermission(permissionsForPlatformRole(actor.role), PlatformPermissions.TENANTS_READ);
    const tenant = await this.tenants.findById(input.organizationId);
    if (!tenant) {
      throw new PlatformTenantNotFoundError();
    }
    return { tenant: toTenantDto(tenant) };
  }
}

export class SuspendPlatformTenantUseCase {
  constructor(
    private readonly actors: LoadPlatformActorService,
    private readonly tenants: TenantDirectoryPort,
    private readonly audit: OperationalAuditRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly actorId: string;
    readonly organizationId: string;
    readonly security?: RequestSecurityContext;
    readonly correlationId?: string;
  }): Promise<PlatformTenantResponse> {
    return changeTenantStatus(
      {
        actors: this.actors,
        tenants: this.tenants,
        audit: this.audit,
        clock: this.clock,
        eventBus: this.eventBus,
      },
      input,
      'disabled',
      'platform.tenant.suspended',
    );
  }
}

export class ActivatePlatformTenantUseCase {
  constructor(
    private readonly actors: LoadPlatformActorService,
    private readonly tenants: TenantDirectoryPort,
    private readonly audit: OperationalAuditRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly actorId: string;
    readonly organizationId: string;
    readonly security?: RequestSecurityContext;
    readonly correlationId?: string;
  }): Promise<PlatformTenantResponse> {
    return changeTenantStatus(
      {
        actors: this.actors,
        tenants: this.tenants,
        audit: this.audit,
        clock: this.clock,
        eventBus: this.eventBus,
      },
      input,
      'active',
      'platform.tenant.activated',
    );
  }
}

async function changeTenantStatus(
  deps: {
    readonly actors: LoadPlatformActorService;
    readonly tenants: TenantDirectoryPort;
    readonly audit: OperationalAuditRepository;
    readonly clock: ClockPort;
    readonly eventBus: EventBus;
  },
  input: {
    readonly actorId: string;
    readonly organizationId: string;
    readonly security?: RequestSecurityContext;
    readonly correlationId?: string;
  },
  status: 'active' | 'disabled',
  action: string,
): Promise<PlatformTenantResponse> {
  const actor = await deps.actors.execute(input.actorId);
  assertPlatformPermission(permissionsForPlatformRole(actor.role), PlatformPermissions.TENANTS_MANAGE);
  const existing = await deps.tenants.findById(input.organizationId);
  if (!existing) {
    throw new PlatformTenantNotFoundError();
  }
  const now = deps.clock.now();
  const tenant = await deps.tenants.setStatus(
    input.organizationId,
    status,
    now,
    input.correlationId ?? input.security?.correlationId,
  );
  await deps.audit.save(
    OperationalAuditEvent.create({
      actorId: actor.userId,
      action,
      resourceType: 'tenant',
      resourceId: tenant.id,
      organizationId: tenant.id,
      outcome: 'success',
      occurredAt: now,
      ipAddress: input.security?.ipAddress,
      userAgent: input.security?.userAgent,
      requestId: input.security?.requestId,
      metadata: { previousStatus: existing.status, status: tenant.status, slug: tenant.slug },
    }),
  );
  await deps.eventBus.publish(
    new PlatformTenantStatusChangedEvent(
      crypto.randomUUID(),
      now,
      tenant.id,
      tenant.status,
      input.correlationId ?? input.security?.correlationId,
    ),
  );
  return { tenant: toTenantDto(tenant) };
}
