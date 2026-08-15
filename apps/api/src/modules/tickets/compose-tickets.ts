import type { EventBus, Logger } from '@ai-customer-support/shared';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';
import type { AgentPresenceQuery } from '../agents/application/agent-presence-query.js';
import type { ConversationTicketSourceQuery } from '../conversations/application/conversation-ticket-source-query.js';
import type { IdentityUserQuery } from '../identity/application/identity-user-query.js';
import type { OrganizationMemberQuery } from '../organizations/application/organization-member-query.js';
import type { ResolveTenantAccessUseCase } from '../organizations/application/use-cases/resolve-tenant-access-use-case.js';
import {
  registerTicketRoutes,
  type AuthenticatePreHandler,
} from './adapters/inbound/http/ticket-routes.js';
import { TenantTicketToolAdapter } from './adapters/inbound/tools/tenant-ticket-tool-adapter.js';
import { AgentsAvailabilityAdapter } from './adapters/outbound/agents/agents-availability-adapter.js';
import { SystemClock } from './adapters/outbound/clock/system-clock.js';
import { ConversationsSourceAdapter } from './adapters/outbound/conversations/conversations-source-adapter.js';
import { IdentityUserDirectoryAdapter } from './adapters/outbound/identity/identity-user-directory-adapter.js';
import { OrganizationsMemberDirectoryAdapter } from './adapters/outbound/organizations/organizations-member-directory-adapter.js';
import { OrganizationsTenantAccessAdapter } from './adapters/outbound/organizations/organizations-tenant-access-adapter.js';
import {
  PostgresTicketAttachmentRepository,
  PostgresTicketEscalationPolicyRepository,
  PostgresTicketNoteRepository,
  PostgresTicketRepository,
  PostgresTicketSlaPolicyRepository,
} from './adapters/outbound/persistence/postgres-ticket-repositories.js';
import { RedisAssignmentCursorAdapter } from './adapters/outbound/redis/redis-assignment-cursor-adapter.js';
import { LocalTicketAttachmentStorageAdapter } from './adapters/outbound/storage/local-ticket-attachment-storage-adapter.js';
import { LoadAuthorizedTicketService } from './application/load-authorized-ticket-service.js';
import type { TicketIntakePort, TicketToolPort } from './application/ports.js';
import {
  GetTicketAttachmentUseCase,
  UploadTicketAttachmentUseCase,
} from './application/use-cases/attachment-use-cases.js';
import {
  AssignTicketToAvailableAgentUseCase,
  AssignTicketUseCase,
  EscalateTicketUseCase,
  UnassignTicketUseCase,
} from './application/use-cases/assignment-use-cases.js';
import {
  CreateTicketEscalationPolicyUseCase,
  DeleteTicketEscalationPolicyUseCase,
  EvaluateTicketEscalationUseCase,
  ListTicketEscalationPoliciesUseCase,
  UpdateTicketEscalationPolicyUseCase,
} from './application/use-cases/escalation-policy-use-cases.js';
import { AddTicketNoteUseCase, ListTicketNotesUseCase } from './application/use-cases/note-use-cases.js';
import { OpenTicketFromConversationUseCase } from './application/use-cases/open-ticket-from-conversation-use-case.js';
import {
  CreateTicketSlaPolicyUseCase,
  DeleteTicketSlaPolicyUseCase,
  ListTicketSlaPoliciesUseCase,
  UpdateTicketSlaPolicyUseCase,
} from './application/use-cases/sla-policy-use-cases.js';
import {
  ChangeTicketStatusUseCase,
  CreateTicketUseCase,
  GetTicketUseCase,
  ListTicketsUseCase,
} from './application/use-cases/ticket-use-cases.js';
import { SLA_EVALUATION_INTERVAL_MS } from './domain/ticket-policy.js';

export type TicketsModule = {
  readonly openFromConversation: TicketIntakePort;
  readonly ticketTools: TicketToolPort;
  register(app: FastifyInstance): Promise<void>;
  start(): void;
  stop(): void;
};

export function composeTickets(input: {
  readonly prisma: PrismaClient;
  readonly redis: Redis;
  readonly eventBus: EventBus;
  readonly logger: Logger;
  readonly authenticate: AuthenticatePreHandler;
  readonly resolveTenantAccess: ResolveTenantAccessUseCase;
  readonly memberQuery: OrganizationMemberQuery;
  readonly userDirectory: IdentityUserQuery;
  readonly presenceQuery: AgentPresenceQuery;
  readonly conversationSource: ConversationTicketSourceQuery;
  readonly attachmentStorageDir: string;
}): TicketsModule {
  const tenantAccess = new OrganizationsTenantAccessAdapter(input.resolveTenantAccess);
  const clock = new SystemClock();
  const tickets = new PostgresTicketRepository(input.prisma);
  const notes = new PostgresTicketNoteRepository(input.prisma);
  const attachments = new PostgresTicketAttachmentRepository(input.prisma);
  const slaPolicies = new PostgresTicketSlaPolicyRepository(input.prisma);
  const escalationPolicies = new PostgresTicketEscalationPolicyRepository(input.prisma);
  const conversationSource = new ConversationsSourceAdapter(input.conversationSource);
  const members = new OrganizationsMemberDirectoryAdapter(input.memberQuery);
  const users = new IdentityUserDirectoryAdapter(input.userDirectory);
  const availability = new AgentsAvailabilityAdapter(input.presenceQuery);
  const cursor = new RedisAssignmentCursorAdapter(input.redis);
  const storage = new LocalTicketAttachmentStorageAdapter(input.attachmentStorageDir);
  const authorized = new LoadAuthorizedTicketService(tenantAccess, tickets);
  const evaluateEscalation = new EvaluateTicketEscalationUseCase(
    tenantAccess,
    escalationPolicies,
    tickets,
    members,
    availability,
    cursor,
    clock,
    input.eventBus,
    input.logger,
  );
  const openFromConversation = new OpenTicketFromConversationUseCase(
    tickets,
    slaPolicies,
    clock,
    input.eventBus,
  );

  let timer: NodeJS.Timeout | undefined;

  return {
    openFromConversation,
    ticketTools: new TenantTicketToolAdapter(
      tenantAccess,
      tickets,
      notes,
      slaPolicies,
      conversationSource,
      users,
      clock,
      input.eventBus,
    ),
    async register(app: FastifyInstance): Promise<void> {
      await registerTicketRoutes(
        app,
        {
          createTicket: new CreateTicketUseCase(
            tenantAccess,
            tickets,
            slaPolicies,
            conversationSource,
            users,
            clock,
            input.eventBus,
          ),
          getTicket: new GetTicketUseCase(authorized, users),
          listTickets: new ListTicketsUseCase(tenantAccess, tickets, users),
          changeTicketStatus: new ChangeTicketStatusUseCase(
            authorized,
            tickets,
            users,
            clock,
            input.eventBus,
          ),
          assignTicket: new AssignTicketUseCase(
            authorized,
            tickets,
            members,
            users,
            clock,
            input.eventBus,
          ),
          assignToAvailable: new AssignTicketToAvailableAgentUseCase(
            authorized,
            tickets,
            members,
            availability,
            cursor,
            users,
            clock,
            input.eventBus,
          ),
          unassignTicket: new UnassignTicketUseCase(authorized, tickets, users, clock, input.eventBus),
          escalateTicket: new EscalateTicketUseCase(authorized, tickets, users, clock, input.eventBus),
          addNote: new AddTicketNoteUseCase(authorized, tickets, notes, clock, input.eventBus),
          listNotes: new ListTicketNotesUseCase(authorized, notes),
          uploadAttachment: new UploadTicketAttachmentUseCase(
            authorized,
            attachments,
            storage,
            clock,
            input.eventBus,
          ),
          getAttachment: new GetTicketAttachmentUseCase(authorized, attachments, storage),
          createSlaPolicy: new CreateTicketSlaPolicyUseCase(tenantAccess, slaPolicies, clock),
          listSlaPolicies: new ListTicketSlaPoliciesUseCase(tenantAccess, slaPolicies),
          updateSlaPolicy: new UpdateTicketSlaPolicyUseCase(tenantAccess, slaPolicies, clock),
          deleteSlaPolicy: new DeleteTicketSlaPolicyUseCase(tenantAccess, slaPolicies),
          createEscalationPolicy: new CreateTicketEscalationPolicyUseCase(
            tenantAccess,
            escalationPolicies,
            clock,
          ),
          listEscalationPolicies: new ListTicketEscalationPoliciesUseCase(tenantAccess, escalationPolicies),
          updateEscalationPolicy: new UpdateTicketEscalationPolicyUseCase(
            tenantAccess,
            escalationPolicies,
            clock,
          ),
          deleteEscalationPolicy: new DeleteTicketEscalationPolicyUseCase(
            tenantAccess,
            escalationPolicies,
          ),
          evaluateEscalation,
        },
        input.authenticate,
        input.resolveTenantAccess,
      );
    },
    start(): void {
      timer = setInterval(() => {
        void evaluateEscalation.execute().catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Ticket SLA evaluation failed';
          input.logger.warn('Ticket SLA evaluation failed', { message });
        });
      }, SLA_EVALUATION_INTERVAL_MS);
      timer.unref();
    },
    stop(): void {
      if (timer) {
        clearInterval(timer);
      }
    },
  };
}
