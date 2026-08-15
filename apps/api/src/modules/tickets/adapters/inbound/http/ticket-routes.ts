import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  createRequirePermissionPreHandler,
  createResolveTenantPreHandler,
  Permissions,
  type ResolveTenantAccessUseCase,
} from '../../../../organizations/index.js';
import type { RequestSecurityContext } from '../../../application/dtos.js';
import type {
  GetTicketAttachmentUseCase,
  UploadTicketAttachmentUseCase,
} from '../../../application/use-cases/attachment-use-cases.js';
import type {
  AssignTicketToAvailableAgentUseCase,
  AssignTicketUseCase,
  EscalateTicketUseCase,
  UnassignTicketUseCase,
} from '../../../application/use-cases/assignment-use-cases.js';
import type {
  CreateTicketEscalationPolicyUseCase,
  DeleteTicketEscalationPolicyUseCase,
  EvaluateTicketEscalationUseCase,
  ListTicketEscalationPoliciesUseCase,
  UpdateTicketEscalationPolicyUseCase,
} from '../../../application/use-cases/escalation-policy-use-cases.js';
import type {
  AddTicketNoteUseCase,
  ListTicketNotesUseCase,
} from '../../../application/use-cases/note-use-cases.js';
import type {
  CreateTicketSlaPolicyUseCase,
  DeleteTicketSlaPolicyUseCase,
  ListTicketSlaPoliciesUseCase,
  UpdateTicketSlaPolicyUseCase,
} from '../../../application/use-cases/sla-policy-use-cases.js';
import type {
  ChangeTicketStatusUseCase,
  CreateTicketUseCase,
  GetTicketUseCase,
  ListTicketsUseCase,
} from '../../../application/use-cases/ticket-use-cases.js';
import { UnauthorizedError } from '../../../domain/errors.js';
import { parseBody } from './parse-body.js';
import { readUploadedFile } from './read-uploaded-file.js';
import {
  addTicketNoteBodySchema,
  assignTicketBodySchema,
  changeTicketStatusBodySchema,
  createEscalationPolicyBodySchema,
  createSlaPolicyBodySchema,
  createTicketBodySchema,
  escalateTicketBodySchema,
  ticketListQuerySchema,
  ticketNoteListQuerySchema,
  updateEscalationPolicyBodySchema,
  updateSlaPolicyBodySchema,
} from './ticket-schemas.js';

export type TicketHttpUseCases = {
  readonly createTicket: CreateTicketUseCase;
  readonly getTicket: GetTicketUseCase;
  readonly listTickets: ListTicketsUseCase;
  readonly changeTicketStatus: ChangeTicketStatusUseCase;
  readonly assignTicket: AssignTicketUseCase;
  readonly assignToAvailable: AssignTicketToAvailableAgentUseCase;
  readonly unassignTicket: UnassignTicketUseCase;
  readonly escalateTicket: EscalateTicketUseCase;
  readonly addNote: AddTicketNoteUseCase;
  readonly listNotes: ListTicketNotesUseCase;
  readonly uploadAttachment: UploadTicketAttachmentUseCase;
  readonly getAttachment: GetTicketAttachmentUseCase;
  readonly createSlaPolicy: CreateTicketSlaPolicyUseCase;
  readonly listSlaPolicies: ListTicketSlaPoliciesUseCase;
  readonly updateSlaPolicy: UpdateTicketSlaPolicyUseCase;
  readonly deleteSlaPolicy: DeleteTicketSlaPolicyUseCase;
  readonly createEscalationPolicy: CreateTicketEscalationPolicyUseCase;
  readonly listEscalationPolicies: ListTicketEscalationPoliciesUseCase;
  readonly updateEscalationPolicy: UpdateTicketEscalationPolicyUseCase;
  readonly deleteEscalationPolicy: DeleteTicketEscalationPolicyUseCase;
  readonly evaluateEscalation: EvaluateTicketEscalationUseCase;
};

export type AuthenticatePreHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

export async function registerTicketRoutes(
  app: FastifyInstance,
  useCases: TicketHttpUseCases,
  authenticate: AuthenticatePreHandler,
  resolveTenantAccess: ResolveTenantAccessUseCase,
): Promise<void> {
  const resolveTenant = createResolveTenantPreHandler(resolveTenantAccess);
  const requireManage = createRequirePermissionPreHandler(Permissions.TICKET_MANAGE);
  const tenantAuth = [authenticate, resolveTenant];
  const org = '/api/organizations/:organizationId';

  app.post(`${org}/tickets`, { preHandler: [...tenantAuth, requireManage] }, async (request, reply) => {
    const body = parseBody(createTicketBodySchema, request.body);
    const result = await useCases.createTicket.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      ...body,
      security: securityContext(request),
    });
    return reply.status(201).send(result);
  });

  app.get(`${org}/tickets`, { preHandler: [...tenantAuth, requireManage] }, async (request, reply) => {
    const query = parseBody(ticketListQuerySchema, request.query);
    const result = await useCases.listTickets.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      page: { page: query.page, pageSize: query.pageSize },
      status: query.status,
      priority: query.priority,
      assignedAgentId: query.assignedAgentId,
      conversationId: query.conversationId,
      slaBreached: query.slaBreached,
      query: query.q,
    });
    return reply.status(200).send(result);
  });

  app.get(`${org}/tickets/:ticketId`, { preHandler: [...tenantAuth, requireManage] }, async (request, reply) => {
    const result = await useCases.getTicket.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      ticketId: routeParam(request, 'ticketId'),
    });
    return reply.status(200).send(result);
  });

  app.patch(
    `${org}/tickets/:ticketId/status`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const body = parseBody(changeTicketStatusBodySchema, request.body);
      const result = await useCases.changeTicketStatus.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        ticketId: routeParam(request, 'ticketId'),
        status: body.status,
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    `${org}/tickets/:ticketId/assign`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const body = parseBody(assignTicketBodySchema, request.body);
      const result = await useCases.assignTicket.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        ticketId: routeParam(request, 'ticketId'),
        assignedAgentId: body.assignedAgentId,
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    `${org}/tickets/:ticketId/assign/available`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const result = await useCases.assignToAvailable.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        ticketId: routeParam(request, 'ticketId'),
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    `${org}/tickets/:ticketId/unassign`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const result = await useCases.unassignTicket.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        ticketId: routeParam(request, 'ticketId'),
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    `${org}/tickets/:ticketId/escalate`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const body = parseBody(escalateTicketBodySchema, request.body ?? {});
      const result = await useCases.escalateTicket.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        ticketId: routeParam(request, 'ticketId'),
        reason: body.reason,
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.get(
    `${org}/tickets/:ticketId/notes`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const query = parseBody(ticketNoteListQuerySchema, request.query);
      const result = await useCases.listNotes.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        ticketId: routeParam(request, 'ticketId'),
        page: { page: query.page, pageSize: query.pageSize },
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    `${org}/tickets/:ticketId/notes`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const body = parseBody(addTicketNoteBodySchema, request.body);
      const result = await useCases.addNote.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        ticketId: routeParam(request, 'ticketId'),
        body: body.body,
        security: securityContext(request),
      });
      return reply.status(201).send(result);
    },
  );

  app.post(
    `${org}/tickets/:ticketId/attachments`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const file = await readUploadedFile(request);
      const result = await useCases.uploadAttachment.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        ticketId: routeParam(request, 'ticketId'),
        fileName: file.fileName,
        contentType: file.contentType,
        bytes: file.bytes,
        security: securityContext(request),
      });
      return reply.status(201).send(result);
    },
  );

  app.get(
    `${org}/tickets/:ticketId/attachments/:attachmentId`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const result = await useCases.getAttachment.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        ticketId: routeParam(request, 'ticketId'),
        attachmentId: routeParam(request, 'attachmentId'),
      });
      return reply
        .header('content-type', result.contentType)
        .header('content-disposition', `attachment; filename="${encodeURIComponent(result.fileName)}"`)
        .status(200)
        .send(result.bytes);
    },
  );

  app.post(`${org}/ticket-sla-policies`, { preHandler: [...tenantAuth, requireManage] }, async (request, reply) => {
    const body = parseBody(createSlaPolicyBodySchema, request.body);
    const result = await useCases.createSlaPolicy.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      ...body,
    });
    return reply.status(201).send(result);
  });

  app.get(`${org}/ticket-sla-policies`, { preHandler: [...tenantAuth, requireManage] }, async (request, reply) => {
    const result = await useCases.listSlaPolicies.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
    });
    return reply.status(200).send(result);
  });

  app.patch(
    `${org}/ticket-sla-policies/:policyId`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const body = parseBody(updateSlaPolicyBodySchema, request.body);
      const result = await useCases.updateSlaPolicy.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        policyId: routeParam(request, 'policyId'),
        ...body,
      });
      return reply.status(200).send(result);
    },
  );

  app.delete(
    `${org}/ticket-sla-policies/:policyId`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      await useCases.deleteSlaPolicy.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        policyId: routeParam(request, 'policyId'),
      });
      return reply.status(204).send();
    },
  );

  app.post(
    `${org}/ticket-escalation-policies`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const body = parseBody(createEscalationPolicyBodySchema, request.body);
      const result = await useCases.createEscalationPolicy.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        ...body,
      });
      return reply.status(201).send(result);
    },
  );

  app.get(
    `${org}/ticket-escalation-policies`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const result = await useCases.listEscalationPolicies.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    `${org}/ticket-escalation-policies/evaluate`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const result = await useCases.evaluateEscalation.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.patch(
    `${org}/ticket-escalation-policies/:policyId`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const body = parseBody(updateEscalationPolicyBodySchema, request.body);
      const result = await useCases.updateEscalationPolicy.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        policyId: routeParam(request, 'policyId'),
        ...body,
      });
      return reply.status(200).send(result);
    },
  );

  app.delete(
    `${org}/ticket-escalation-policies/:policyId`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      await useCases.deleteEscalationPolicy.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        policyId: routeParam(request, 'policyId'),
      });
      return reply.status(204).send();
    },
  );
}

function requireUserId(request: FastifyRequest): string {
  if (!request.auth) {
    throw new UnauthorizedError();
  }
  return request.auth.userId;
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
