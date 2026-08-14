import { InvalidOrganizationRoleError } from './errors.js';
import { createMembershipId, type MembershipId } from './membership-id.js';
import type { OrganizationId } from './organization-id.js';
import { isOrganizationRole, type OrganizationRole } from './permissions.js';

export type MembershipStatus = 'active' | 'disabled';

export type MembershipSnapshot = {
  readonly id: MembershipId;
  readonly organizationId: OrganizationId;
  readonly userId: string;
  readonly role: OrganizationRole;
  readonly status: MembershipStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export class Membership {
  private constructor(
    readonly id: MembershipId,
    readonly organizationId: OrganizationId,
    readonly userId: string,
    private roleValue: OrganizationRole,
    private statusValue: MembershipStatus,
    readonly createdAt: Date,
    private updatedAtValue: Date,
  ) {}

  static create(input: {
    readonly organizationId: OrganizationId;
    readonly userId: string;
    readonly role: OrganizationRole;
    readonly now: Date;
    readonly id?: MembershipId;
  }): Membership {
    if (!isOrganizationRole(input.role)) {
      throw new InvalidOrganizationRoleError();
    }

    return new Membership(
      input.id ?? createMembershipId(),
      input.organizationId,
      input.userId,
      input.role,
      'active',
      input.now,
      input.now,
    );
  }

  static reconstitute(snapshot: MembershipSnapshot): Membership {
    return new Membership(
      snapshot.id,
      snapshot.organizationId,
      snapshot.userId,
      snapshot.role,
      snapshot.status,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get role(): OrganizationRole {
    return this.roleValue;
  }

  get status(): MembershipStatus {
    return this.statusValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  get isActive(): boolean {
    return this.statusValue === 'active';
  }

  get isOwner(): boolean {
    return this.roleValue === 'owner';
  }

  changeRole(role: OrganizationRole, now: Date): void {
    if (!isOrganizationRole(role)) {
      throw new InvalidOrganizationRoleError();
    }

    this.roleValue = role;
    this.updatedAtValue = now;
  }

  disable(now: Date): void {
    this.statusValue = 'disabled';
    this.updatedAtValue = now;
  }

  toSnapshot(): MembershipSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      userId: this.userId,
      role: this.roleValue,
      status: this.statusValue,
      createdAt: this.createdAt,
      updatedAt: this.updatedAtValue,
    };
  }
}
