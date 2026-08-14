import {
  CannotChangeOwnRoleError,
  CannotManageOwnerError,
  InsufficientPermissionError,
  LastOwnerError,
} from './errors.js';
import { Membership } from './membership.js';
import { Permissions, roleHasPermission, type OrganizationRole, type Permission } from './permissions.js';

export class MembershipPolicy {
  static assertPermission(role: OrganizationRole, permission: Permission): void {
    if (!roleHasPermission(role, permission)) {
      throw new InsufficientPermissionError(permission);
    }
  }

  static assertCanChangeRole(input: {
    readonly actor: Membership;
    readonly target: Membership;
    readonly nextRole: OrganizationRole;
    readonly ownerCount: number;
  }): void {
    MembershipPolicy.assertPermission(input.actor.role, Permissions.ORGANIZATION_MEMBERS_MANAGE);

    if (input.actor.userId === input.target.userId) {
      throw new CannotChangeOwnRoleError();
    }

    if (input.target.isOwner || input.nextRole === 'owner') {
      if (!input.actor.isOwner) {
        throw new CannotManageOwnerError();
      }
    }

    if (input.target.isOwner && input.nextRole !== 'owner' && input.ownerCount <= 1) {
      throw new LastOwnerError();
    }
  }

  static assertCanRemove(input: {
    readonly actor: Membership;
    readonly target: Membership;
    readonly ownerCount: number;
  }): void {
    MembershipPolicy.assertPermission(input.actor.role, Permissions.ORGANIZATION_MEMBERS_MANAGE);

    if (input.actor.userId === input.target.userId) {
      throw new CannotChangeOwnRoleError();
    }

    if (input.target.isOwner && !input.actor.isOwner) {
      throw new CannotManageOwnerError();
    }

    if (input.target.isOwner && input.ownerCount <= 1) {
      throw new LastOwnerError();
    }
  }

  static assertCanLeave(input: { readonly membership: Membership; readonly ownerCount: number }): void {
    if (input.membership.isOwner && input.ownerCount <= 1) {
      throw new LastOwnerError();
    }
  }
}
