import { describe, expect, it } from 'vitest';
import { OrganizationAuditActions } from '../../../apps/api/src/modules/organizations/domain/audit-actions.ts';
import {
  CannotChangeOwnRoleError,
  InsufficientPermissionError,
  LastOwnerError,
  UnauthorizedOrganizationAccessError,
} from '../../../apps/api/src/modules/organizations/domain/errors.ts';
import { Membership } from '../../../apps/api/src/modules/organizations/domain/membership.ts';
import { Organization } from '../../../apps/api/src/modules/organizations/domain/organization.ts';
import { OrganizationSlug } from '../../../apps/api/src/modules/organizations/domain/organization-slug.ts';
import { LoadTenantMembershipService } from '../../../apps/api/src/modules/organizations/application/load-tenant-membership-service.ts';
import { ChangeMemberRoleUseCase } from '../../../apps/api/src/modules/organizations/application/use-cases/change-member-role-use-case.ts';
import { CreateOrganizationUseCase } from '../../../apps/api/src/modules/organizations/application/use-cases/create-organization-use-case.ts';
import { InviteMemberUseCase } from '../../../apps/api/src/modules/organizations/application/use-cases/invite-member-use-case.ts';
import { AcceptInvitationUseCase } from '../../../apps/api/src/modules/organizations/application/use-cases/accept-invitation-use-case.ts';
import { LeaveOrganizationUseCase } from '../../../apps/api/src/modules/organizations/application/use-cases/leave-organization-use-case.ts';
import { ListMembersUseCase } from '../../../apps/api/src/modules/organizations/application/use-cases/list-members-use-case.ts';
import { ResolveTenantAccessUseCase } from '../../../apps/api/src/modules/organizations/application/use-cases/resolve-tenant-access-use-case.ts';
import {
  FakeTokenHasher,
  FixedClock,
  InMemoryInvitationRepository,
  InMemoryMembershipRepository,
  InMemoryOrganizationRepository,
  InMemoryRateLimiter,
  InMemoryUserDirectory,
  RecordingEventBus,
  RecordingInvitationEmail,
  RecordingOrganizationAuditLog,
  SequenceTokenGenerator,
  security,
} from './fakes.ts';

const now = new Date('2026-08-14T12:00:00.000Z');

function createOrgHarness() {
  const organizations = new InMemoryOrganizationRepository();
  const memberships = new InMemoryMembershipRepository();
  const invitations = new InMemoryInvitationRepository();
  const users = new InMemoryUserDirectory();
  const emails = new RecordingInvitationEmail();
  const auditLog = new RecordingOrganizationAuditLog();
  const eventBus = new RecordingEventBus();
  const clock = new FixedClock(now);
  const tokens = new SequenceTokenGenerator();
  const hasher = new FakeTokenHasher();
  const tenantMemberships = new LoadTenantMembershipService(organizations, memberships);

  return {
    organizations,
    memberships,
    invitations,
    users,
    emails,
    auditLog,
    eventBus,
    clock,
    tokens,
    hasher,
    tenantMemberships,
    createOrganization: new CreateOrganizationUseCase(
      organizations,
      memberships,
      auditLog,
      new InMemoryRateLimiter(),
      clock,
      eventBus,
    ),
    listMembers: new ListMembersUseCase(tenantMemberships, memberships, users),
    resolveTenant: new ResolveTenantAccessUseCase(tenantMemberships),
    changeRole: new ChangeMemberRoleUseCase(
      tenantMemberships,
      memberships,
      users,
      auditLog,
      clock,
      eventBus,
    ),
    leave: new LeaveOrganizationUseCase(tenantMemberships, memberships, auditLog, clock, eventBus),
    invite: new InviteMemberUseCase(
      tenantMemberships,
      memberships,
      invitations,
      users,
      emails,
      tokens,
      hasher,
      auditLog,
      new InMemoryRateLimiter(),
      clock,
      eventBus,
      'http://localhost:5173',
      604_800,
    ),
    accept: new AcceptInvitationUseCase(
      invitations,
      organizations,
      memberships,
      hasher,
      auditLog,
      new InMemoryRateLimiter(),
      clock,
      eventBus,
    ),
  };
}

async function seedMembership(
  harness: ReturnType<typeof createOrgHarness>,
  input: {
    organization: Organization;
    userId: string;
    email: string;
    role: 'owner' | 'admin' | 'agent' | 'viewer';
  },
): Promise<Membership> {
  const membership = Membership.create({
    organizationId: input.organization.id,
    userId: input.userId,
    role: input.role,
    now,
  });
  await harness.memberships.save(membership);
  harness.users.seed({
    id: input.userId,
    email: input.email,
    displayName: input.email,
    status: 'active',
  });
  return membership;
}

describe('CreateOrganizationUseCase', () => {
  it('makes the creator the owner and writes a tenant audit log', async () => {
    const harness = createOrgHarness();
    const result = await harness.createOrganization.execute({
      actorId: 'user-1',
      name: 'Northwind',
      security,
    });

    expect(result.organization.name).toBe('Northwind');
    expect(result.organization.membership.role).toBe('owner');
    expect(result.organization.membership.permissions).toContain('organization.delete');
    expect(harness.auditLog.entries[0]?.action).toBe(OrganizationAuditActions.ORGANIZATION_CREATED);
    expect(harness.auditLog.entries[0]?.tenantId).toBe(result.organization.id);
  });
});

describe('tenant isolation', () => {
  it('does not return another tenant’s members or grant access', async () => {
    const harness = createOrgHarness();
    const orgA = Organization.create({
      name: 'Org A',
      slug: OrganizationSlug.parse('org-a'),
      now,
    });
    const orgB = Organization.create({
      name: 'Org B',
      slug: OrganizationSlug.parse('org-b'),
      now,
    });
    await harness.organizations.save(orgA);
    await harness.organizations.save(orgB);
    await seedMembership(harness, {
      organization: orgA,
      userId: 'user-a',
      email: 'a@example.com',
      role: 'owner',
    });
    await seedMembership(harness, {
      organization: orgB,
      userId: 'user-b',
      email: 'b@example.com',
      role: 'owner',
    });

    const members = await harness.listMembers.execute({ tenantId: orgA.id, actorId: 'user-a' });
    expect(members.members).toHaveLength(1);
    expect(members.members[0]?.userId).toBe('user-a');

    await expect(
      harness.listMembers.execute({ tenantId: orgB.id, actorId: 'user-a' }),
    ).rejects.toBeInstanceOf(UnauthorizedOrganizationAccessError);

    await expect(
      harness.resolveTenant.execute({ tenantId: orgB.id, actorId: 'user-a' }),
    ).rejects.toBeInstanceOf(UnauthorizedOrganizationAccessError);
  });
});

describe('invitations', () => {
  it('invites a teammate and accepts into the inviting tenant only', async () => {
    const harness = createOrgHarness();
    const created = await harness.createOrganization.execute({
      actorId: 'owner-1',
      name: 'Acme',
      security,
    });
    harness.users.seed({
      id: 'owner-1',
      email: 'owner@example.com',
      displayName: 'Owner',
      status: 'active',
    });

    const invited = await harness.invite.execute({
      tenantId: created.organization.id,
      actorId: 'owner-1',
      email: 'agent@example.com',
      role: 'agent',
      security,
    });

    expect(invited.invitation.email).toBe('agent@example.com');
    expect(harness.emails.messages[0]?.acceptUrl).toContain('invite-token-1');

    const accepted = await harness.accept.execute({
      actorId: 'agent-1',
      actorEmail: 'agent@example.com',
      token: 'invite-token-1',
      security,
    });

    expect(accepted.organization.id).toBe(created.organization.id);
    expect(accepted.organization.membership.role).toBe('agent');
    expect(accepted.organization.membership.permissions).toContain('ticket.manage');
    expect(accepted.organization.membership.permissions).not.toContain('organization.members.manage');
  });
});

describe('membership constraints', () => {
  it('keeps the last owner and blocks agents from managing members', async () => {
    const harness = createOrgHarness();
    const organization = Organization.create({
      name: 'Solo',
      slug: OrganizationSlug.parse('solo-org'),
      now,
    });
    await harness.organizations.save(organization);
    const owner = await seedMembership(harness, {
      organization,
      userId: 'owner-1',
      email: 'owner@example.com',
      role: 'owner',
    });
    const agent = await seedMembership(harness, {
      organization,
      userId: 'agent-1',
      email: 'agent@example.com',
      role: 'agent',
    });

    await expect(
      harness.leave.execute({
        tenantId: organization.id,
        actorId: 'owner-1',
        security,
      }),
    ).rejects.toBeInstanceOf(LastOwnerError);

    await expect(
      harness.changeRole.execute({
        tenantId: organization.id,
        actorId: 'owner-1',
        membershipId: owner.id,
        role: 'admin',
        security,
      }),
    ).rejects.toBeInstanceOf(CannotChangeOwnRoleError);

    await expect(
      harness.changeRole.execute({
        tenantId: organization.id,
        actorId: 'agent-1',
        membershipId: agent.id,
        role: 'admin',
        security,
      }),
    ).rejects.toBeInstanceOf(InsufficientPermissionError);
  });
});
