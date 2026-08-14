import { EmailAddress } from './email-address.js';
import {
  CannotInviteOwnerError,
  InvalidInvitationTokenError,
  InvalidOrganizationRoleError,
} from './errors.js';
import { createInvitationId, type InvitationId } from './invitation-id.js';
import type { OrganizationId } from './organization-id.js';
import { isAssignableMemberRole, type AssignableMemberRole } from './permissions.js';

export type InvitationSnapshot = {
  readonly id: InvitationId;
  readonly organizationId: OrganizationId;
  readonly email: string;
  readonly role: AssignableMemberRole;
  readonly tokenHash: string;
  readonly invitedByUserId: string;
  readonly expiresAt: Date;
  readonly acceptedAt: Date | undefined;
  readonly revokedAt: Date | undefined;
  readonly createdAt: Date;
};

export class Invitation {
  private constructor(
    readonly id: InvitationId,
    readonly organizationId: OrganizationId,
    readonly email: EmailAddress,
    readonly role: AssignableMemberRole,
    readonly tokenHash: string,
    readonly invitedByUserId: string,
    readonly expiresAt: Date,
    private acceptedAtValue: Date | undefined,
    private revokedAtValue: Date | undefined,
    readonly createdAt: Date,
  ) {}

  static issue(input: {
    readonly organizationId: OrganizationId;
    readonly email: EmailAddress;
    readonly role: string;
    readonly tokenHash: string;
    readonly invitedByUserId: string;
    readonly expiresAt: Date;
    readonly now: Date;
    readonly id?: InvitationId;
  }): Invitation {
    if (input.role === 'owner') {
      throw new CannotInviteOwnerError();
    }

    if (!isAssignableMemberRole(input.role)) {
      throw new InvalidOrganizationRoleError();
    }

    return new Invitation(
      input.id ?? createInvitationId(),
      input.organizationId,
      input.email,
      input.role,
      input.tokenHash,
      input.invitedByUserId,
      input.expiresAt,
      undefined,
      undefined,
      input.now,
    );
  }

  static reconstitute(snapshot: InvitationSnapshot): Invitation {
    return new Invitation(
      snapshot.id,
      snapshot.organizationId,
      EmailAddress.parse(snapshot.email),
      snapshot.role,
      snapshot.tokenHash,
      snapshot.invitedByUserId,
      snapshot.expiresAt,
      snapshot.acceptedAt,
      snapshot.revokedAt,
      snapshot.createdAt,
    );
  }

  get acceptedAt(): Date | undefined {
    return this.acceptedAtValue;
  }

  get revokedAt(): Date | undefined {
    return this.revokedAtValue;
  }

  isPending(now: Date): boolean {
    return this.acceptedAtValue === undefined && this.revokedAtValue === undefined && this.expiresAt > now;
  }

  assertAcceptable(now: Date): void {
    if (this.acceptedAtValue !== undefined || this.revokedAtValue !== undefined || this.expiresAt <= now) {
      throw new InvalidInvitationTokenError();
    }
  }

  accept(now: Date): void {
    this.assertAcceptable(now);
    this.acceptedAtValue = now;
  }

  revoke(now: Date): void {
    this.assertAcceptable(now);
    this.revokedAtValue = now;
  }

  toSnapshot(): InvitationSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      email: this.email.value,
      role: this.role,
      tokenHash: this.tokenHash,
      invitedByUserId: this.invitedByUserId,
      expiresAt: this.expiresAt,
      acceptedAt: this.acceptedAtValue,
      revokedAt: this.revokedAtValue,
      createdAt: this.createdAt,
    };
  }
}
