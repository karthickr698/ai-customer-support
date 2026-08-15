import type { EventBus } from '@ai-customer-support/shared';
import type {
  NotificationTemplateListResponse,
  NotificationTemplateResponse,
} from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import {
  DuplicateNotificationTemplateError,
  InvalidNotificationError,
  NotificationTemplateNotFoundError,
  TooManyNotificationRecordsError,
} from '../../domain/errors.js';
import {
  NotificationTemplateCreatedEvent,
  NotificationTemplateDeletedEvent,
  NotificationTemplateUpdatedEvent,
} from '../../domain/events.js';
import { createNotificationTemplateId } from '../../domain/ids.js';
import { MAX_TEMPLATES_PER_TENANT, NotificationPolicy } from '../../domain/notification-policy.js';
import { NotificationTemplate } from '../../domain/notification-template.js';
import { isUuid } from '../../domain/values.js';
import { toTemplateDto, type RequestSecurityContext } from '../dtos.js';
import type { ClockPort, NotificationTemplateRepository, TenantAccessPort } from '../ports.js';

export class CreateNotificationTemplateUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly templates: NotificationTemplateRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly allowLocalHttp: boolean,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly name: string;
    readonly slug: string;
    readonly channel: string;
    readonly eventType: string;
    readonly body: string;
    readonly subject?: string;
    readonly recipientType: string;
    readonly recipientField?: string;
    readonly enabled?: boolean;
    readonly maxAttempts?: number;
    readonly backoffMs?: number;
    readonly security: RequestSecurityContext;
  }): Promise<NotificationTemplateResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    NotificationPolicy.assertPermission(actor.permissions, Permissions.NOTIFICATION_MANAGE);
    const count = await this.templates.countByTenant(actor.tenantId);
    if (count >= MAX_TEMPLATES_PER_TENANT) {
      throw new TooManyNotificationRecordsError('notification templates');
    }
    const existing = await this.templates.findBySlug(actor.tenantId, input.slug.trim().toLowerCase());
    if (existing) {
      throw new DuplicateNotificationTemplateError();
    }
    const template = NotificationTemplate.create({
      organizationId: actor.tenantId,
      name: input.name,
      slug: input.slug,
      channel: input.channel,
      eventType: input.eventType,
      body: input.body,
      createdByUserId: actor.actorId,
      now: this.clock.now(),
      subject: input.subject,
      recipientType: input.recipientType,
      recipientField: input.recipientField,
      enabled: input.enabled,
      maxAttempts: input.maxAttempts,
      backoffMs: input.backoffMs,
      allowLocalHttp: this.allowLocalHttp,
    });
    await this.templates.save(template);
    await this.eventBus.publish(
      new NotificationTemplateCreatedEvent(
        crypto.randomUUID(),
        this.clock.now(),
        actor.tenantId,
        template.id,
        actor.actorId,
        input.security.correlationId,
      ),
    );
    return { template: toTemplateDto(template) };
  }
}

export class ListNotificationTemplatesUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly templates: NotificationTemplateRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
  }): Promise<NotificationTemplateListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    NotificationPolicy.assertPermission(actor.permissions, Permissions.NOTIFICATION_READ);
    const items = await this.templates.listByTenant(actor.tenantId);
    return { items: items.filter((template) => template.belongsTo(actor.tenantId)).map(toTemplateDto) };
  }
}

export class GetNotificationTemplateUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly templates: NotificationTemplateRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly templateId: string;
  }): Promise<NotificationTemplateResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    NotificationPolicy.assertPermission(actor.permissions, Permissions.NOTIFICATION_READ);
    const template = await loadTemplate(this.templates, actor.tenantId, input.templateId);
    return { template: toTemplateDto(template) };
  }
}

export class UpdateNotificationTemplateUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly templates: NotificationTemplateRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly allowLocalHttp: boolean,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly templateId: string;
    readonly name?: string;
    readonly slug?: string;
    readonly channel?: string;
    readonly eventType?: string;
    readonly subject?: string | null;
    readonly body?: string;
    readonly recipientType?: string;
    readonly recipientField?: string | null;
    readonly enabled?: boolean;
    readonly maxAttempts?: number;
    readonly backoffMs?: number;
    readonly security: RequestSecurityContext;
  }): Promise<NotificationTemplateResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    NotificationPolicy.assertPermission(actor.permissions, Permissions.NOTIFICATION_MANAGE);
    const template = await loadTemplate(this.templates, actor.tenantId, input.templateId);
    if (input.slug !== undefined) {
      const slug = input.slug.trim().toLowerCase();
      const existing = await this.templates.findBySlug(actor.tenantId, slug);
      if (existing && existing.id !== template.id) {
        throw new DuplicateNotificationTemplateError();
      }
    }
    template.update(
      {
        name: input.name,
        slug: input.slug,
        channel: input.channel,
        eventType: input.eventType,
        subject: input.subject,
        body: input.body,
        recipientType: input.recipientType,
        recipientField: input.recipientField,
        enabled: input.enabled,
        maxAttempts: input.maxAttempts,
        backoffMs: input.backoffMs,
        allowLocalHttp: this.allowLocalHttp,
      },
      this.clock.now(),
    );
    await this.templates.save(template);
    await this.eventBus.publish(
      new NotificationTemplateUpdatedEvent(
        crypto.randomUUID(),
        this.clock.now(),
        actor.tenantId,
        template.id,
        actor.actorId,
        input.security.correlationId,
      ),
    );
    return { template: toTemplateDto(template) };
  }
}

export class DeleteNotificationTemplateUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly templates: NotificationTemplateRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly templateId: string;
    readonly security: RequestSecurityContext;
  }): Promise<void> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    NotificationPolicy.assertPermission(actor.permissions, Permissions.NOTIFICATION_MANAGE);
    const template = await loadTemplate(this.templates, actor.tenantId, input.templateId);
    await this.templates.delete(actor.tenantId, template.id);
    await this.eventBus.publish(
      new NotificationTemplateDeletedEvent(
        crypto.randomUUID(),
        this.clock.now(),
        actor.tenantId,
        template.id,
        actor.actorId,
        input.security.correlationId,
      ),
    );
  }
}

export async function loadTemplate(
  templates: NotificationTemplateRepository,
  tenantId: string,
  templateId: string,
): Promise<NotificationTemplate> {
  if (!isUuid(templateId)) {
    throw new InvalidNotificationError('templateId must be a UUID');
  }
  const template = await templates.findById(tenantId, createNotificationTemplateId(templateId));
  if (!template || !template.belongsTo(tenantId)) {
    throw new NotificationTemplateNotFoundError();
  }
  return template;
}
