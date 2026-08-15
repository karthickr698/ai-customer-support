import type {
  DecryptPayloadResponse,
  EncryptPayloadResponse,
} from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { parseEncryptionEnvelope } from '../../domain/encryption-envelope.js';
import { MAX_ENCRYPT_PLAINTEXT_BYTES } from '../../domain/security-controls.js';
import { SecurityAuditEvent } from '../../domain/security-audit-event.js';
import { SecurityPolicy } from '../../domain/security-policy.js';
import { requirePlaintext } from '../../domain/values.js';
import { toEnvelopeDto, type RequestSecurityContext } from '../dtos.js';
import type {
  ClockPort,
  SecretCipherPort,
  SecurityAuditRepository,
  TenantAccessPort,
} from '../ports.js';

export class EncryptPayloadUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly cipher: SecretCipherPort,
    private readonly audit: SecurityAuditRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly plaintext: string;
    readonly security?: RequestSecurityContext;
  }): Promise<EncryptPayloadResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    SecurityPolicy.assertPermission(actor.permissions, Permissions.SECURITY_MANAGE);
    const plaintext = requirePlaintext(input.plaintext, MAX_ENCRYPT_PLAINTEXT_BYTES);
    const envelope = this.cipher.encrypt(plaintext);
    await this.audit.save(
      SecurityAuditEvent.create({
        organizationId: actor.tenantId,
        actorId: actor.actorId,
        action: 'security.encrypt.performed',
        resourceType: 'encryption',
        outcome: 'success',
        occurredAt: this.clock.now(),
        ipAddress: input.security?.ipAddress,
        userAgent: input.security?.userAgent,
        requestId: input.security?.requestId,
        metadata: { bytes: Buffer.byteLength(plaintext, 'utf8'), keyVersion: envelope.keyVersion },
      }),
    );
    return { envelope: toEnvelopeDto(envelope) };
  }
}

export class DecryptPayloadUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly cipher: SecretCipherPort,
    private readonly audit: SecurityAuditRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly algorithm?: string;
    readonly keyVersion: number;
    readonly ciphertext: string;
    readonly nonce: string;
    readonly security?: RequestSecurityContext;
  }): Promise<DecryptPayloadResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    SecurityPolicy.assertPermission(actor.permissions, Permissions.SECURITY_MANAGE);
    const envelope = parseEncryptionEnvelope({
      algorithm: input.algorithm,
      keyVersion: input.keyVersion,
      ciphertext: input.ciphertext,
      nonce: input.nonce,
    });
    const plaintext = this.cipher.decrypt(envelope);
    await this.audit.save(
      SecurityAuditEvent.create({
        organizationId: actor.tenantId,
        actorId: actor.actorId,
        action: 'security.decrypt.performed',
        resourceType: 'encryption',
        outcome: 'success',
        occurredAt: this.clock.now(),
        ipAddress: input.security?.ipAddress,
        userAgent: input.security?.userAgent,
        requestId: input.security?.requestId,
        metadata: { keyVersion: envelope.keyVersion },
      }),
    );
    return { plaintext };
  }
}
