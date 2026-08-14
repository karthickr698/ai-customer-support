import type { EventBus } from '@ai-customer-support/shared';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { WidgetConfiguration } from '../../domain/widget-configuration.js';
import { WidgetConfigurationUpdatedEvent } from '../../domain/events.js';
import { WidgetPolicy } from '../../domain/widget-policy.js';
import { toWidgetConfigurationDto, type RequestSecurityContext } from '../dtos.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { TenantAccessPort } from '../ports/tenant-access-port.js';
import type { WidgetConfigurationRepository } from '../ports/widget-configuration-repository.js';

export class GetWidgetConfigurationUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly widgets: WidgetConfigurationRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: { readonly tenantId: string; readonly actorId: string }) {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    WidgetPolicy.assertPermission(actor.permissions, Permissions.ORGANIZATION_READ);
    const widget = await loadOrCreateWidget(this.widgets, actor.tenantId, this.clock.now());
    return { widget: toWidgetConfigurationDto(widget) };
  }
}

export class UpdateWidgetConfigurationUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly widgets: WidgetConfigurationRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly enabled?: boolean;
    readonly title?: string;
    readonly greeting?: string;
    readonly primaryColor?: string;
    readonly position?: string;
    readonly launcherText?: string;
    readonly collectEmail?: boolean;
    readonly allowAnonymous?: boolean;
    readonly allowAttachments?: boolean;
    readonly aiEnabled?: boolean;
    readonly offlineMessage?: string;
    readonly allowedOrigins?: readonly string[];
    readonly security: RequestSecurityContext;
  }) {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    WidgetPolicy.assertPermission(actor.permissions, Permissions.ORGANIZATION_UPDATE);
    const now = this.clock.now();
    const widget = await loadOrCreateWidget(this.widgets, actor.tenantId, now);
    widget.update(input, now);
    await this.widgets.save(widget);
    await this.eventBus.publish(
      new WidgetConfigurationUpdatedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        widget.id,
        actor.actorId,
        input.security.correlationId,
      ),
    );
    return { widget: toWidgetConfigurationDto(widget) };
  }
}

export class RotateWidgetPublicKeyUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly widgets: WidgetConfigurationRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly security: RequestSecurityContext;
  }) {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    WidgetPolicy.assertPermission(actor.permissions, Permissions.ORGANIZATION_UPDATE);
    const now = this.clock.now();
    const widget = await loadOrCreateWidget(this.widgets, actor.tenantId, now);
    widget.rotatePublicKey(now);
    await this.widgets.save(widget);
    await this.eventBus.publish(
      new WidgetConfigurationUpdatedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        widget.id,
        actor.actorId,
        input.security.correlationId,
      ),
    );
    return { widget: toWidgetConfigurationDto(widget) };
  }
}

export async function loadOrCreateWidget(
  widgets: WidgetConfigurationRepository,
  tenantId: string,
  now: Date,
): Promise<WidgetConfiguration> {
  const existing = await widgets.findByTenant(tenantId);
  if (existing) {
    return existing;
  }

  const created = WidgetConfiguration.createDefault({ organizationId: tenantId, now });
  await widgets.save(created);
  return created;
}
