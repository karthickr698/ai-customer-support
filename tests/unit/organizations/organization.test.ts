import { describe, expect, it } from 'vitest';
import { EmailAddress } from '../../../apps/api/src/modules/organizations/domain/email-address.ts';
import {
  CannotChangeOwnRoleError,
  CannotInviteOwnerError,
  CannotManageOwnerError,
  InvalidInvitationTokenError,
  LastOwnerError,
} from '../../../apps/api/src/modules/organizations/domain/errors.ts';
import { Invitation } from '../../../apps/api/src/modules/organizations/domain/invitation.ts';
import { Membership } from '../../../apps/api/src/modules/organizations/domain/membership.ts';
import { MembershipPolicy } from '../../../apps/api/src/modules/organizations/domain/membership-policy.ts';
import { Organization } from '../../../apps/api/src/modules/organizations/domain/organization.ts';
import { createOrganizationId } from '../../../apps/api/src/modules/organizations/domain/organization-id.ts';
import { OrganizationSlug } from '../../../apps/api/src/modules/organizations/domain/organization-slug.ts';
import {
  Permissions,
  roleHasPermission,
} from '../../../apps/api/src/modules/organizations/domain/permissions.ts';

const now = new Date('2026-08-14T12:00:00.000Z');
const tenantId = createOrganizationId('11111111-1111-1111-1111-111111111111');

describe('Organization', () => {
  it('creates an active organization with a slug derived from the name', () => {
    const organization = Organization.create({
      name: ' Acme Support ',
      slug: OrganizationSlug.fromName('Acme Support'),
      now,
    });

    expect(organization.name).toBe('Acme Support');
    expect(organization.slug.value).toBe('acme-support');
    expect(organization.status).toBe('active');
  });
});

describe('RBAC permissions', () => {
  it('gives owners every permission and keeps delete owner-only', () => {
    expect(roleHasPermission('owner', Permissions.ORGANIZATION_DELETE)).toBe(true);
    expect(roleHasPermission('admin', Permissions.ORGANIZATION_DELETE)).toBe(false);
    expect(roleHasPermission('admin', Permissions.ORGANIZATION_MEMBERS_MANAGE)).toBe(true);
    expect(roleHasPermission('agent', Permissions.TICKET_MANAGE)).toBe(true);
    expect(roleHasPermission('agent', Permissions.ORGANIZATION_INVITATIONS_MANAGE)).toBe(false);
    expect(roleHasPermission('viewer', Permissions.CONVERSATION_READ)).toBe(true);
    expect(roleHasPermission('viewer', Permissions.KNOWLEDGE_MANAGE)).toBe(false);
  });
});

describe('MembershipPolicy', () => {
  it('prevents removing or demoting the last owner', () => {
    const owner = Membership.create({
      organizationId: tenantId,
      userId: 'owner-1',
      role: 'owner',
      now,
    });
    const other = Membership.create({
      organizationId: tenantId,
      userId: 'admin-1',
      role: 'admin',
      now,
    });

    expect(() =>
      MembershipPolicy.assertCanRemove({ actor: owner, target: owner, ownerCount: 1 }),
    ).toThrow(CannotChangeOwnRoleError);

    expect(() => MembershipPolicy.assertCanLeave({ membership: owner, ownerCount: 1 })).toThrow(LastOwnerError);

    expect(() =>
      MembershipPolicy.assertCanChangeRole({
        actor: owner,
        target: owner,
        nextRole: 'admin',
        ownerCount: 1,
      }),
    ).toThrow(CannotChangeOwnRoleError);

    expect(() =>
      MembershipPolicy.assertCanChangeRole({
        actor: other,
        target: owner,
        nextRole: 'admin',
        ownerCount: 2,
      }),
    ).toThrow(CannotManageOwnerError);
  });
});

describe('Invitation', () => {
  it('rejects owner invitations and expired tokens', () => {
    expect(() =>
      Invitation.issue({
        organizationId: tenantId,
        email: EmailAddress.parse('agent@example.com'),
        role: 'owner',
        tokenHash: 'hash',
        invitedByUserId: 'owner-1',
        expiresAt: new Date(now.getTime() + 60_000),
        now,
      }),
    ).toThrow(CannotInviteOwnerError);

    const invitation = Invitation.issue({
      organizationId: tenantId,
      email: EmailAddress.parse('agent@example.com'),
      role: 'agent',
      tokenHash: 'hash',
      invitedByUserId: 'owner-1',
      expiresAt: new Date(now.getTime() - 1),
      now,
    });

    expect(() => invitation.assertAcceptable(now)).toThrow(InvalidInvitationTokenError);
  });
});
