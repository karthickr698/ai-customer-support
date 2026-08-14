import type { EventBus } from '@ai-customer-support/shared';
import {
  AnonymousSessionsNotAllowedError,
  WidgetSessionNotFoundError,
} from '../../domain/errors.js';
import { WidgetSessionCreatedEvent, WidgetSessionIdentifiedEvent } from '../../domain/events.js';
import { WidgetSession } from '../../domain/widget-session.js';
import { toWidgetSessionDto, type RequestSecurityContext } from '../dtos.js';
import type { ClockPort } from '../ports/clock-port.js';
import type {
  IdentifiedConversationPort,
  RateLimiterPort,
  SecureTokenGeneratorPort,
  TokenHasherPort,
} from '../ports/security-ports.js';
import type { WidgetSessionRepository } from '../ports/widget-session-repository.js';
import { RequireEnabledWidgetService } from './get-public-widget-configuration-use-case.js';

const SESSION_CREATE_LIMIT = 20;
const SESSION_CREATE_WINDOW_SECONDS = 3600;

export class CreateWidgetSessionUseCase {
  constructor(
    private readonly requireWidget: RequireEnabledWidgetService,
    private readonly sessions: WidgetSessionRepository,
    private readonly tokens: SecureTokenGeneratorPort,
    private readonly hasher: TokenHasherPort,
    private readonly rateLimiter: RateLimiterPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly sessionTtlSeconds: number,
  ) {}

  async execute(input: {
    readonly publicKey: string;
    readonly visitorId?: string;
    readonly email?: string;
    readonly name?: string;
    readonly security: RequestSecurityContext;
  }) {
    await this.rateLimiter.consume(
      `widget-session:${input.security.ipAddress}`,
      SESSION_CREATE_LIMIT,
      SESSION_CREATE_WINDOW_SECONDS,
    );

    const widget = await this.requireWidget.execute(input.publicKey, input.security.origin);
    const email = input.email?.trim();
    const identified = Boolean(email);
    if (!identified && !widget.allowAnonymous) {
      throw new AnonymousSessionsNotAllowedError();
    }

    const now = this.clock.now();
    const sessionToken = this.tokens.generate();
    const session = WidgetSession.create({
      organizationId: widget.organizationId,
      widgetConfigurationId: widget.id,
      visitorId: input.visitorId?.trim() || crypto.randomUUID(),
      kind: identified ? 'customer' : 'anonymous',
      email,
      name: input.name,
      tokenHash: this.hasher.hash(sessionToken),
      now,
      expiresAt: new Date(now.getTime() + this.sessionTtlSeconds * 1000),
    });
    await this.sessions.save(session);
    await this.eventBus.publish(
      new WidgetSessionCreatedEvent(
        crypto.randomUUID(),
        now,
        widget.organizationId,
        session.id,
        session.kind,
        input.security.correlationId,
      ),
    );

    return { session: toWidgetSessionDto(session), sessionToken };
  }
}

export class IdentifyWidgetSessionUseCase {
  constructor(
    private readonly sessions: WidgetSessionRepository,
    private readonly hasher: TokenHasherPort,
    private readonly conversations: IdentifiedConversationPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly sessionToken: string;
    readonly email: string;
    readonly name: string;
    readonly security: RequestSecurityContext;
  }) {
    const session = await this.sessions.findByTokenHash(this.hasher.hash(input.sessionToken));
    if (!session) {
      throw new WidgetSessionNotFoundError();
    }

    const now = this.clock.now();
    session.identify({ email: input.email, name: input.name, now });
    await this.sessions.save(session);
    await this.conversations.identifySessionConversations({
      tenantId: session.organizationId,
      sessionId: session.id,
      email: session.email ?? input.email,
      name: session.name ?? input.name,
    });
    await this.eventBus.publish(
      new WidgetSessionIdentifiedEvent(
        crypto.randomUUID(),
        now,
        session.organizationId,
        session.id,
        input.security.correlationId,
      ),
    );

    return { session: toWidgetSessionDto(session) };
  }
}

export class GetWidgetSessionUseCase {
  constructor(
    private readonly sessions: WidgetSessionRepository,
    private readonly hasher: TokenHasherPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: { readonly sessionToken: string }) {
    const session = await this.sessions.findByTokenHash(this.hasher.hash(input.sessionToken));
    if (!session) {
      throw new WidgetSessionNotFoundError();
    }

    const now = this.clock.now();
    session.assertActive(now);
    session.touch(now);
    await this.sessions.save(session);
    return { session: toWidgetSessionDto(session) };
  }
}
