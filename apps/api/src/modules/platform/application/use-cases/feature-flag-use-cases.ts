import type { EventBus } from '@ai-customer-support/shared';
import type {
  PlatformFeatureFlagEvaluationResponse,
  PlatformFeatureFlagListResponse,
  PlatformFeatureFlagResponse,
} from '@ai-customer-support/contracts';
import {
  DuplicateFeatureFlagError,
  FeatureFlagNotFoundError,
  FeatureFlagOverrideNotFoundError,
  PlatformTenantNotFoundError,
} from '../../domain/errors.js';
import { FeatureFlagChangedEvent } from '../../domain/events.js';
import { FeatureFlag } from '../../domain/feature-flag.js';
import { DEFAULT_FEATURE_FLAGS } from '../../domain/feature-flag-catalog.js';
import { evaluateFeatureFlag, FeatureFlagOverride } from '../../domain/feature-flag-override.js';
import { OperationalAuditEvent } from '../../domain/operational-audit-event.js';
import { assertPlatformPermission, permissionsForPlatformRole, PlatformPermissions } from '../../domain/permissions.js';
import { normalizeFlagKey } from '../../domain/values.js';
import { toEvaluationDto, toFlagDto, type RequestSecurityContext } from '../dtos.js';
import type { LoadPlatformActorService } from './operator-use-cases.js';
import type {
  ClockPort,
  FeatureFlagOverrideRepository,
  FeatureFlagRepository,
  OperationalAuditRepository,
  TenantDirectoryPort,
} from '../ports.js';

export class SeedFeatureFlagsUseCase {
  constructor(
    private readonly flags: FeatureFlagRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(): Promise<number> {
    const existing = await this.flags.list();
    const known = new Set(existing.map((flag) => flag.key));
    const now = this.clock.now();
    let created = 0;
    for (const definition of DEFAULT_FEATURE_FLAGS) {
      if (known.has(definition.key)) {
        continue;
      }
      await this.flags.save(
        FeatureFlag.create({
          key: definition.key,
          description: definition.description,
          enabled: definition.enabled,
          now,
        }),
      );
      created += 1;
    }
    return created;
  }
}

export class ListFeatureFlagsUseCase {
  constructor(
    private readonly actors: LoadPlatformActorService,
    private readonly flags: FeatureFlagRepository,
    private readonly overrides: FeatureFlagOverrideRepository,
  ) {}

  async execute(input: { readonly actorId: string }): Promise<PlatformFeatureFlagListResponse> {
    const actor = await this.actors.execute(input.actorId);
    assertPlatformPermission(permissionsForPlatformRole(actor.role), PlatformPermissions.FEATURE_FLAGS_READ);
    const items = await this.flags.list();
    const mapped = await Promise.all(
      items.map(async (flag) => toFlagDto(flag, await this.overrides.listByFlag(flag.id))),
    );
    return { items: mapped };
  }
}

export class GetFeatureFlagUseCase {
  constructor(
    private readonly actors: LoadPlatformActorService,
    private readonly flags: FeatureFlagRepository,
    private readonly overrides: FeatureFlagOverrideRepository,
  ) {}

  async execute(input: {
    readonly actorId: string;
    readonly key: string;
  }): Promise<PlatformFeatureFlagResponse> {
    const actor = await this.actors.execute(input.actorId);
    assertPlatformPermission(permissionsForPlatformRole(actor.role), PlatformPermissions.FEATURE_FLAGS_READ);
    const flag = await requireFlag(this.flags, input.key);
    const overrideItems = await this.overrides.listByFlag(flag.id);
    return { flag: toFlagDto(flag, overrideItems) };
  }
}

export class CreateFeatureFlagUseCase {
  constructor(
    private readonly actors: LoadPlatformActorService,
    private readonly flags: FeatureFlagRepository,
    private readonly audit: OperationalAuditRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly actorId: string;
    readonly key: string;
    readonly description?: string;
    readonly enabled?: boolean;
    readonly security?: RequestSecurityContext;
    readonly correlationId?: string;
  }): Promise<PlatformFeatureFlagResponse> {
    const actor = await this.actors.execute(input.actorId);
    assertPlatformPermission(permissionsForPlatformRole(actor.role), PlatformPermissions.FEATURE_FLAGS_MANAGE);
    const key = normalizeFlagKey(input.key);
    const existing = await this.flags.findByKey(key);
    if (existing) {
      throw new DuplicateFeatureFlagError();
    }
    const now = this.clock.now();
    const flag = FeatureFlag.create({
      key,
      description: input.description,
      enabled: input.enabled,
      createdBy: actor.userId,
      now,
    });
    await this.flags.save(flag);
    await recordFlagAudit(this.audit, {
      actorId: actor.userId,
      action: 'platform.feature_flag.created',
      flag,
      occurredAt: now,
      security: input.security,
    });
    await this.eventBus.publish(
      new FeatureFlagChangedEvent(
        crypto.randomUUID(),
        now,
        flag.key,
        'created',
        undefined,
        input.correlationId ?? input.security?.correlationId,
      ),
    );
    return { flag: toFlagDto(flag) };
  }
}

export class UpdateFeatureFlagUseCase {
  constructor(
    private readonly actors: LoadPlatformActorService,
    private readonly flags: FeatureFlagRepository,
    private readonly overrides: FeatureFlagOverrideRepository,
    private readonly audit: OperationalAuditRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly actorId: string;
    readonly key: string;
    readonly description?: string | null;
    readonly enabled?: boolean;
    readonly security?: RequestSecurityContext;
    readonly correlationId?: string;
  }): Promise<PlatformFeatureFlagResponse> {
    const actor = await this.actors.execute(input.actorId);
    assertPlatformPermission(permissionsForPlatformRole(actor.role), PlatformPermissions.FEATURE_FLAGS_MANAGE);
    const flag = await requireFlag(this.flags, input.key);
    const now = this.clock.now();
    flag.update({ description: input.description, enabled: input.enabled }, now);
    await this.flags.save(flag);
    const overrideItems = await this.overrides.listByFlag(flag.id);
    await recordFlagAudit(this.audit, {
      actorId: actor.userId,
      action: 'platform.feature_flag.updated',
      flag,
      occurredAt: now,
      security: input.security,
      metadata: { enabled: flag.enabled },
    });
    await this.eventBus.publish(
      new FeatureFlagChangedEvent(
        crypto.randomUUID(),
        now,
        flag.key,
        'updated',
        undefined,
        input.correlationId ?? input.security?.correlationId,
      ),
    );
    return { flag: toFlagDto(flag, overrideItems) };
  }
}

export class DeleteFeatureFlagUseCase {
  constructor(
    private readonly actors: LoadPlatformActorService,
    private readonly flags: FeatureFlagRepository,
    private readonly overrides: FeatureFlagOverrideRepository,
    private readonly audit: OperationalAuditRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly actorId: string;
    readonly key: string;
    readonly security?: RequestSecurityContext;
    readonly correlationId?: string;
  }): Promise<{ readonly deleted: true }> {
    const actor = await this.actors.execute(input.actorId);
    assertPlatformPermission(permissionsForPlatformRole(actor.role), PlatformPermissions.FEATURE_FLAGS_MANAGE);
    const flag = await requireFlag(this.flags, input.key);
    await this.overrides.deleteByFlag(flag.id);
    await this.flags.delete(flag.id);
    const now = this.clock.now();
    await recordFlagAudit(this.audit, {
      actorId: actor.userId,
      action: 'platform.feature_flag.deleted',
      flag,
      occurredAt: now,
      security: input.security,
    });
    await this.eventBus.publish(
      new FeatureFlagChangedEvent(
        crypto.randomUUID(),
        now,
        flag.key,
        'deleted',
        undefined,
        input.correlationId ?? input.security?.correlationId,
      ),
    );
    return { deleted: true };
  }
}

export class SetFeatureFlagOverrideUseCase {
  constructor(
    private readonly actors: LoadPlatformActorService,
    private readonly flags: FeatureFlagRepository,
    private readonly overrides: FeatureFlagOverrideRepository,
    private readonly tenants: TenantDirectoryPort,
    private readonly audit: OperationalAuditRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly actorId: string;
    readonly key: string;
    readonly organizationId: string;
    readonly enabled: boolean;
    readonly security?: RequestSecurityContext;
    readonly correlationId?: string;
  }): Promise<PlatformFeatureFlagResponse> {
    const actor = await this.actors.execute(input.actorId);
    assertPlatformPermission(permissionsForPlatformRole(actor.role), PlatformPermissions.FEATURE_FLAGS_MANAGE);
    const flag = await requireFlag(this.flags, input.key);
    const tenant = await this.tenants.findById(input.organizationId);
    if (!tenant) {
      throw new PlatformTenantNotFoundError();
    }
    const now = this.clock.now();
    const existing = await this.overrides.findByFlagAndTenant(flag.id, tenant.id);
    const override = existing
      ? existing
      : FeatureFlagOverride.create({
          flagId: flag.id,
          organizationId: tenant.id,
          enabled: input.enabled,
          createdBy: actor.userId,
          now,
        });
    if (existing) {
      override.setEnabled(input.enabled, now);
    }
    await this.overrides.save(override);
    const overrideItems = await this.overrides.listByFlag(flag.id);
    await recordFlagAudit(this.audit, {
      actorId: actor.userId,
      action: 'platform.feature_flag.override_set',
      flag,
      occurredAt: now,
      security: input.security,
      organizationId: tenant.id,
      metadata: { enabled: input.enabled },
    });
    await this.eventBus.publish(
      new FeatureFlagChangedEvent(
        crypto.randomUUID(),
        now,
        flag.key,
        'override_set',
        tenant.id,
        input.correlationId ?? input.security?.correlationId,
      ),
    );
    return { flag: toFlagDto(flag, overrideItems) };
  }
}

export class RemoveFeatureFlagOverrideUseCase {
  constructor(
    private readonly actors: LoadPlatformActorService,
    private readonly flags: FeatureFlagRepository,
    private readonly overrides: FeatureFlagOverrideRepository,
    private readonly audit: OperationalAuditRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly actorId: string;
    readonly key: string;
    readonly organizationId: string;
    readonly security?: RequestSecurityContext;
    readonly correlationId?: string;
  }): Promise<PlatformFeatureFlagResponse> {
    const actor = await this.actors.execute(input.actorId);
    assertPlatformPermission(permissionsForPlatformRole(actor.role), PlatformPermissions.FEATURE_FLAGS_MANAGE);
    const flag = await requireFlag(this.flags, input.key);
    const existing = await this.overrides.findByFlagAndTenant(flag.id, input.organizationId);
    if (!existing) {
      throw new FeatureFlagOverrideNotFoundError();
    }
    await this.overrides.delete(flag.id, input.organizationId);
    const overrideItems = await this.overrides.listByFlag(flag.id);
    const now = this.clock.now();
    await recordFlagAudit(this.audit, {
      actorId: actor.userId,
      action: 'platform.feature_flag.override_removed',
      flag,
      occurredAt: now,
      security: input.security,
      organizationId: input.organizationId,
    });
    await this.eventBus.publish(
      new FeatureFlagChangedEvent(
        crypto.randomUUID(),
        now,
        flag.key,
        'override_removed',
        input.organizationId,
        input.correlationId ?? input.security?.correlationId,
      ),
    );
    return { flag: toFlagDto(flag, overrideItems) };
  }
}

export class EvaluateFeatureFlagUseCase {
  constructor(
    private readonly actors: LoadPlatformActorService,
    private readonly flags: FeatureFlagRepository,
    private readonly overrides: FeatureFlagOverrideRepository,
  ) {}

  async execute(input: {
    readonly actorId: string;
    readonly key: string;
    readonly organizationId?: string;
  }): Promise<PlatformFeatureFlagEvaluationResponse> {
    const actor = await this.actors.execute(input.actorId);
    assertPlatformPermission(permissionsForPlatformRole(actor.role), PlatformPermissions.FEATURE_FLAGS_READ);
    const flag = await requireFlag(this.flags, input.key);
    const override = input.organizationId
      ? await this.overrides.findByFlagAndTenant(flag.id, input.organizationId)
      : null;
    return {
      evaluation: toEvaluationDto(
        evaluateFeatureFlag(flag.toSnapshot(), override?.toSnapshot(), input.organizationId),
      ),
    };
  }
}

async function requireFlag(flags: FeatureFlagRepository, key: string): Promise<FeatureFlag> {
  const flag = await flags.findByKey(normalizeFlagKey(key));
  if (!flag) {
    throw new FeatureFlagNotFoundError();
  }
  return flag;
}

async function recordFlagAudit(
  audit: OperationalAuditRepository,
  input: {
    readonly actorId: string;
    readonly action: string;
    readonly flag: FeatureFlag;
    readonly occurredAt: Date;
    readonly security?: RequestSecurityContext;
    readonly organizationId?: string;
    readonly metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await audit.save(
    OperationalAuditEvent.create({
      actorId: input.actorId,
      action: input.action,
      resourceType: 'feature_flag',
      resourceId: input.flag.id,
      organizationId: input.organizationId,
      outcome: 'success',
      occurredAt: input.occurredAt,
      ipAddress: input.security?.ipAddress,
      userAgent: input.security?.userAgent,
      requestId: input.security?.requestId,
      metadata: { key: input.flag.key, ...input.metadata },
    }),
  );
}
