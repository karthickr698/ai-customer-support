import type { AppConfig } from '@ai-customer-support/config';
import type { EventBus, Logger } from '@ai-customer-support/shared';
import pino from 'pino';
import { afterEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../../apps/api/src/bootstrap/server.ts';
import type { AppDependencies } from '../../../apps/api/src/bootstrap/dependencies.ts';
import type { AIServicePort } from '../../../apps/api/src/modules/ai/application/ports/ai-service-port.ts';
import { createAuthenticatePreHandler } from '../../../apps/api/src/modules/identity/adapters/inbound/http/authenticate.ts';
import type {
  AccessTokenClaims,
  IssuedAccessToken,
  TokenIssuerPort,
} from '../../../apps/api/src/modules/identity/application/ports/token-issuer-port.ts';
import { registerOrganizationRoutes } from '../../../apps/api/src/modules/organizations/adapters/inbound/http/organization-routes.ts';
import { LoadTenantMembershipService } from '../../../apps/api/src/modules/organizations/application/load-tenant-membership-service.ts';
import { AcceptInvitationUseCase } from '../../../apps/api/src/modules/organizations/application/use-cases/accept-invitation-use-case.ts';
import { ChangeMemberRoleUseCase } from '../../../apps/api/src/modules/organizations/application/use-cases/change-member-role-use-case.ts';
import { CreateOrganizationUseCase } from '../../../apps/api/src/modules/organizations/application/use-cases/create-organization-use-case.ts';
import { GetOrganizationUseCase } from '../../../apps/api/src/modules/organizations/application/use-cases/get-organization-use-case.ts';
import { InviteMemberUseCase } from '../../../apps/api/src/modules/organizations/application/use-cases/invite-member-use-case.ts';
import { LeaveOrganizationUseCase } from '../../../apps/api/src/modules/organizations/application/use-cases/leave-organization-use-case.ts';
import { ListInvitationsUseCase } from '../../../apps/api/src/modules/organizations/application/use-cases/list-invitations-use-case.ts';
import { ListMembersUseCase } from '../../../apps/api/src/modules/organizations/application/use-cases/list-members-use-case.ts';
import { ListMyOrganizationsUseCase } from '../../../apps/api/src/modules/organizations/application/use-cases/list-my-organizations-use-case.ts';
import { ListOrganizationAuditLogsUseCase } from '../../../apps/api/src/modules/organizations/application/use-cases/list-organization-audit-logs-use-case.ts';
import { PreviewInvitationUseCase } from '../../../apps/api/src/modules/organizations/application/use-cases/preview-invitation-use-case.ts';
import { RemoveMemberUseCase } from '../../../apps/api/src/modules/organizations/application/use-cases/remove-member-use-case.ts';
import { ResolveTenantAccessUseCase } from '../../../apps/api/src/modules/organizations/application/use-cases/resolve-tenant-access-use-case.ts';
import { RevokeInvitationUseCase } from '../../../apps/api/src/modules/organizations/application/use-cases/revoke-invitation-use-case.ts';
import { UpdateOrganizationUseCase } from '../../../apps/api/src/modules/organizations/application/use-cases/update-organization-use-case.ts';
import type { DatabasePort } from '../../../apps/api/src/shared/application/ports/database-port.ts';
import type { QueuePort } from '../../../apps/api/src/shared/application/ports/queue-port.ts';
import type { RedisPort } from '../../../apps/api/src/shared/application/ports/redis-port.ts';
import { InfrastructureHealthChecker } from '../../../apps/api/src/shared/infrastructure/health/infrastructure-health-checker.ts';
import { PinoLogger } from '../../../apps/api/src/shared/infrastructure/logging/pino-logger.ts';
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
} from '../organizations/fakes.ts';

class FakeDatabase implements DatabasePort {
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async isReady(): Promise<boolean> {
    return true;
  }
}

class FakeRedis implements RedisPort {
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async isReady(): Promise<boolean> {
    return true;
  }
}

class FakeQueue implements QueuePort {
  async enqueue(): Promise<void> {}
  process(): void {}
  async close(): Promise<void> {}
}

class FakeAIService implements AIServicePort {
  async isReady(): Promise<boolean> {
    return true;
  }

  async generateBusinessProfile(): Promise<never> {
    throw new Error('not implemented');
  }

  async generateSupportTonePresets(): Promise<never> {
    throw new Error('not implemented');
  }

  async generateInitialAgentSettings(): Promise<never> {
    throw new Error('not implemented');
  }

  async runOnboardingSetup(): Promise<never> {
    throw new Error('not implemented');
  }

  async *streamSupportReply(): AsyncIterable<never> {
    throw new Error('not implemented');
  }

  async ingestKnowledgeDocument(): Promise<never> {
    throw new Error('not implemented');
  }

  async deleteIndexedKnowledgeDocument(): Promise<never> {
    throw new Error('not implemented');
  }

  async detectIntent(): Promise<never> {
    throw new Error('not implemented');
  }

  async orchestrateSupportTurn(): Promise<never> {
    throw new Error('not implemented');
  }

  async proposeToolCalls(): Promise<never> {
    throw new Error('not implemented');
  }

  async applyToolResults(): Promise<never> {
    throw new Error('not implemented');
  }
}

class MapTokenIssuer implements TokenIssuerPort {
  constructor(private readonly users: Map<string, string>) {}

  async issueAccessToken(claims: AccessTokenClaims): Promise<IssuedAccessToken> {
    return { token: `access:${claims.userId}`, expiresAt: new Date(Date.now() + 900_000) };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
    if (!token.startsWith('access:')) {
      return null;
    }

    const userId = token.slice('access:'.length);
    const email = this.users.get(userId);
    if (!email) {
      return null;
    }

    return { userId, email };
  }
}

function testConfig(): AppConfig {
  return {
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: 3001,
    LOG_LEVEL: 'fatal',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/ai_customer_support',
    REDIS_URL: 'redis://localhost:6380',
    JWT_SECRET: 'a'.repeat(32),
    ACCESS_TOKEN_TTL_SECONDS: 900,
    REFRESH_TOKEN_TTL_SECONDS: 604800,
    EMAIL_VERIFICATION_TTL_SECONDS: 86_400,
    PASSWORD_RESET_TTL_SECONDS: 3600,
    INVITATION_TTL_SECONDS: 604800,
    WIDGET_SESSION_TTL_SECONDS: 2592000,
    ATTACHMENT_STORAGE_DIR: './data/attachments',
    KNOWLEDGE_STORAGE_DIR: './data/knowledge',
    WEB_ORIGIN: 'http://localhost:5173',
    AI_SERVICE_URL: 'http://localhost:8000',
    EMAIL_FROM: 'noreply@localhost',
  };
}

function createOrganizationDeps(eventBus: EventBus) {
  const organizations = new InMemoryOrganizationRepository();
  const memberships = new InMemoryMembershipRepository();
  const invitations = new InMemoryInvitationRepository();
  const users = new InMemoryUserDirectory();
  const emails = new RecordingInvitationEmail();
  const auditLog = new RecordingOrganizationAuditLog();
  const clock = new FixedClock(new Date('2026-08-14T12:00:00.000Z'));
  const tokens = new SequenceTokenGenerator();
  const hasher = new FakeTokenHasher();
  const rateLimiter = new InMemoryRateLimiter();
  const tenantMemberships = new LoadTenantMembershipService(organizations, memberships);
  const tokenIssuer = new MapTokenIssuer(
    new Map([
      ['owner-1', 'owner@example.com'],
      ['outsider-1', 'outsider@example.com'],
      ['agent-1', 'agent@example.com'],
    ]),
  );

  users.seed({
    id: 'owner-1',
    email: 'owner@example.com',
    displayName: 'Owner',
    status: 'active',
  });
  users.seed({
    id: 'agent-1',
    email: 'agent@example.com',
    displayName: 'Agent',
    status: 'active',
  });

  return {
    emails,
    tokenIssuer,
    useCases: {
      createOrganization: new CreateOrganizationUseCase(
        organizations,
        memberships,
        auditLog,
        rateLimiter,
        clock,
        eventBus,
      ),
      listMyOrganizations: new ListMyOrganizationsUseCase(organizations, memberships),
      getOrganization: new GetOrganizationUseCase(tenantMemberships),
      updateOrganization: new UpdateOrganizationUseCase(
        tenantMemberships,
        organizations,
        auditLog,
        clock,
        eventBus,
      ),
      listMembers: new ListMembersUseCase(tenantMemberships, memberships, users),
      changeMemberRole: new ChangeMemberRoleUseCase(
        tenantMemberships,
        memberships,
        users,
        auditLog,
        clock,
        eventBus,
      ),
      removeMember: new RemoveMemberUseCase(tenantMemberships, memberships, auditLog, clock, eventBus),
      leaveOrganization: new LeaveOrganizationUseCase(
        tenantMemberships,
        memberships,
        auditLog,
        clock,
        eventBus,
      ),
      inviteMember: new InviteMemberUseCase(
        tenantMemberships,
        memberships,
        invitations,
        users,
        emails,
        tokens,
        hasher,
        auditLog,
        rateLimiter,
        clock,
        eventBus,
        'http://localhost:5173',
        604_800,
      ),
      listInvitations: new ListInvitationsUseCase(tenantMemberships, invitations, clock),
      revokeInvitation: new RevokeInvitationUseCase(
        tenantMemberships,
        invitations,
        auditLog,
        clock,
        eventBus,
      ),
      previewInvitation: new PreviewInvitationUseCase(invitations, organizations, hasher, clock),
      acceptInvitation: new AcceptInvitationUseCase(
        invitations,
        organizations,
        memberships,
        hasher,
        auditLog,
        rateLimiter,
        clock,
        eventBus,
      ),
      listAuditLogs: new ListOrganizationAuditLogsUseCase(tenantMemberships, auditLog),
      resolveTenantAccess: new ResolveTenantAccessUseCase(tenantMemberships),
    },
  };
}

describe('organization HTTP routes', () => {
  const apps: Array<{ close: () => Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function start() {
    const rootLogger = pino({ level: 'silent' });
    const logger: Logger = new PinoLogger(rootLogger);
    const eventBus = new RecordingEventBus();
    const organizations = createOrganizationDeps(eventBus);
    const deps: AppDependencies = {
      config: testConfig(),
      logger,
      database: new FakeDatabase(),
      redis: new FakeRedis(),
      eventBus,
      queue: new FakeQueue(),
      aiService: new FakeAIService(),
      healthChecker: new InfrastructureHealthChecker(new FakeDatabase(), new FakeRedis()),
      organizations: {
        register: async (app) => {
          await registerOrganizationRoutes(
            app,
            organizations.useCases,
            createAuthenticatePreHandler(organizations.tokenIssuer),
          );
        },
      },
    };

    const app = await buildServer(deps, rootLogger);
    apps.push(app);
    return { app, organizations };
  }

  it('requires authentication to create an organization', async () => {
    const { app } = await start();
    const response = await app.inject({
      method: 'POST',
      url: '/api/organizations',
      payload: { name: 'Acme' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('enforces tenant isolation and invitation RBAC', async () => {
    const { app, organizations } = await start();
    const ownerAuth = { authorization: 'Bearer access:owner-1' };
    const outsiderAuth = { authorization: 'Bearer access:outsider-1' };

    const created = await app.inject({
      method: 'POST',
      url: '/api/organizations',
      headers: ownerAuth,
      payload: { name: 'Acme Support' },
    });

    expect(created.statusCode).toBe(201);
    const organizationId = created.json().organization.id as string;

    const outsiderRead = await app.inject({
      method: 'GET',
      url: `/api/organizations/${organizationId}/members`,
      headers: outsiderAuth,
    });
    expect(outsiderRead.statusCode).toBe(403);
    expect(outsiderRead.json().error.code).toBe('UNAUTHORIZED_ORGANIZATION_ACCESS');

    const invite = await app.inject({
      method: 'POST',
      url: `/api/organizations/${organizationId}/invitations`,
      headers: ownerAuth,
      payload: { email: 'agent@example.com', role: 'agent' },
    });
    expect(invite.statusCode).toBe(201);

    const acceptUrl = organizations.emails.messages[0]?.acceptUrl ?? '';
    const token = new URL(acceptUrl).searchParams.get('token');

    const preview = await app.inject({
      method: 'GET',
      url: `/api/invitations/${token}`,
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.json().invitation.email).toBe('agent@example.com');

    const accepted = await app.inject({
      method: 'POST',
      url: '/api/invitations/accept',
      headers: { authorization: 'Bearer access:agent-1' },
      payload: { token },
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().organization.membership.role).toBe('agent');

    const agentInvite = await app.inject({
      method: 'POST',
      url: `/api/organizations/${organizationId}/invitations`,
      headers: { authorization: 'Bearer access:agent-1', 'x-tenant-id': organizationId },
      payload: { email: 'other@example.com', role: 'viewer' },
    });
    expect(agentInvite.statusCode).toBe(403);
    expect(agentInvite.json().error.code).toBe('INSUFFICIENT_PERMISSION');

    const logs = await app.inject({
      method: 'GET',
      url: `/api/organizations/${organizationId}/audit-logs`,
      headers: ownerAuth,
    });
    expect(logs.statusCode).toBe(200);
    expect(logs.json().total).toBeGreaterThanOrEqual(2);
  });
});
