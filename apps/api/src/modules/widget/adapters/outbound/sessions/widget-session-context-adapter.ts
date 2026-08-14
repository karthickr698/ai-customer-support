import {
  WidgetDisabledError,
  WidgetNotFoundError,
  WidgetSessionNotFoundError,
} from '../../../domain/errors.js';
import { WidgetPolicy } from '../../../domain/widget-policy.js';
import type { ClockPort } from '../../../application/ports/clock-port.js';
import type { TokenHasherPort } from '../../../application/ports/security-ports.js';
import type { WidgetConfigurationRepository } from '../../../application/ports/widget-configuration-repository.js';
import type { WidgetSessionRepository } from '../../../application/ports/widget-session-repository.js';
import type {
  WidgetRuntimeSettings,
  WidgetSessionActor,
  WidgetSessionContextPort,
} from '../../../../conversations/application/ports/widget-session-context-port.js';

export class WidgetSessionContextAdapter implements WidgetSessionContextPort {
  constructor(
    private readonly sessions: WidgetSessionRepository,
    private readonly widgets: WidgetConfigurationRepository,
    private readonly hasher: TokenHasherPort,
    private readonly clock: ClockPort,
  ) {}

  async requireSession(token: string, origin: string | undefined): Promise<WidgetSessionActor> {
    const session = await this.sessions.findByTokenHash(this.hasher.hash(token));
    if (!session) {
      throw new WidgetSessionNotFoundError();
    }

    const now = this.clock.now();
    session.assertActive(now);
    const widget = await this.widgets.findByTenant(session.organizationId);
    if (!widget || !widget.enabled) {
      throw new WidgetDisabledError();
    }

    WidgetPolicy.assertOriginAllowed(widget.allowedOrigins, origin);
    session.touch(now);
    await this.sessions.save(session);
    return {
      tenantId: session.organizationId,
      sessionId: session.id,
      visitorId: session.visitorId,
      kind: session.kind,
      email: session.email,
      name: session.name,
      customerId: session.customerId,
      origin,
    };
  }

  async loadRuntimeSettings(tenantId: string): Promise<WidgetRuntimeSettings> {
    const widget = await this.widgets.findByTenant(tenantId);
    if (!widget) {
      throw new WidgetNotFoundError();
    }

    return {
      enabled: widget.enabled,
      allowAnonymous: widget.allowAnonymous,
      allowAttachments: widget.allowAttachments,
      aiEnabled: widget.aiEnabled,
      greeting: widget.greeting,
      allowedOrigins: widget.allowedOrigins,
    };
  }
}
