import type { SecuritySecretPurpose } from '@ai-customer-support/contracts';
import { InvalidSecurityError, SecuritySecretRevokedError } from './errors.js';
import { createSecuritySecretId, type SecuritySecretId } from './ids.js';
import { createEncryptionEnvelope, type EncryptionEnvelope } from './encryption-envelope.js';
import { normalizeSecretName, parseSecretPurpose } from './values.js';

export type SecuritySecretSnapshot = {
  readonly id: SecuritySecretId;
  readonly organizationId: string;
  readonly name: string;
  readonly purpose: SecuritySecretPurpose;
  readonly ciphertext: string;
  readonly nonce: string;
  readonly keyVersion: number;
  readonly lastAccessedAt?: Date;
  readonly rotatedAt?: Date;
  readonly revokedAt?: Date;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export class SecuritySecret {
  private constructor(
    readonly id: SecuritySecretId,
    readonly organizationId: string,
    readonly name: string,
    readonly purpose: SecuritySecretPurpose,
    private envelopeValue: EncryptionEnvelope,
    private lastAccessedAtValue: Date | undefined,
    private rotatedAtValue: Date | undefined,
    private revokedAtValue: Date | undefined,
    readonly createdBy: string,
    readonly createdAt: Date,
    private updatedAtValue: Date,
  ) {}

  static create(input: {
    readonly organizationId: string;
    readonly name: string;
    readonly purpose: string;
    readonly envelope: EncryptionEnvelope;
    readonly createdBy: string;
    readonly now: Date;
    readonly id?: SecuritySecretId;
  }): SecuritySecret {
    if (!input.organizationId.trim()) {
      throw new InvalidSecurityError('Organization is required');
    }
    return new SecuritySecret(
      input.id ?? createSecuritySecretId(),
      input.organizationId,
      normalizeSecretName(input.name),
      parseSecretPurpose(input.purpose),
      input.envelope,
      undefined,
      undefined,
      undefined,
      input.createdBy,
      input.now,
      input.now,
    );
  }

  static reconstitute(snapshot: SecuritySecretSnapshot): SecuritySecret {
    return new SecuritySecret(
      snapshot.id,
      snapshot.organizationId,
      snapshot.name,
      snapshot.purpose,
      createEncryptionEnvelope({
        ciphertext: snapshot.ciphertext,
        nonce: snapshot.nonce,
        keyVersion: snapshot.keyVersion,
      }),
      snapshot.lastAccessedAt,
      snapshot.rotatedAt,
      snapshot.revokedAt,
      snapshot.createdBy,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get envelope(): EncryptionEnvelope {
    return this.envelopeValue;
  }

  get lastAccessedAt(): Date | undefined {
    return this.lastAccessedAtValue;
  }

  get rotatedAt(): Date | undefined {
    return this.rotatedAtValue;
  }

  get revokedAt(): Date | undefined {
    return this.revokedAtValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  get isRevoked(): boolean {
    return this.revokedAtValue !== undefined;
  }

  belongsTo(tenantId: string): boolean {
    return this.organizationId === tenantId;
  }

  assertActive(): void {
    if (this.isRevoked) {
      throw new SecuritySecretRevokedError();
    }
  }

  rotate(envelope: EncryptionEnvelope, now: Date): void {
    this.assertActive();
    this.envelopeValue = envelope;
    this.rotatedAtValue = now;
    this.updatedAtValue = now;
  }

  markAccessed(now: Date): void {
    this.assertActive();
    this.lastAccessedAtValue = now;
    this.updatedAtValue = now;
  }

  revoke(now: Date): void {
    this.assertActive();
    this.revokedAtValue = now;
    this.updatedAtValue = now;
  }

  toSnapshot(): SecuritySecretSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      name: this.name,
      purpose: this.purpose,
      ciphertext: this.envelopeValue.ciphertext,
      nonce: this.envelopeValue.nonce,
      keyVersion: this.envelopeValue.keyVersion,
      lastAccessedAt: this.lastAccessedAtValue,
      rotatedAt: this.rotatedAtValue,
      revokedAt: this.revokedAtValue,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAtValue,
    };
  }
}
