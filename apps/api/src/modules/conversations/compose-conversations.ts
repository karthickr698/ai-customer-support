import type { EventBus } from '@ai-customer-support/shared';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import type { IdentityUserQuery } from '../identity/application/identity-user-query.js';
import type { OrganizationMemberQuery } from '../organizations/application/organization-member-query.js';
import type { ResolveTenantAccessUseCase } from '../organizations/application/use-cases/resolve-tenant-access-use-case.js';
import {
  registerConversationRoutes,
  type AuthenticatePreHandler,
} from './adapters/inbound/http/conversation-routes.js';
import { SystemClock } from './adapters/outbound/clock/system-clock.js';
import { OrganizationsMemberDirectoryAdapter } from './adapters/outbound/organizations/organizations-member-directory-adapter.js';
import { OrganizationsTenantAccessAdapter } from './adapters/outbound/organizations/organizations-tenant-access-adapter.js';
import { PostgresConversationNoteRepository } from './adapters/outbound/persistence/postgres-conversation-note-repository.js';
import { PostgresConversationRepository } from './adapters/outbound/persistence/postgres-conversation-repository.js';
import { PostgresMessageRepository } from './adapters/outbound/persistence/postgres-message-repository.js';
import { LoadAuthorizedConversationService } from './application/load-authorized-conversation-service.js';
import { AddConversationNoteUseCase } from './application/use-cases/add-conversation-note-use-case.js';
import { AddConversationTagUseCase } from './application/use-cases/add-conversation-tag-use-case.js';
import { AssignConversationUseCase } from './application/use-cases/assign-conversation-use-case.js';
import { ChangeConversationStatusUseCase } from './application/use-cases/change-conversation-status-use-case.js';
import { CreateConversationUseCase } from './application/use-cases/create-conversation-use-case.js';
import { EscalateConversationUseCase } from './application/use-cases/escalate-conversation-use-case.js';
import { GetConversationUseCase } from './application/use-cases/get-conversation-use-case.js';
import { ListConversationNotesUseCase } from './application/use-cases/list-conversation-notes-use-case.js';
import { ListConversationsUseCase } from './application/use-cases/list-conversations-use-case.js';
import { ListMessagesUseCase } from './application/use-cases/list-messages-use-case.js';
import { RemoveConversationTagUseCase } from './application/use-cases/remove-conversation-tag-use-case.js';
import { SendMessageUseCase } from './application/use-cases/send-message-use-case.js';
import { UnassignConversationUseCase } from './application/use-cases/unassign-conversation-use-case.js';

export type ConversationsHttpRegistrar = {
  register(app: FastifyInstance): Promise<void>;
};

export function composeConversations(input: {
  readonly prisma: PrismaClient;
  readonly eventBus: EventBus;
  readonly authenticate: AuthenticatePreHandler;
  readonly resolveTenantAccess: ResolveTenantAccessUseCase;
  readonly memberQuery: OrganizationMemberQuery;
  readonly userDirectory: IdentityUserQuery;
}): ConversationsHttpRegistrar {
  const conversations = new PostgresConversationRepository(input.prisma);
  const messages = new PostgresMessageRepository(input.prisma);
  const notes = new PostgresConversationNoteRepository(input.prisma);
  const clock = new SystemClock();
  const tenantAccess = new OrganizationsTenantAccessAdapter(input.resolveTenantAccess);
  const members = new OrganizationsMemberDirectoryAdapter(input.memberQuery);
  const authorized = new LoadAuthorizedConversationService(tenantAccess, conversations);

  const useCases = {
    createConversation: new CreateConversationUseCase(
      tenantAccess,
      conversations,
      messages,
      members,
      input.userDirectory,
      clock,
      input.eventBus,
    ),
    listConversations: new ListConversationsUseCase(
      tenantAccess,
      conversations,
      input.userDirectory,
    ),
    getConversation: new GetConversationUseCase(authorized, input.userDirectory),
    changeConversationStatus: new ChangeConversationStatusUseCase(
      authorized,
      conversations,
      input.userDirectory,
      clock,
      input.eventBus,
    ),
    assignConversation: new AssignConversationUseCase(
      authorized,
      conversations,
      members,
      input.userDirectory,
      clock,
      input.eventBus,
    ),
    unassignConversation: new UnassignConversationUseCase(
      authorized,
      conversations,
      clock,
      input.eventBus,
    ),
    escalateConversation: new EscalateConversationUseCase(
      authorized,
      conversations,
      input.userDirectory,
      clock,
      input.eventBus,
    ),
    addConversationTag: new AddConversationTagUseCase(
      authorized,
      conversations,
      input.userDirectory,
      clock,
    ),
    removeConversationTag: new RemoveConversationTagUseCase(
      authorized,
      conversations,
      input.userDirectory,
      clock,
    ),
    sendMessage: new SendMessageUseCase(
      authorized,
      conversations,
      messages,
      input.userDirectory,
      clock,
      input.eventBus,
    ),
    listMessages: new ListMessagesUseCase(authorized, messages),
    addConversationNote: new AddConversationNoteUseCase(authorized, notes, clock, input.eventBus),
    listConversationNotes: new ListConversationNotesUseCase(authorized, notes),
  };

  return {
    async register(app: FastifyInstance): Promise<void> {
      await registerConversationRoutes(
        app,
        useCases,
        input.authenticate,
        input.resolveTenantAccess,
      );
    },
  };
}
