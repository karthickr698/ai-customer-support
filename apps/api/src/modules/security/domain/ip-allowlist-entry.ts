import { InvalidSecurityError } from './errors.js';
import {
  createSecurityIpAllowlistEntryId,
  type SecurityIpAllowlistEntryId,
} from './ids.js';
import { normalizeCidr, normalizeText } from './values.js';

export type SecurityIpAllowlistEntrySnapshot = {
  readonly id: SecurityIpAllowlistEntryId;
  readonly organizationId: string;
  readonly cidr: string;
  readonly label?: string;
  readonly createdBy: string;
  readonly createdAt: Date;
};

export class SecurityIpAllowlistEntry {
  private constructor(
    readonly id: SecurityIpAllowlistEntryId,
    readonly organizationId: string,
    readonly cidr: string,
    readonly label: string | undefined,
    readonly createdBy: string,
    readonly createdAt: Date,
  ) {}

  static create(input: {
    readonly organizationId: string;
    readonly cidr: string;
    readonly createdBy: string;
    readonly now: Date;
    readonly label?: string;
    readonly id?: SecurityIpAllowlistEntryId;
  }): SecurityIpAllowlistEntry {
    if (!input.organizationId.trim()) {
      throw new InvalidSecurityError('Organization is required');
    }
    return new SecurityIpAllowlistEntry(
      input.id ?? createSecurityIpAllowlistEntryId(),
      input.organizationId,
      normalizeCidr(input.cidr),
      input.label ? normalizeText(input.label, 'Label', 1, 80) : undefined,
      input.createdBy,
      input.now,
    );
  }

  static reconstitute(snapshot: SecurityIpAllowlistEntrySnapshot): SecurityIpAllowlistEntry {
    return new SecurityIpAllowlistEntry(
      snapshot.id,
      snapshot.organizationId,
      snapshot.cidr,
      snapshot.label,
      snapshot.createdBy,
      snapshot.createdAt,
    );
  }

  belongsTo(tenantId: string): boolean {
    return this.organizationId === tenantId;
  }

  toSnapshot(): SecurityIpAllowlistEntrySnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      cidr: this.cidr,
      label: this.label,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
    };
  }
}
