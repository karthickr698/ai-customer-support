import type { EventBus } from '@ai-customer-support/shared';
import type {
  PlatformMeResponse,
  PlatformOperatorListResponse,
  PlatformOperatorResponse,
  PlatformRole,
} from '@ai-customer-support/contracts';
import {
  DuplicatePlatformOperatorError,
  InsufficientPlatformPermissionError,
  PlatformBootstrapUnavailableError,
  PlatformOperatorNotFoundError,
  PlatformUserNotEligibleError,
} from '../../domain/errors.js';
import {
  PlatformOperatorGrantedEvent,
  PlatformOperatorRevokedEvent,
  PlatformOperatorRoleChangedEvent,
} from '../../domain/events.js';
import { OperationalAuditEvent } from '../../domain/operational-audit-event.js';
import { assertCanChangeRole, assertCanGrantRole, assertCanRevoke } from '../../domain/operator-policy.js';
import { assertPlatformPermission, permissionsForPlatformRole, PlatformPermissions } from '../../domain/permissions.js';
import { PlatformOperator } from '../../domain/platform-operator.js';
import { parsePlatformRole } from '../../domain/values.js';
import { toOperatorDto, type RequestSecurityContext } from '../dtos.js';
import type {
  ClockPort,
  DirectoryUser,
  OperationalAuditRepository,
  PlatformOperatorRepository,
  UserDirectoryPort,
} from '../ports.js';

export class LoadPlatformActorService {
  constructor(private readonly operators: PlatformOperatorRepository) {}

  async execute(userId: string): Promise<PlatformOperator> {
    const operator = await this.operators.findByUserId(userId);
    if (!operator || !operator.isActive) {
      throw new InsufficientPlatformPermissionError();
    }
    return operator;
  }
}

export class GetCurrentPlatformOperatorUseCase {
  constructor(
    private readonly operators: PlatformOperatorRepository,
    private readonly users: UserDirectoryPort,
  ) {}

  async execute(input: { readonly actorId: string }): Promise<PlatformMeResponse> {
    const operator = await this.operators.findByUserId(input.actorId);
    if (!operator || !operator.isActive) {
      throw new InsufficientPlatformPermissionError();
    }
    const user = await this.users.findById(operator.userId);
    const activeCount = await this.operators.countActive();
    return {
      operator: toOperatorDto(operator, user),
      bootstrapAvailable: activeCount === 0,
    };
  }
}

export class BootstrapPlatformOwnerUseCase {
  constructor(
    private readonly operators: PlatformOperatorRepository,
    private readonly users: UserDirectoryPort,
    private readonly audit: OperationalAuditRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly bootstrapEmail: string | undefined,
  ) {}

  async execute(input: {
    readonly actorId?: string;
    readonly security?: RequestSecurityContext;
    readonly correlationId?: string;
  }): Promise<PlatformOperatorResponse> {
    const activeCount = await this.operators.countActive();
    if (activeCount > 0) {
      throw new PlatformBootstrapUnavailableError('Platform operators already exist');
    }
    if (!this.bootstrapEmail) {
      throw new PlatformBootstrapUnavailableError('PLATFORM_BOOTSTRAP_EMAIL is not configured');
    }

    const user = input.actorId
      ? await this.requireEligibleUserById(input.actorId)
      : await this.requireEligibleUserByEmail(this.bootstrapEmail);

    if (user.email.toLowerCase() !== this.bootstrapEmail.toLowerCase()) {
      throw new PlatformBootstrapUnavailableError('Authenticated user does not match the bootstrap email');
    }

    const existing = await this.operators.findByUserId(user.id);
    if (existing?.isActive) {
      return { operator: toOperatorDto(existing, user) };
    }

    const now = this.clock.now();
    const operator = existing
      ? existing
      : PlatformOperator.grant({
          userId: user.id,
          role: 'owner',
          now,
          grantedByUserId: user.id,
        });
    if (existing) {
      existing.reinstate('owner', now);
    }
    await this.operators.save(operator);
    await recordAudit(this.audit, {
      actorId: user.id,
      action: 'platform.operator.bootstrapped',
      resourceType: 'platform_operator',
      resourceId: operator.id,
      occurredAt: now,
      security: input.security,
      metadata: { role: 'owner', email: user.email },
    });
    await this.eventBus.publish(
      new PlatformOperatorGrantedEvent(
        crypto.randomUUID(),
        now,
        user.id,
        'owner',
        input.correlationId ?? input.security?.correlationId,
      ),
    );
    return { operator: toOperatorDto(operator, user) };
  }

  private async requireEligibleUserById(userId: string): Promise<DirectoryUser> {
    const user = await this.users.findById(userId);
    return requireEligibleUser(user);
  }

  private async requireEligibleUserByEmail(email: string): Promise<DirectoryUser> {
    const user = await this.users.findByEmail(email);
    return requireEligibleUser(user);
  }
}

export class ListPlatformOperatorsUseCase {
  constructor(
    private readonly actors: LoadPlatformActorService,
    private readonly operators: PlatformOperatorRepository,
    private readonly users: UserDirectoryPort,
  ) {}

  async execute(input: {
    readonly actorId: string;
    readonly includeRevoked?: boolean;
  }): Promise<PlatformOperatorListResponse> {
    const actor = await this.actors.execute(input.actorId);
    assertPlatformPermission(permissionsForPlatformRole(actor.role), PlatformPermissions.OPERATORS_READ);
    const items = await this.operators.list(input.includeRevoked === true);
    const profiles = await Promise.all(items.map((item) => this.users.findById(item.userId)));
    return {
      items: items.map((item, index) => toOperatorDto(item, profiles[index])),
    };
  }
}

export class GrantPlatformOperatorUseCase {
  constructor(
    private readonly actors: LoadPlatformActorService,
    private readonly operators: PlatformOperatorRepository,
    private readonly users: UserDirectoryPort,
    private readonly audit: OperationalAuditRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly actorId: string;
    readonly email: string;
    readonly role: string;
    readonly security?: RequestSecurityContext;
    readonly correlationId?: string;
  }): Promise<PlatformOperatorResponse> {
    const actor = await this.actors.execute(input.actorId);
    assertPlatformPermission(permissionsForPlatformRole(actor.role), PlatformPermissions.OPERATORS_MANAGE);
    const role = parsePlatformRole(input.role);
    assertCanGrantRole(actor.role, role);

    const user = requireEligibleUser(await this.users.findByEmail(input.email));
    const existing = await this.operators.findByUserId(user.id);
    if (existing?.isActive) {
      throw new DuplicatePlatformOperatorError();
    }

    const now = this.clock.now();
    const operator = existing
      ? existing
      : PlatformOperator.grant({
          userId: user.id,
          role,
          now,
          grantedByUserId: actor.userId,
        });
    if (existing) {
      existing.reinstate(role, now);
    }
    await this.operators.save(operator);
    await recordAudit(this.audit, {
      actorId: actor.userId,
      action: 'platform.operator.granted',
      resourceType: 'platform_operator',
      resourceId: operator.id,
      occurredAt: now,
      security: input.security,
      metadata: { role, email: user.email, userId: user.id },
    });
    await this.eventBus.publish(
      new PlatformOperatorGrantedEvent(
        crypto.randomUUID(),
        now,
        user.id,
        role,
        input.correlationId ?? input.security?.correlationId,
      ),
    );
    return { operator: toOperatorDto(operator, user) };
  }
}

export class ChangePlatformOperatorRoleUseCase {
  constructor(
    private readonly actors: LoadPlatformActorService,
    private readonly operators: PlatformOperatorRepository,
    private readonly users: UserDirectoryPort,
    private readonly audit: OperationalAuditRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly actorId: string;
    readonly userId: string;
    readonly role: string;
    readonly security?: RequestSecurityContext;
    readonly correlationId?: string;
  }): Promise<PlatformOperatorResponse> {
    const actor = await this.actors.execute(input.actorId);
    assertPlatformPermission(permissionsForPlatformRole(actor.role), PlatformPermissions.OPERATORS_MANAGE);
    const operator = await requireActiveOperator(this.operators, input.userId);
    const nextRole = parsePlatformRole(input.role) as PlatformRole;
    const ownerCount = await this.operators.countActiveOwners();
    assertCanChangeRole({
      actorUserId: actor.userId,
      actorRole: actor.role,
      targetUserId: operator.userId,
      currentRole: operator.role,
      nextRole,
      activeOwnerCount: ownerCount,
    });

    const now = this.clock.now();
    const previousRole = operator.role;
    operator.changeRole(nextRole, now);
    await this.operators.save(operator);
    const user = await this.users.findById(operator.userId);
    await recordAudit(this.audit, {
      actorId: actor.userId,
      action: 'platform.operator.role_changed',
      resourceType: 'platform_operator',
      resourceId: operator.id,
      occurredAt: now,
      security: input.security,
      metadata: { userId: operator.userId, previousRole, role: nextRole },
    });
    await this.eventBus.publish(
      new PlatformOperatorRoleChangedEvent(
        crypto.randomUUID(),
        now,
        operator.userId,
        nextRole,
        input.correlationId ?? input.security?.correlationId,
      ),
    );
    return { operator: toOperatorDto(operator, user) };
  }
}

export class RevokePlatformOperatorUseCase {
  constructor(
    private readonly actors: LoadPlatformActorService,
    private readonly operators: PlatformOperatorRepository,
    private readonly users: UserDirectoryPort,
    private readonly audit: OperationalAuditRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly actorId: string;
    readonly userId: string;
    readonly security?: RequestSecurityContext;
    readonly correlationId?: string;
  }): Promise<PlatformOperatorResponse> {
    const actor = await this.actors.execute(input.actorId);
    assertPlatformPermission(permissionsForPlatformRole(actor.role), PlatformPermissions.OPERATORS_MANAGE);
    const operator = await requireActiveOperator(this.operators, input.userId);
    const ownerCount = await this.operators.countActiveOwners();
    assertCanRevoke({
      actorUserId: actor.userId,
      actorRole: actor.role,
      targetUserId: operator.userId,
      targetRole: operator.role,
      activeOwnerCount: ownerCount,
    });

    const now = this.clock.now();
    operator.revoke(now);
    await this.operators.save(operator);
    const user = await this.users.findById(operator.userId);
    await recordAudit(this.audit, {
      actorId: actor.userId,
      action: 'platform.operator.revoked',
      resourceType: 'platform_operator',
      resourceId: operator.id,
      occurredAt: now,
      security: input.security,
      metadata: { userId: operator.userId, role: operator.role },
    });
    await this.eventBus.publish(
      new PlatformOperatorRevokedEvent(
        crypto.randomUUID(),
        now,
        operator.userId,
        input.correlationId ?? input.security?.correlationId,
      ),
    );
    return { operator: toOperatorDto(operator, user) };
  }
}

async function requireActiveOperator(
  operators: PlatformOperatorRepository,
  userId: string,
): Promise<PlatformOperator> {
  const operator = await operators.findByUserId(userId);
  if (!operator || !operator.isActive) {
    throw new PlatformOperatorNotFoundError();
  }
  return operator;
}

function requireEligibleUser(user: DirectoryUser | null): DirectoryUser {
  if (!user) {
    throw new PlatformUserNotEligibleError('No user exists with that email');
  }
  if (user.status !== 'active') {
    throw new PlatformUserNotEligibleError('That user account is disabled');
  }
  if (!user.emailVerified) {
    throw new PlatformUserNotEligibleError('That user must verify their email first');
  }
  return user;
}

async function recordAudit(
  audit: OperationalAuditRepository,
  input: {
    readonly actorId: string;
    readonly action: string;
    readonly resourceType: string;
    readonly resourceId: string;
    readonly occurredAt: Date;
    readonly security?: RequestSecurityContext;
    readonly metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await audit.save(
    OperationalAuditEvent.create({
      actorId: input.actorId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      outcome: 'success',
      occurredAt: input.occurredAt,
      ipAddress: input.security?.ipAddress,
      userAgent: input.security?.userAgent,
      requestId: input.security?.requestId,
      metadata: input.metadata,
    }),
  );
}
