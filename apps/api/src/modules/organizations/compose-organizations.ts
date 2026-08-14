import type { AppConfig } from '@ai-customer-support/config';
import type { EventBus, Logger } from '@ai-customer-support/shared';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';
import { PostgresOrganizationAuditLog } from './adapters/outbound/audit/postgres-organization-audit-log.js';
import {
  RandomSecureTokenGenerator,
  Sha256TokenHasher,
  SystemClock,
} from './adapters/outbound/crypto/token-crypto.js';
import { ConsoleInvitationEmailSender } from './adapters/outbound/email/console-invitation-email-sender.js';
import { SmtpInvitationEmailSender } from './adapters/outbound/email/smtp-invitation-email-sender.js';
import { PostgresInvitationRepository } from './adapters/outbound/persistence/postgres-invitation-repository.js';
import { PostgresMembershipRepository } from './adapters/outbound/persistence/postgres-membership-repository.js';
import { PostgresOrganizationRepository } from './adapters/outbound/persistence/postgres-organization-repository.js';
import { RedisRateLimiter } from './adapters/outbound/redis/redis-rate-limiter.js';
import {
  registerOrganizationRoutes,
  type AuthenticatePreHandler,
} from './adapters/inbound/http/organization-routes.js';
import { LoadTenantMembershipService } from './application/load-tenant-membership-service.js';
import { OrganizationMemberQuery } from './application/organization-member-query.js';
import type { InvitationEmailPort } from './application/ports/invitation-email-port.js';
import type { UserDirectoryPort } from './application/ports/user-directory-port.js';
import { AcceptInvitationUseCase } from './application/use-cases/accept-invitation-use-case.js';
import { ChangeMemberRoleUseCase } from './application/use-cases/change-member-role-use-case.js';
import { CreateOrganizationUseCase } from './application/use-cases/create-organization-use-case.js';
import { GetOrganizationUseCase } from './application/use-cases/get-organization-use-case.js';
import { InviteMemberUseCase } from './application/use-cases/invite-member-use-case.js';
import { LeaveOrganizationUseCase } from './application/use-cases/leave-organization-use-case.js';
import { ListInvitationsUseCase } from './application/use-cases/list-invitations-use-case.js';
import { ListMembersUseCase } from './application/use-cases/list-members-use-case.js';
import { ListMyOrganizationsUseCase } from './application/use-cases/list-my-organizations-use-case.js';
import { ListOrganizationAuditLogsUseCase } from './application/use-cases/list-organization-audit-logs-use-case.js';
import { PreviewInvitationUseCase } from './application/use-cases/preview-invitation-use-case.js';
import { RemoveMemberUseCase } from './application/use-cases/remove-member-use-case.js';
import { ResolveTenantAccessUseCase } from './application/use-cases/resolve-tenant-access-use-case.js';
import { RevokeInvitationUseCase } from './application/use-cases/revoke-invitation-use-case.js';
import { UpdateOrganizationUseCase } from './application/use-cases/update-organization-use-case.js';

export type OrganizationsHttpRegistrar = {
  register(app: FastifyInstance): Promise<void>;
};

export type OrganizationsModule = OrganizationsHttpRegistrar & {
  readonly resolveTenantAccess: ResolveTenantAccessUseCase;
  readonly memberQuery: OrganizationMemberQuery;
};

export function composeOrganizations(input: {
  readonly prisma: PrismaClient;
  readonly redis: Redis;
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly eventBus: EventBus;
  readonly userDirectory: UserDirectoryPort;
  readonly authenticate: AuthenticatePreHandler;
}): OrganizationsModule {
  const organizations = new PostgresOrganizationRepository(input.prisma);
  const memberships = new PostgresMembershipRepository(input.prisma);
  const invitations = new PostgresInvitationRepository(input.prisma);
  const auditLog = new PostgresOrganizationAuditLog(input.prisma);
  const clock = new SystemClock();
  const tokenGenerator = new RandomSecureTokenGenerator();
  const tokenHasher = new Sha256TokenHasher();
  const rateLimiter = new RedisRateLimiter(input.redis);
  const emailSender = createInvitationEmailSender(input.config, input.logger);
  const tenantMemberships = new LoadTenantMembershipService(organizations, memberships);

  const useCases = {
    createOrganization: new CreateOrganizationUseCase(
      organizations,
      memberships,
      auditLog,
      rateLimiter,
      clock,
      input.eventBus,
    ),
    listMyOrganizations: new ListMyOrganizationsUseCase(organizations, memberships),
    getOrganization: new GetOrganizationUseCase(tenantMemberships),
    updateOrganization: new UpdateOrganizationUseCase(
      tenantMemberships,
      organizations,
      auditLog,
      clock,
      input.eventBus,
    ),
    listMembers: new ListMembersUseCase(tenantMemberships, memberships, input.userDirectory),
    changeMemberRole: new ChangeMemberRoleUseCase(
      tenantMemberships,
      memberships,
      input.userDirectory,
      auditLog,
      clock,
      input.eventBus,
    ),
    removeMember: new RemoveMemberUseCase(
      tenantMemberships,
      memberships,
      auditLog,
      clock,
      input.eventBus,
    ),
    leaveOrganization: new LeaveOrganizationUseCase(
      tenantMemberships,
      memberships,
      auditLog,
      clock,
      input.eventBus,
    ),
    inviteMember: new InviteMemberUseCase(
      tenantMemberships,
      memberships,
      invitations,
      input.userDirectory,
      emailSender,
      tokenGenerator,
      tokenHasher,
      auditLog,
      rateLimiter,
      clock,
      input.eventBus,
      input.config.WEB_ORIGIN,
      input.config.INVITATION_TTL_SECONDS,
    ),
    listInvitations: new ListInvitationsUseCase(tenantMemberships, invitations, clock),
    revokeInvitation: new RevokeInvitationUseCase(
      tenantMemberships,
      invitations,
      auditLog,
      clock,
      input.eventBus,
    ),
    previewInvitation: new PreviewInvitationUseCase(invitations, organizations, tokenHasher, clock),
    acceptInvitation: new AcceptInvitationUseCase(
      invitations,
      organizations,
      memberships,
      tokenHasher,
      auditLog,
      rateLimiter,
      clock,
      input.eventBus,
    ),
    listAuditLogs: new ListOrganizationAuditLogsUseCase(tenantMemberships, auditLog),
    resolveTenantAccess: new ResolveTenantAccessUseCase(tenantMemberships),
  };

  return {
    resolveTenantAccess: useCases.resolveTenantAccess,
    memberQuery: new OrganizationMemberQuery(memberships),
    async register(app: FastifyInstance): Promise<void> {
      await registerOrganizationRoutes(app, useCases, input.authenticate);
    },
  };
}

function createInvitationEmailSender(config: AppConfig, logger: Logger): InvitationEmailPort {
  if (config.SMTP_URL) {
    return new SmtpInvitationEmailSender(config.SMTP_URL, config.EMAIL_FROM, logger);
  }

  return new ConsoleInvitationEmailSender(logger, config.NODE_ENV);
}
