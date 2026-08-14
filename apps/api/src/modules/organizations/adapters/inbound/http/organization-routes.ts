import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { RequestSecurityContext } from '../../../application/dtos.js';
import type { AcceptInvitationUseCase } from '../../../application/use-cases/accept-invitation-use-case.js';
import type { ChangeMemberRoleUseCase } from '../../../application/use-cases/change-member-role-use-case.js';
import type { CreateOrganizationUseCase } from '../../../application/use-cases/create-organization-use-case.js';
import type { GetOrganizationUseCase } from '../../../application/use-cases/get-organization-use-case.js';
import type { InviteMemberUseCase } from '../../../application/use-cases/invite-member-use-case.js';
import type { LeaveOrganizationUseCase } from '../../../application/use-cases/leave-organization-use-case.js';
import type { ListInvitationsUseCase } from '../../../application/use-cases/list-invitations-use-case.js';
import type { ListMembersUseCase } from '../../../application/use-cases/list-members-use-case.js';
import type { ListMyOrganizationsUseCase } from '../../../application/use-cases/list-my-organizations-use-case.js';
import type { ListOrganizationAuditLogsUseCase } from '../../../application/use-cases/list-organization-audit-logs-use-case.js';
import type { PreviewInvitationUseCase } from '../../../application/use-cases/preview-invitation-use-case.js';
import type { RemoveMemberUseCase } from '../../../application/use-cases/remove-member-use-case.js';
import type { ResolveTenantAccessUseCase } from '../../../application/use-cases/resolve-tenant-access-use-case.js';
import type { RevokeInvitationUseCase } from '../../../application/use-cases/revoke-invitation-use-case.js';
import type { UpdateOrganizationUseCase } from '../../../application/use-cases/update-organization-use-case.js';
import { Permissions } from '../../../domain/permissions.js';
import { UnauthorizedError } from '../../../domain/errors.js';
import {
  acceptInvitationBodySchema,
  auditLogQuerySchema,
  changeMemberRoleBodySchema,
  createOrganizationBodySchema,
  inviteMemberBodySchema,
  updateOrganizationBodySchema,
} from './organization-schemas.js';
import { parseBody } from './parse-body.js';
import { createRequirePermissionPreHandler } from './require-permission.js';
import { createResolveTenantPreHandler } from './resolve-tenant.js';

export type OrganizationHttpUseCases = {
  readonly createOrganization: CreateOrganizationUseCase;
  readonly listMyOrganizations: ListMyOrganizationsUseCase;
  readonly getOrganization: GetOrganizationUseCase;
  readonly updateOrganization: UpdateOrganizationUseCase;
  readonly listMembers: ListMembersUseCase;
  readonly changeMemberRole: ChangeMemberRoleUseCase;
  readonly removeMember: RemoveMemberUseCase;
  readonly leaveOrganization: LeaveOrganizationUseCase;
  readonly inviteMember: InviteMemberUseCase;
  readonly listInvitations: ListInvitationsUseCase;
  readonly revokeInvitation: RevokeInvitationUseCase;
  readonly previewInvitation: PreviewInvitationUseCase;
  readonly acceptInvitation: AcceptInvitationUseCase;
  readonly listAuditLogs: ListOrganizationAuditLogsUseCase;
  readonly resolveTenantAccess: ResolveTenantAccessUseCase;
};

export type AuthenticatePreHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

export async function registerOrganizationRoutes(
  app: FastifyInstance,
  useCases: OrganizationHttpUseCases,
  authenticate: AuthenticatePreHandler,
): Promise<void> {
  const resolveTenant = createResolveTenantPreHandler(useCases.resolveTenantAccess);
  const requireRead = createRequirePermissionPreHandler(Permissions.ORGANIZATION_READ);
  const requireUpdate = createRequirePermissionPreHandler(Permissions.ORGANIZATION_UPDATE);
  const requireMembers = createRequirePermissionPreHandler(Permissions.ORGANIZATION_MEMBERS_MANAGE);
  const requireInvitations = createRequirePermissionPreHandler(Permissions.ORGANIZATION_INVITATIONS_MANAGE);
  const requireAudit = createRequirePermissionPreHandler(Permissions.ORGANIZATION_AUDIT_VIEW);

  app.post('/api/organizations', { preHandler: authenticate }, async (request, reply) => {
    const body = parseBody(createOrganizationBodySchema, request.body);
    const result = await useCases.createOrganization.execute({
      actorId: requireUserId(request),
      name: body.name,
      security: securityContext(request),
    });

    return reply.status(201).send(result);
  });

  app.get('/api/organizations', { preHandler: authenticate }, async (request, reply) => {
    const result = await useCases.listMyOrganizations.execute(requireUserId(request));
    return reply.status(200).send(result);
  });

  app.get(
    '/api/organizations/:organizationId',
    { preHandler: [authenticate, resolveTenant, requireRead] },
    async (request, reply) => {
      const result = await useCases.getOrganization.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.patch(
    '/api/organizations/:organizationId',
    { preHandler: [authenticate, resolveTenant, requireUpdate] },
    async (request, reply) => {
      const body = parseBody(updateOrganizationBodySchema, request.body);
      const result = await useCases.updateOrganization.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        name: body.name,
        slug: body.slug,
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.get(
    '/api/organizations/:organizationId/members',
    { preHandler: [authenticate, resolveTenant, requireRead] },
    async (request, reply) => {
      const result = await useCases.listMembers.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.patch(
    '/api/organizations/:organizationId/members/:membershipId',
    { preHandler: [authenticate, resolveTenant, requireMembers] },
    async (request, reply) => {
      const body = parseBody(changeMemberRoleBodySchema, request.body);
      const result = await useCases.changeMemberRole.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        membershipId: routeParam(request, 'membershipId'),
        role: body.role,
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.delete(
    '/api/organizations/:organizationId/members/:membershipId',
    { preHandler: [authenticate, resolveTenant, requireMembers] },
    async (request, reply) => {
      await useCases.removeMember.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        membershipId: routeParam(request, 'membershipId'),
        security: securityContext(request),
      });
      return reply.status(204).send();
    },
  );

  app.post(
    '/api/organizations/:organizationId/leave',
    { preHandler: [authenticate, resolveTenant, requireRead] },
    async (request, reply) => {
      await useCases.leaveOrganization.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        security: securityContext(request),
      });
      return reply.status(204).send();
    },
  );

  app.post(
    '/api/organizations/:organizationId/invitations',
    { preHandler: [authenticate, resolveTenant, requireInvitations] },
    async (request, reply) => {
      const body = parseBody(inviteMemberBodySchema, request.body);
      const result = await useCases.inviteMember.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        email: body.email,
        role: body.role,
        security: securityContext(request),
      });
      return reply.status(201).send(result);
    },
  );

  app.get(
    '/api/organizations/:organizationId/invitations',
    { preHandler: [authenticate, resolveTenant, requireInvitations] },
    async (request, reply) => {
      const result = await useCases.listInvitations.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.delete(
    '/api/organizations/:organizationId/invitations/:invitationId',
    { preHandler: [authenticate, resolveTenant, requireInvitations] },
    async (request, reply) => {
      await useCases.revokeInvitation.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        invitationId: routeParam(request, 'invitationId'),
        security: securityContext(request),
      });
      return reply.status(204).send();
    },
  );

  app.get(
    '/api/organizations/:organizationId/audit-logs',
    { preHandler: [authenticate, resolveTenant, requireAudit] },
    async (request, reply) => {
      const query = parseBody(auditLogQuerySchema, request.query);
      const result = await useCases.listAuditLogs.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        page: { page: query.page, pageSize: query.pageSize },
      });
      return reply.status(200).send(result);
    },
  );

  app.get('/api/invitations/:token', async (request, reply) => {
    const result = await useCases.previewInvitation.execute(routeParam(request, 'token'));
    return reply.status(200).send(result);
  });

  app.post('/api/invitations/accept', { preHandler: authenticate }, async (request, reply) => {
    const body = parseBody(acceptInvitationBodySchema, request.body);
    const result = await useCases.acceptInvitation.execute({
      actorId: requireUserId(request),
      actorEmail: requireEmail(request),
      token: body.token,
      security: securityContext(request),
    });
    return reply.status(200).send(result);
  });
}

function requireUserId(request: FastifyRequest): string {
  if (!request.auth) {
    throw new UnauthorizedError();
  }

  return request.auth.userId;
}

function requireEmail(request: FastifyRequest): string {
  if (!request.auth) {
    throw new UnauthorizedError();
  }

  return request.auth.email;
}

function requireTenantId(request: FastifyRequest): string {
  const tenantId = request.tenantAccess?.tenantId ?? request.requestContext.tenantId;
  if (!tenantId) {
    throw new UnauthorizedError('Select an organization to continue');
  }

  return tenantId;
}

function routeParam(request: FastifyRequest, key: string): string {
  const params = request.params as Record<string, unknown>;
  const value = params[key];
  return typeof value === 'string' ? value : '';
}

function securityContext(request: FastifyRequest): RequestSecurityContext {
  const userAgentHeader = request.headers['user-agent'];

  return {
    ipAddress: request.ip,
    userAgent: typeof userAgentHeader === 'string' ? userAgentHeader : undefined,
    requestId: request.requestContext.requestId,
    correlationId: request.requestContext.correlationId,
  };
}
