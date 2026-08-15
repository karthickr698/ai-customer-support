import type { EventBus } from '@ai-customer-support/shared';
import type {
  RevealSecuritySecretResponse,
  SecuritySecretListResponse,
  SecuritySecretResponse,
} from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import {
  DuplicateSecuritySecretError,
  SecuritySecretNotFoundError,
  TooManySecurityRecordsError,
} from '../../domain/errors.js';
import {
  SecuritySecretCreatedEvent,
  SecuritySecretRevokedEvent,
  SecuritySecretRotatedEvent,
} from '../../domain/events.js';
import { createSecuritySecretId } from '../../domain/ids.js';
import { MAX_SECRET_PLAINTEXT_BYTES, MAX_SECRETS_PER_TENANT } from '../../domain/security-controls.js';
import { SecurityAuditEvent } from '../../domain/security-audit-event.js';
import { SecurityPolicy } from '../../domain/security-policy.js';
import { SecuritySecret } from '../../domain/security-secret.js';
import { isUuid, requirePlaintext } from '../../domain/values.js';
import { toSecretDto, type RequestSecurityContext } from '../dtos.js';
import type {
  ClockPort,
  SecretCipherPort,
  SecurityAuditRepository,
  SecuritySecretRepository,
  TenantAccessPort,
} from '../ports.js';

export class ListSecuritySecretsUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly secrets: SecuritySecretRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
  }): Promise<SecuritySecretListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    SecurityPolicy.assertPermission(actor.permissions, Permissions.SECURITY_READ);
    const items = await this.secrets.listByTenant(actor.tenantId);
    return {
      items: items.filter((secret) => secret.belongsTo(actor.tenantId)).map(toSecretDto),
    };
  }
}

export class GetSecuritySecretUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly secrets: SecuritySecretRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly secretId: string;
  }): Promise<SecuritySecretResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    SecurityPolicy.assertPermission(actor.permissions, Permissions.SECURITY_READ);
    const secret = await loadSecret(this.secrets, actor.tenantId, input.secretId);
    return { secret: toSecretDto(secret) };
  }
}

export class CreateSecuritySecretUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly secrets: SecuritySecretRepository,
    private readonly cipher: SecretCipherPort,
    private readonly audit: SecurityAuditRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly name: string;
    readonly purpose: string;
    readonly plaintext: string;
    readonly security?: RequestSecurityContext;
    readonly correlationId?: string;
  }): Promise<SecuritySecretResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    SecurityPolicy.assertPermission(actor.permissions, Permissions.SECURITY_MANAGE);
    const plaintext = requirePlaintext(input.plaintext, MAX_SECRET_PLAINTEXT_BYTES);
    const count = await this.secrets.countActiveByTenant(actor.tenantId);
    if (count >= MAX_SECRETS_PER_TENANT) {
      throw new TooManySecurityRecordsError(`At most ${MAX_SECRETS_PER_TENANT} active secrets are allowed`);
    }
    const now = this.clock.now();
    const secret = SecuritySecret.create({
      organizationId: actor.tenantId,
      name: input.name,
      purpose: input.purpose,
      envelope: this.cipher.encrypt(plaintext),
      createdBy: actor.actorId,
      now,
    });
    const existing = await this.secrets.findByName(actor.tenantId, secret.name);
    if (existing && !existing.isRevoked) {
      throw new DuplicateSecuritySecretError();
    }
    await this.secrets.save(secret);
    await this.audit.save(
      SecurityAuditEvent.create({
        organizationId: actor.tenantId,
        actorId: actor.actorId,
        action: 'security.secret.created',
        resourceType: 'secret',
        resourceId: secret.id,
        outcome: 'success',
        occurredAt: now,
        ipAddress: input.security?.ipAddress,
        userAgent: input.security?.userAgent,
        requestId: input.security?.requestId,
        metadata: { name: secret.name, purpose: secret.purpose },
      }),
    );
    await this.eventBus.publish(
      new SecuritySecretCreatedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        secret.id,
        secret.name,
        secret.purpose,
        input.correlationId,
      ),
    );
    return { secret: toSecretDto(secret) };
  }
}

export class RevealSecuritySecretUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly secrets: SecuritySecretRepository,
    private readonly cipher: SecretCipherPort,
    private readonly audit: SecurityAuditRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly secretId: string;
    readonly security?: RequestSecurityContext;
  }): Promise<RevealSecuritySecretResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    SecurityPolicy.assertPermission(actor.permissions, Permissions.SECURITY_MANAGE);
    const secret = await loadSecret(this.secrets, actor.tenantId, input.secretId);
    secret.assertActive();
    const plaintext = this.cipher.decrypt(secret.envelope);
    const now = this.clock.now();
    secret.markAccessed(now);
    await this.secrets.save(secret);
    await this.audit.save(
      SecurityAuditEvent.create({
        organizationId: actor.tenantId,
        actorId: actor.actorId,
        action: 'security.secret.revealed',
        resourceType: 'secret',
        resourceId: secret.id,
        outcome: 'success',
        occurredAt: now,
        ipAddress: input.security?.ipAddress,
        userAgent: input.security?.userAgent,
        requestId: input.security?.requestId,
        metadata: { name: secret.name },
      }),
    );
    return { secret: { ...toSecretDto(secret), plaintext } };
  }
}

export class RotateSecuritySecretUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly secrets: SecuritySecretRepository,
    private readonly cipher: SecretCipherPort,
    private readonly audit: SecurityAuditRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly secretId: string;
    readonly plaintext: string;
    readonly security?: RequestSecurityContext;
    readonly correlationId?: string;
  }): Promise<SecuritySecretResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    SecurityPolicy.assertPermission(actor.permissions, Permissions.SECURITY_MANAGE);
    const plaintext = requirePlaintext(input.plaintext, MAX_SECRET_PLAINTEXT_BYTES);
    const secret = await loadSecret(this.secrets, actor.tenantId, input.secretId);
    const now = this.clock.now();
    secret.rotate(this.cipher.encrypt(plaintext), now);
    await this.secrets.save(secret);
    await this.audit.save(
      SecurityAuditEvent.create({
        organizationId: actor.tenantId,
        actorId: actor.actorId,
        action: 'security.secret.rotated',
        resourceType: 'secret',
        resourceId: secret.id,
        outcome: 'success',
        occurredAt: now,
        ipAddress: input.security?.ipAddress,
        userAgent: input.security?.userAgent,
        requestId: input.security?.requestId,
        metadata: { name: secret.name },
      }),
    );
    await this.eventBus.publish(
      new SecuritySecretRotatedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        secret.id,
        secret.name,
        input.correlationId,
      ),
    );
    return { secret: toSecretDto(secret) };
  }
}

export class RevokeSecuritySecretUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly secrets: SecuritySecretRepository,
    private readonly audit: SecurityAuditRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly secretId: string;
    readonly security?: RequestSecurityContext;
    readonly correlationId?: string;
  }): Promise<SecuritySecretResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    SecurityPolicy.assertPermission(actor.permissions, Permissions.SECURITY_MANAGE);
    const secret = await loadSecret(this.secrets, actor.tenantId, input.secretId);
    const now = this.clock.now();
    secret.revoke(now);
    await this.secrets.save(secret);
    await this.audit.save(
      SecurityAuditEvent.create({
        organizationId: actor.tenantId,
        actorId: actor.actorId,
        action: 'security.secret.revoked',
        resourceType: 'secret',
        resourceId: secret.id,
        outcome: 'success',
        occurredAt: now,
        ipAddress: input.security?.ipAddress,
        userAgent: input.security?.userAgent,
        requestId: input.security?.requestId,
        metadata: { name: secret.name },
      }),
    );
    await this.eventBus.publish(
      new SecuritySecretRevokedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        secret.id,
        secret.name,
        input.correlationId,
      ),
    );
    return { secret: toSecretDto(secret) };
  }
}

async function loadSecret(
  secrets: SecuritySecretRepository,
  tenantId: string,
  secretId: string,
): Promise<SecuritySecret> {
  if (!isUuid(secretId)) {
    throw new SecuritySecretNotFoundError();
  }
  const secret = await secrets.findById(tenantId, createSecuritySecretId(secretId));
  if (!secret || !secret.belongsTo(tenantId)) {
    throw new SecuritySecretNotFoundError();
  }
  return secret;
}
