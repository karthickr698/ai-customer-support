import type { EventBus, Logger } from '@ai-customer-support/shared';
import type { AIServicePort } from '../ai/application/ports/ai-service-port.js';
import type { AgentSettingsQuery } from '../onboarding/application/agent-settings-query.js';
import type { WidgetSessionContextPort } from './application/ports/widget-session-context-port.js';
import type { TicketIntakePort } from './application/ports/ticket-intake-port.js';
import { registerWidgetConversationRoutes, type WidgetAuthenticatePreHandler } from './adapters/inbound/http/widget-conversation-routes.js';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';
import type { AgentPresenceQuery } from '../agents/application/agent-presence-query.js';
import type {
  ConnectAgentPresenceUseCase,
  DisconnectAgentPresenceUseCase,
  HeartbeatAgentPresenceUseCase,
  SetAgentPresenceStatusUseCase,
} from '../agents/application/use-cases/mutate-agent-presence-use-cases.js';
import type { ListAgentPresenceUseCase } from '../agents/application/use-cases/list-and-set-agent-presence-use-cases.js';
import type { IdentityUserQuery } from '../identity/application/identity-user-query.js';
import type { OrganizationMemberQuery } from '../organizations/application/organization-member-query.js';
import type { ResolveTenantAccessUseCase } from '../organizations/application/use-cases/resolve-tenant-access-use-case.js';
import {
  registerConversationRoutes,
  type AuthenticatePreHandler,
} from './adapters/inbound/http/conversation-routes.js';
import { registerEscalationAndRealtimeHttpRoutes } from './adapters/inbound/http/escalation-realtime-routes.js';
import { RealtimeConnectionHub } from './adapters/inbound/websocket/realtime-connection-hub.js';
import { registerRealtimeWebsocket } from './adapters/inbound/websocket/register-realtime-websocket.js';
import { AgentsAvailabilityAdapter } from './adapters/outbound/agents/agents-availability-adapter.js';
import { SystemClock } from './adapters/outbound/clock/system-clock.js';
import { OrganizationsMemberDirectoryAdapter } from './adapters/outbound/organizations/organizations-member-directory-adapter.js';
import { OrganizationsTenantAccessAdapter } from './adapters/outbound/organizations/organizations-tenant-access-adapter.js';
import { PostgresConversationNoteRepository } from './adapters/outbound/persistence/postgres-conversation-note-repository.js';
import { PostgresConversationRepository } from './adapters/outbound/persistence/postgres-conversation-repository.js';
import { PostgresEscalationRuleRepository } from './adapters/outbound/persistence/postgres-escalation-rule-repository.js';
import { PostgresMessageRepository } from './adapters/outbound/persistence/postgres-message-repository.js';
import { PostgresMessageAttachmentRepository } from './adapters/outbound/persistence/postgres-message-attachment-repository.js';
import { PostgresMessageFeedbackRepository } from './adapters/outbound/persistence/postgres-message-feedback-repository.js';
import { LocalAttachmentStorageAdapter } from './adapters/outbound/storage/local-attachment-storage-adapter.js';
import { OnboardingAgentSettingsAdapter } from './adapters/outbound/onboarding/onboarding-agent-settings-adapter.js';
import { RedisAssignmentCursorAdapter } from './adapters/outbound/redis/redis-assignment-cursor-adapter.js';
import {
  FANOUT_CHANNEL,
  RedisRealtimeEventLog,
} from './adapters/outbound/redis/redis-realtime-event-log.js';
import { LoadAuthorizedConversationService } from './application/load-authorized-conversation-service.js';
import { LoadWidgetConversationService } from './application/load-widget-conversation-service.js';
import {
  GetConversationAttachmentUseCase,
  GetWidgetAttachmentUseCase,
  UploadConversationAttachmentUseCase,
  UploadWidgetAttachmentUseCase,
} from './application/use-cases/attachment-use-cases.js';
import { ChangeWidgetConversationStatusUseCase } from './application/use-cases/change-widget-conversation-status-use-case.js';
import {
  GetWidgetConversationUseCase,
  ListWidgetConversationsUseCase,
} from './application/use-cases/list-widget-conversations-use-case.js';
import { ListWidgetMessagesUseCase } from './application/use-cases/list-widget-messages-use-case.js';
import { SendWidgetMessageUseCase } from './application/use-cases/send-widget-message-use-case.js';
import { StartWidgetConversationUseCase } from './application/use-cases/start-widget-conversation-use-case.js';
import { StreamWidgetAiReplyUseCase } from './application/use-cases/stream-widget-ai-reply-use-case.js';
import { SubmitWidgetMessageFeedbackUseCase } from './application/use-cases/submit-widget-message-feedback-use-case.js';
import { toRealtimeSupportEvent } from './application/to-realtime-support-event.js';
import { AddConversationNoteUseCase } from './application/use-cases/add-conversation-note-use-case.js';
import { AddConversationTagUseCase } from './application/use-cases/add-conversation-tag-use-case.js';
import { AssignConversationUseCase } from './application/use-cases/assign-conversation-use-case.js';
import { AssignToAvailableAgentUseCase } from './application/use-cases/assign-to-available-agent-use-case.js';
import { ChangeConversationPriorityUseCase } from './application/use-cases/change-conversation-priority-use-case.js';
import { ChangeConversationStatusUseCase } from './application/use-cases/change-conversation-status-use-case.js';
import { CreateConversationUseCase } from './application/use-cases/create-conversation-use-case.js';
import { CreateEscalationRuleUseCase } from './application/use-cases/create-escalation-rule-use-case.js';
import { EscalateConversationUseCase } from './application/use-cases/escalate-conversation-use-case.js';
import { EvaluateEscalationRulesUseCase } from './application/use-cases/evaluate-escalation-rules-use-case.js';
import { GetConversationUseCase } from './application/use-cases/get-conversation-use-case.js';
import { ListConversationNotesUseCase } from './application/use-cases/list-conversation-notes-use-case.js';
import { ListConversationsUseCase } from './application/use-cases/list-conversations-use-case.js';
import { ListEscalationRulesUseCase } from './application/use-cases/list-escalation-rules-use-case.js';
import { ListMessagesUseCase } from './application/use-cases/list-messages-use-case.js';
import { RemoveConversationTagUseCase } from './application/use-cases/remove-conversation-tag-use-case.js';
import { ReplayRealtimeEventsUseCase } from './application/use-cases/replay-realtime-events-use-case.js';
import { SendMessageUseCase } from './application/use-cases/send-message-use-case.js';
import { UnassignConversationUseCase } from './application/use-cases/unassign-conversation-use-case.js';
import {
  DeleteEscalationRuleUseCase,
  UpdateEscalationRuleUseCase,
} from './application/use-cases/update-escalation-rule-use-case.js';
import { ESCALATION_EVALUATION_INTERVAL_MS } from './domain/support-constants.js';
import type { MessageRepository } from './application/ports/message-repository.js';

const REALTIME_DOMAIN_EVENTS = [
  'ConversationCreated',
  'MessageReceived',
  'MessageSent',
  'ConversationStatusChanged',
  'ConversationPriorityChanged',
  'ConversationEscalated',
  'AgentAssigned',
  'AgentUnassigned',
  'ConversationNoteAdded',
  'AgentPresenceChanged',
] as const;

export type ConversationsHttpRegistrar = {
  register(app: FastifyInstance): Promise<void>;
  start(): void;
  stop(): Promise<void>;
};

export function composeConversations(input: {
  readonly prisma: PrismaClient;
  readonly redis: Redis;
  readonly eventBus: EventBus;
  readonly logger: Logger;
  readonly authenticate: AuthenticatePreHandler;
  readonly resolveTenantAccess: ResolveTenantAccessUseCase;
  readonly memberQuery: OrganizationMemberQuery;
  readonly userDirectory: IdentityUserQuery;
  readonly presenceQuery: AgentPresenceQuery;
  readonly listPresence: ListAgentPresenceUseCase;
  readonly connectPresence: ConnectAgentPresenceUseCase;
  readonly disconnectPresence: DisconnectAgentPresenceUseCase;
  readonly heartbeatPresence: HeartbeatAgentPresenceUseCase;
  readonly setPresence: SetAgentPresenceStatusUseCase;
  readonly aiService: AIServicePort;
  readonly agentSettingsQuery: AgentSettingsQuery;
  readonly widgetSessionContext: WidgetSessionContextPort;
  readonly authenticateWidgetSession: WidgetAuthenticatePreHandler;
  readonly attachmentStorageDir: string;
  readonly ticketIntake?: TicketIntakePort;
}): ConversationsHttpRegistrar {
  const conversations = new PostgresConversationRepository(input.prisma);
  const messages = new PostgresMessageRepository(input.prisma);
  const notes = new PostgresConversationNoteRepository(input.prisma);
  const rules = new PostgresEscalationRuleRepository(input.prisma);
  const attachments = new PostgresMessageAttachmentRepository(input.prisma);
  const feedbacks = new PostgresMessageFeedbackRepository(input.prisma);
  const storage = new LocalAttachmentStorageAdapter(input.attachmentStorageDir);
  const agentSettings = new OnboardingAgentSettingsAdapter(input.agentSettingsQuery);
  const clock = new SystemClock();
  const tenantAccess = new OrganizationsTenantAccessAdapter(input.resolveTenantAccess);
  const members = new OrganizationsMemberDirectoryAdapter(input.memberQuery);
  const availability = new AgentsAvailabilityAdapter(input.presenceQuery);
  const cursor = new RedisAssignmentCursorAdapter(input.redis);
  const authorized = new LoadAuthorizedConversationService(tenantAccess, conversations);
  const widgetAuthorized = new LoadWidgetConversationService(
    input.widgetSessionContext,
    conversations,
  );
  const hub = new RealtimeConnectionHub();
  const eventLog = new RedisRealtimeEventLog(input.redis);
  const subscriber = input.redis.duplicate();
  const evaluateEscalationRules = new EvaluateEscalationRulesUseCase(
    tenantAccess,
    rules,
    conversations,
    members,
    availability,
    cursor,
    clock,
    input.eventBus,
    input.logger,
    input.ticketIntake,
  );
  const replayRealtimeEvents = new ReplayRealtimeEventsUseCase(tenantAccess, eventLog);

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
    changeConversationPriority: new ChangeConversationPriorityUseCase(
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
    assignToAvailableAgent: new AssignToAvailableAgentUseCase(
      authorized,
      conversations,
      members,
      availability,
      cursor,
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
      input.ticketIntake,
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
      attachments,
      input.userDirectory,
      clock,
      input.eventBus,
    ),
    listMessages: new ListMessagesUseCase(authorized, messages, attachments),
    addConversationNote: new AddConversationNoteUseCase(authorized, notes, clock, input.eventBus),
    listConversationNotes: new ListConversationNotesUseCase(authorized, notes),
    uploadConversationAttachment: new UploadConversationAttachmentUseCase(
      authorized,
      attachments,
      storage,
      clock,
      input.eventBus,
    ),
    getConversationAttachment: new GetConversationAttachmentUseCase(
      authorized,
      attachments,
      storage,
    ),
    startWidgetConversation: new StartWidgetConversationUseCase(
      input.widgetSessionContext,
      conversations,
      messages,
      attachments,
      clock,
      input.eventBus,
    ),
    listWidgetConversations: new ListWidgetConversationsUseCase(
      input.widgetSessionContext,
      conversations,
    ),
    getWidgetConversation: new GetWidgetConversationUseCase(widgetAuthorized),
    changeWidgetConversationStatus: new ChangeWidgetConversationStatusUseCase(
      widgetAuthorized,
      conversations,
      clock,
      input.eventBus,
    ),
    sendWidgetMessage: new SendWidgetMessageUseCase(
      widgetAuthorized,
      conversations,
      messages,
      attachments,
      clock,
      input.eventBus,
    ),
    listWidgetMessages: new ListWidgetMessagesUseCase(
      widgetAuthorized,
      messages,
      attachments,
      feedbacks,
    ),
    streamWidgetAiReply: new StreamWidgetAiReplyUseCase(
      widgetAuthorized,
      conversations,
      messages,
      attachments,
      agentSettings,
      input.aiService,
      clock,
      input.eventBus,
    ),
    submitWidgetMessageFeedback: new SubmitWidgetMessageFeedbackUseCase(
      widgetAuthorized,
      messages,
      feedbacks,
      clock,
      input.eventBus,
    ),
    uploadWidgetAttachment: new UploadWidgetAttachmentUseCase(
      widgetAuthorized,
      attachments,
      storage,
      clock,
      input.eventBus,
    ),
    getWidgetAttachment: new GetWidgetAttachmentUseCase(widgetAuthorized, attachments, storage),
    createEscalationRule: new CreateEscalationRuleUseCase(tenantAccess, rules, clock),
    listEscalationRules: new ListEscalationRulesUseCase(tenantAccess, rules),
    updateEscalationRule: new UpdateEscalationRuleUseCase(tenantAccess, rules, clock),
    deleteEscalationRule: new DeleteEscalationRuleUseCase(tenantAccess, rules),
    evaluateEscalationRules,
    replayRealtimeEvents,
  };

  subscribeRealtime(input.eventBus, eventLog);
  subscribeEscalation(input.eventBus, evaluateEscalationRules, messages, input.logger);

  let timer: NodeJS.Timeout | undefined;

  return {
    async register(app: FastifyInstance): Promise<void> {
      await registerConversationRoutes(
        app,
        useCases,
        input.authenticate,
        input.resolveTenantAccess,
      );
      await registerWidgetConversationRoutes(
        app,
        useCases,
        input.authenticateWidgetSession,
      );
      await registerEscalationAndRealtimeHttpRoutes(
        app,
        useCases,
        input.authenticate,
        input.resolveTenantAccess,
      );
      await registerRealtimeWebsocket(app, {
        hub,
        authenticate: input.authenticate,
        resolveTenantAccess: input.resolveTenantAccess,
        replayRealtimeEvents,
        listPresence: input.listPresence,
        connectPresence: input.connectPresence,
        disconnectPresence: input.disconnectPresence,
        heartbeatPresence: input.heartbeatPresence,
        setPresence: input.setPresence,
        logger: input.logger,
      });
    },
    start(): void {
      void subscriber.connect().then(
        async () => {
          await subscriber.subscribe(FANOUT_CHANNEL);
          subscriber.on('message', (_channel, payload) => {
            try {
              hub.sendToTenant(JSON.parse(payload));
            } catch (error: unknown) {
              const message = error instanceof Error ? error.message : 'Invalid realtime fanout payload';
              input.logger.warn('Realtime fanout failed', { message });
            }
          });
        },
        (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Realtime subscriber failed';
          input.logger.error('Realtime subscriber failed', { message });
        },
      );

      timer = setInterval(() => {
        void evaluateEscalationRules.execute({ type: 'due' }).catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Escalation evaluation failed';
          input.logger.warn('Escalation evaluation failed', { message });
        });
      }, ESCALATION_EVALUATION_INTERVAL_MS);
      timer.unref();
    },
    async stop(): Promise<void> {
      if (timer) {
        clearInterval(timer);
      }

      try {
        await subscriber.unsubscribe(FANOUT_CHANNEL);
        await subscriber.quit();
      } catch {
        subscriber.disconnect();
      }
    },
  };
}

function subscribeRealtime(eventBus: EventBus, eventLog: RedisRealtimeEventLog): void {
  for (const eventName of REALTIME_DOMAIN_EVENTS) {
    eventBus.subscribe(eventName, async (event) => {
      const mapped = toRealtimeSupportEvent(event);
      if (!mapped) {
        return;
      }

      await eventLog.publish(mapped);
    });
  }
}

function subscribeEscalation(
  eventBus: EventBus,
  evaluate: EvaluateEscalationRulesUseCase,
  messages: MessageRepository,
  logger: Logger,
): void {
  eventBus.subscribe('MessageReceived', async (event) => {
    const tenantId = event.tenantId;
    const conversationId = (event as { conversationId?: string }).conversationId;
    const messageId = (event as { messageId?: string }).messageId;
    if (!tenantId || !conversationId || !messageId) {
      return;
    }

    const message = await messages.findById(tenantId, messageId);
    if (!message) {
      return;
    }

    await evaluate.execute({
      type: 'message',
      tenantId,
      conversationId,
      messageBody: message.body,
    });
  });

  eventBus.subscribe('AgentPresenceChanged', async (event) => {
    const status = (event as { status?: string }).status;
    const agentId = (event as { agentId?: string }).agentId;
    if (!event.tenantId || !agentId || status !== 'offline') {
      return;
    }

    try {
      await evaluate.execute({
        type: 'agent_offline',
        tenantId: event.tenantId,
        agentId,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Offline escalation failed';
      logger.warn('Offline escalation failed', { message, tenantId: event.tenantId, agentId });
    }
  });
}
