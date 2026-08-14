import type { EventBus } from '@ai-customer-support/shared';
import { RateLimitExceededError, type DomainEvent, type Page, type PageRequest } from '@ai-customer-support/shared';
import { EmailAddress } from '../../../apps/api/src/modules/organizations/domain/email-address.ts';
import { Invitation } from '../../../apps/api/src/modules/organizations/domain/invitation.ts';
import type { InvitationId } from '../../../apps/api/src/modules/organizations/domain/invitation-id.ts';
import { Membership } from '../../../apps/api/src/modules/organizations/domain/membership.ts';
import type { MembershipId } from '../../../apps/api/src/modules/organizations/domain/membership-id.ts';
import { Organization } from '../../../apps/api/src/modules/organizations/domain/organization.ts';
import type { OrganizationId } from '../../../apps/api/src/modules/organizations/domain/organization-id.ts';
import type { OrganizationSlug } from '../../../apps/api/src/modules/organizations/domain/organization-slug.ts';
import type { ClockPort } from '../../../apps/api/src/modules/organizations/application/ports/clock-port.ts';
import type { InvitationEmailMessage, InvitationEmailPort } from '../../../apps/api/src/modules/organizations/application/ports/invitation-email-port.ts';
import type { InvitationRepository } from '../../../apps/api/src/modules/organizations/application/ports/invitation-repository.ts';
import type { MembershipRepository } from '../../../apps/api/src/modules/organizations/application/ports/membership-repository.ts';
import type {
  OrganizationAuditLogEntry,
  OrganizationAuditLogPort,
  OrganizationAuditLogRecord,
} from '../../../apps/api/src/modules/organizations/application/ports/organization-audit-log-port.ts';
import type { OrganizationRepository } from '../../../apps/api/src/modules/organizations/application/ports/organization-repository.ts';
import type { RateLimiterPort } from '../../../apps/api/src/modules/organizations/application/ports/rate-limiter-port.ts';
import type { SecureTokenGeneratorPort } from '../../../apps/api/src/modules/organizations/application/ports/secure-token-generator-port.ts';
import type { TokenHasherPort } from '../../../apps/api/src/modules/organizations/application/ports/token-hasher-port.ts';
import type {
  DirectoryUser,
  UserDirectoryPort,
} from '../../../apps/api/src/modules/organizations/application/ports/user-directory-port.ts';

export class InMemoryOrganizationRepository implements OrganizationRepository {
  readonly items = new Map<string, Organization>();

  async findById(id: OrganizationId): Promise<Organization | null> {
    return cloneOrganization(this.items.get(id) ?? null);
  }

  async findBySlug(slug: OrganizationSlug): Promise<Organization | null> {
    return cloneOrganization(
      [...this.items.values()].find((organization) => organization.slug.value === slug.value) ?? null,
    );
  }

  async findByIds(ids: readonly OrganizationId[]): Promise<Organization[]> {
    return ids
      .map((id) => this.items.get(id))
      .filter((organization): organization is Organization => organization !== undefined)
      .map((organization) => Organization.reconstitute(organization.toSnapshot()));
  }

  async save(organization: Organization): Promise<void> {
    this.items.set(organization.id, Organization.reconstitute(organization.toSnapshot()));
  }
}

export class InMemoryMembershipRepository implements MembershipRepository {
  readonly items = new Map<string, Membership>();

  async save(membership: Membership): Promise<void> {
    this.items.set(membership.id, Membership.reconstitute(membership.toSnapshot()));
  }

  async findById(tenantId: OrganizationId, membershipId: MembershipId): Promise<Membership | null> {
    const membership = this.items.get(membershipId);
    if (!membership || membership.organizationId !== tenantId) {
      return null;
    }

    return Membership.reconstitute(membership.toSnapshot());
  }

  async findByUser(tenantId: OrganizationId, userId: string): Promise<Membership | null> {
    const membership = [...this.items.values()].find(
      (item) => item.organizationId === tenantId && item.userId === userId,
    );
    return membership ? Membership.reconstitute(membership.toSnapshot()) : null;
  }

  async listByOrganization(tenantId: OrganizationId): Promise<Membership[]> {
    return [...this.items.values()]
      .filter((membership) => membership.organizationId === tenantId)
      .map((membership) => Membership.reconstitute(membership.toSnapshot()));
  }

  async listByUser(userId: string): Promise<Membership[]> {
    return [...this.items.values()]
      .filter((membership) => membership.userId === userId)
      .map((membership) => Membership.reconstitute(membership.toSnapshot()));
  }

  async countActiveOwners(tenantId: OrganizationId): Promise<number> {
    return [...this.items.values()].filter(
      (membership) =>
        membership.organizationId === tenantId && membership.isOwner && membership.isActive,
    ).length;
  }

  async delete(tenantId: OrganizationId, membershipId: MembershipId): Promise<void> {
    const membership = this.items.get(membershipId);
    if (membership && membership.organizationId === tenantId) {
      this.items.delete(membershipId);
    }
  }
}

export class InMemoryInvitationRepository implements InvitationRepository {
  readonly items: Invitation[] = [];

  async save(invitation: Invitation): Promise<void> {
    const copy = Invitation.reconstitute(invitation.toSnapshot());
    const index = this.items.findIndex((item) => item.id === invitation.id);
    if (index >= 0) {
      this.items[index] = copy;
      return;
    }

    this.items.push(copy);
  }

  async findById(tenantId: OrganizationId, invitationId: InvitationId): Promise<Invitation | null> {
    const invitation = this.items.find(
      (item) => item.id === invitationId && item.organizationId === tenantId,
    );
    return invitation ? Invitation.reconstitute(invitation.toSnapshot()) : null;
  }

  async findPendingByEmail(tenantId: OrganizationId, email: EmailAddress): Promise<Invitation | null> {
    const invitation = this.items.find(
      (item) =>
        item.organizationId === tenantId &&
        item.email.value === email.value &&
        item.acceptedAt === undefined &&
        item.revokedAt === undefined,
    );
    return invitation ? Invitation.reconstitute(invitation.toSnapshot()) : null;
  }

  async findByTokenHash(tokenHash: string): Promise<Invitation | null> {
    const invitation = this.items.find((item) => item.tokenHash === tokenHash);
    return invitation ? Invitation.reconstitute(invitation.toSnapshot()) : null;
  }

  async listPendingByOrganization(tenantId: OrganizationId, now: Date): Promise<Invitation[]> {
    return this.items
      .filter((item) => item.organizationId === tenantId && item.isPending(now))
      .map((item) => Invitation.reconstitute(item.toSnapshot()));
  }
}

export class InMemoryUserDirectory implements UserDirectoryPort {
  readonly users = new Map<string, DirectoryUser>();

  seed(user: DirectoryUser): void {
    this.users.set(user.id, user);
  }

  async findById(id: string): Promise<DirectoryUser | null> {
    return this.users.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<DirectoryUser | null> {
    return [...this.users.values()].find((user) => user.email === email.toLowerCase()) ?? null;
  }
}

export class RecordingOrganizationAuditLog implements OrganizationAuditLogPort {
  readonly entries: OrganizationAuditLogRecord[] = [];

  async record(entry: OrganizationAuditLogRecord): Promise<void> {
    this.entries.push(entry);
  }

  async list(tenantId: OrganizationId, page: PageRequest): Promise<Page<OrganizationAuditLogEntry>> {
    const scoped = this.entries.filter((entry) => entry.tenantId === tenantId);
    const start = (page.page - 1) * page.pageSize;
    return {
      items: scoped.slice(start, start + page.pageSize).map((entry) => ({
        id: crypto.randomUUID(),
        tenantId: entry.tenantId,
        actorId: entry.actorId,
        action: entry.action,
        metadata: entry.metadata,
        occurredAt: entry.occurredAt,
      })),
      total: scoped.length,
      page: page.page,
      pageSize: page.pageSize,
    };
  }
}

export class RecordingInvitationEmail implements InvitationEmailPort {
  readonly messages: InvitationEmailMessage[] = [];

  async sendInvitation(message: InvitationEmailMessage): Promise<void> {
    this.messages.push(message);
  }
}

export class InMemoryRateLimiter implements RateLimiterPort {
  readonly counts = new Map<string, number>();

  async consume(key: string, limit: number, _windowSeconds: number): Promise<void> {
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);
    if (next > limit) {
      throw new RateLimitExceededError('Too many requests', 60);
    }
  }
}

export class SequenceTokenGenerator implements SecureTokenGeneratorPort {
  private count = 0;

  generate(): string {
    this.count += 1;
    return `invite-token-${this.count}`;
  }
}

export class FakeTokenHasher implements TokenHasherPort {
  hash(token: string): string {
    return `sha256:${token}`;
  }
}

export class FixedClock implements ClockPort {
  constructor(private current: Date) {}

  now(): Date {
    return this.current;
  }
}

export class RecordingEventBus implements EventBus {
  readonly events: DomainEvent[] = [];

  async publish(event: DomainEvent): Promise<void> {
    this.events.push(event);
  }

  subscribe(): void {}
}

export const security = {
  ipAddress: '127.0.0.1',
  userAgent: 'vitest',
  requestId: 'req-1',
  correlationId: 'corr-1',
};

function cloneOrganization(organization: Organization | null): Organization | null {
  return organization ? Organization.reconstitute(organization.toSnapshot()) : null;
}
