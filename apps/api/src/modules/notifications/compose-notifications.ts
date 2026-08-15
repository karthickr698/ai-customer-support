import type { EventBus, Logger } from '@ai-customer-support/shared';
import { NOTIFICATION_SOURCE_EVENTS } from '@ai-customer-support/contracts';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import type { QueuePort } from '../../shared/application/ports/queue-port.js';
import type { ResolveTenantAccessUseCase } from '../organizations/application/use-cases/resolve-tenant-access-use-case.js';
import {
  registerNotificationRoutes,
  type AuthenticatePreHandler,
} from './adapters/inbound/http/notification-routes.js';
import { SystemClock } from './adapters/outbound/clock/system-clock.js';
import { OrganizationsTenantAccessAdapter } from './adapters/outbound/organizations/organizations-tenant-access-adapter.js';
import {
  PostgresNotificationAttemptRepository,
  PostgresNotificationDeliveryRepository,
  PostgresNotificationInboxRepository,
  PostgresNotificationPreferenceRepository,
  PostgresNotificationTemplateRepository,
} from './adapters/outbound/persistence/postgres-notification-repositories.js';
import { ConsoleEmailProvider } from './adapters/outbound/providers/console-email-provider.js';
import { ConsoleSmsProvider } from './adapters/outbound/providers/console-sms-provider.js';
import { InAppNotificationProvider } from './adapters/outbound/providers/in-app-provider.js';
import { ChannelNotificationProviderRegistry } from './adapters/outbound/providers/notification-provider-registry.js';
import { SmtpEmailProvider } from './adapters/outbound/providers/smtp-email-provider.js';
import { WebhookNotificationProvider } from './adapters/outbound/providers/webhook-provider.js';
import { NOTIFICATION_DELIVER_QUEUE, type NotificationDeliverJob } from './application/queues.js';
import { DeliverNotificationUseCase } from './application/use-cases/deliver-notification-use-case.js';
import {
  DispatchNotificationsUseCase,
  GetNotificationDeliveryUseCase,
  ListNotificationAttemptsUseCase,
  ListNotificationDeliveriesUseCase,
  RetryNotificationDeliveryUseCase,
} from './application/use-cases/delivery-use-cases.js';
import { DispatchDueNotificationsUseCase } from './application/use-cases/dispatch-due-notifications-use-case.js';
import { EnqueueEventNotificationsUseCase } from './application/use-cases/enqueue-event-notifications-use-case.js';
import {
  ListNotificationInboxUseCase,
  MarkInboxItemReadUseCase,
  MarkInboxReadAllUseCase,
} from './application/use-cases/inbox-use-cases.js';
import {
  ListNotificationPreferencesUseCase,
  UpsertNotificationPreferencesUseCase,
} from './application/use-cases/preference-use-cases.js';
import { SendNotificationUseCase } from './application/use-cases/send-notification-use-case.js';
import {
  CreateNotificationTemplateUseCase,
  DeleteNotificationTemplateUseCase,
  GetNotificationTemplateUseCase,
  ListNotificationTemplatesUseCase,
  UpdateNotificationTemplateUseCase,
} from './application/use-cases/template-use-cases.js';
import { DISPATCH_INTERVAL_MS } from './domain/notification-policy.js';

export type NotificationsModule = {
  register(app: FastifyInstance): Promise<void>;
  start(): void;
  stop(): void;
};

export function composeNotifications(input: {
  readonly prisma: PrismaClient;
  readonly eventBus: EventBus;
  readonly queue: QueuePort;
  readonly logger: Logger;
  readonly authenticate: AuthenticatePreHandler;
  readonly resolveTenantAccess: ResolveTenantAccessUseCase;
  readonly emailFrom: string;
  readonly smtpUrl?: string;
  readonly nodeEnv: string;
  readonly allowLocalHttp: boolean;
  readonly webhookTimeoutMs?: number;
}): NotificationsModule {
  const tenantAccess = new OrganizationsTenantAccessAdapter(input.resolveTenantAccess);
  const clock = new SystemClock();
  const templates = new PostgresNotificationTemplateRepository(input.prisma);
  const deliveries = new PostgresNotificationDeliveryRepository(input.prisma);
  const attempts = new PostgresNotificationAttemptRepository(input.prisma);
  const preferences = new PostgresNotificationPreferenceRepository(input.prisma);
  const inbox = new PostgresNotificationInboxRepository(input.prisma);
  const providers = new ChannelNotificationProviderRegistry()
    .register(
      input.smtpUrl
        ? new SmtpEmailProvider(input.smtpUrl, input.emailFrom, input.logger)
        : new ConsoleEmailProvider(input.logger, input.emailFrom, input.nodeEnv),
    )
    .register(new InAppNotificationProvider(inbox, clock))
    .register(new ConsoleSmsProvider(input.logger, input.nodeEnv))
    .register(new WebhookNotificationProvider(input.webhookTimeoutMs ?? 10_000));

  const enqueueEvents = new EnqueueEventNotificationsUseCase(
    templates,
    deliveries,
    preferences,
    input.queue,
    clock,
    input.eventBus,
    input.logger,
    input.allowLocalHttp,
  );
  const dispatchDue = new DispatchDueNotificationsUseCase(deliveries, input.queue, clock, input.logger);
  const deliver = new DeliverNotificationUseCase(
    templates,
    deliveries,
    attempts,
    preferences,
    providers,
    clock,
    input.eventBus,
    input.logger,
  );

  input.queue.process<NotificationDeliverJob>(NOTIFICATION_DELIVER_QUEUE, (message) =>
    deliver.execute(message),
  );
  for (const eventName of NOTIFICATION_SOURCE_EVENTS) {
    input.eventBus.subscribe(eventName, (event) => enqueueEvents.handle(event));
  }

  let timer: NodeJS.Timeout | undefined;

  return {
    async register(app: FastifyInstance): Promise<void> {
      await registerNotificationRoutes(
        app,
        {
          createTemplate: new CreateNotificationTemplateUseCase(
            tenantAccess,
            templates,
            clock,
            input.eventBus,
            input.allowLocalHttp,
          ),
          listTemplates: new ListNotificationTemplatesUseCase(tenantAccess, templates),
          getTemplate: new GetNotificationTemplateUseCase(tenantAccess, templates),
          updateTemplate: new UpdateNotificationTemplateUseCase(
            tenantAccess,
            templates,
            clock,
            input.eventBus,
            input.allowLocalHttp,
          ),
          deleteTemplate: new DeleteNotificationTemplateUseCase(
            tenantAccess,
            templates,
            clock,
            input.eventBus,
          ),
          listPreferences: new ListNotificationPreferencesUseCase(tenantAccess, preferences),
          upsertPreferences: new UpsertNotificationPreferencesUseCase(tenantAccess, preferences, clock),
          send: new SendNotificationUseCase(
            tenantAccess,
            templates,
            deliveries,
            preferences,
            input.queue,
            clock,
            input.eventBus,
            input.allowLocalHttp,
          ),
          listDeliveries: new ListNotificationDeliveriesUseCase(tenantAccess, deliveries),
          getDelivery: new GetNotificationDeliveryUseCase(tenantAccess, deliveries),
          retryDelivery: new RetryNotificationDeliveryUseCase(
            tenantAccess,
            deliveries,
            input.queue,
            clock,
          ),
          listAttempts: new ListNotificationAttemptsUseCase(tenantAccess, attempts),
          dispatch: new DispatchNotificationsUseCase(tenantAccess, dispatchDue),
          listInbox: new ListNotificationInboxUseCase(tenantAccess, inbox),
          markInboxRead: new MarkInboxItemReadUseCase(tenantAccess, inbox, clock),
          markInboxReadAll: new MarkInboxReadAllUseCase(tenantAccess, inbox, clock),
        },
        input.authenticate,
        input.resolveTenantAccess,
      );
    },
    start(): void {
      timer = setInterval(() => {
        void dispatchDue.execute().catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Notification dispatch failed';
          input.logger.warn('Notification dispatch failed', { message });
        });
      }, DISPATCH_INTERVAL_MS);
      timer.unref();
    },
    stop(): void {
      if (timer) {
        clearInterval(timer);
      }
    },
  };
}
