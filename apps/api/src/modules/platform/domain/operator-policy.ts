import type { PlatformRole } from '@ai-customer-support/contracts';
import {
  CannotChangeOwnPlatformRoleError,
  CannotManagePlatformOwnerError,
  LastPlatformOwnerError,
} from './errors.js';

export function assertCanGrantRole(actorRole: PlatformRole, nextRole: PlatformRole): void {
  if (nextRole === 'owner' && actorRole !== 'owner') {
    throw new CannotManagePlatformOwnerError();
  }
}

export function assertCanChangeRole(input: {
  readonly actorUserId: string;
  readonly actorRole: PlatformRole;
  readonly targetUserId: string;
  readonly currentRole: PlatformRole;
  readonly nextRole: PlatformRole;
  readonly activeOwnerCount: number;
}): void {
  if (input.actorUserId === input.targetUserId) {
    throw new CannotChangeOwnPlatformRoleError();
  }
  if ((input.currentRole === 'owner' || input.nextRole === 'owner') && input.actorRole !== 'owner') {
    throw new CannotManagePlatformOwnerError();
  }
  if (input.currentRole === 'owner' && input.nextRole !== 'owner' && input.activeOwnerCount <= 1) {
    throw new LastPlatformOwnerError();
  }
}

export function assertCanRevoke(input: {
  readonly actorUserId: string;
  readonly actorRole: PlatformRole;
  readonly targetUserId: string;
  readonly targetRole: PlatformRole;
  readonly activeOwnerCount: number;
}): void {
  if (input.actorUserId === input.targetUserId) {
    throw new CannotChangeOwnPlatformRoleError();
  }
  if (input.targetRole === 'owner' && input.actorRole !== 'owner') {
    throw new CannotManagePlatformOwnerError();
  }
  if (input.targetRole === 'owner' && input.activeOwnerCount <= 1) {
    throw new LastPlatformOwnerError();
  }
}
