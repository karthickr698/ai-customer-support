import type { FastifyReply, FastifyRequest } from 'fastify';
import { UnauthorizedError, WidgetSessionNotFoundError } from '../../../domain/errors.js';
import type { ClockPort } from '../../../application/ports/clock-port.js';
import type { TokenHasherPort } from '../../../application/ports/security-ports.js';
import type { WidgetConfigurationRepository } from '../../../application/ports/widget-configuration-repository.js';
import type { WidgetSessionRepository } from '../../../application/ports/widget-session-repository.js';
import { WidgetDisabledError } from '../../../domain/errors.js';
import { WidgetPolicy } from '../../../domain/widget-policy.js';
import { readBearerToken } from './read-widget-token.js';

export type WidgetSessionRequestContext = {
  readonly sessionId: string;
  readonly organizationId: string;
  readonly visitorId: string;
  readonly kind: 'anonymous' | 'customer';
  readonly email: string | undefined;
  readonly name: string | undefined;
  readonly customerId: string | undefined;
};

export function createAuthenticateWidgetSessionPreHandler(input: {
  readonly sessions: WidgetSessionRepository;
  readonly widgets: WidgetConfigurationRepository;
  readonly hasher: TokenHasherPort;
  readonly clock: ClockPort;
}) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const token = readWidgetSessionToken(request);
    if (!token) {
      throw new UnauthorizedError('Widget session token required');
    }

    const session = await input.sessions.findByTokenHash(input.hasher.hash(token));
    if (!session) {
      throw new WidgetSessionNotFoundError();
    }

    const now = input.clock.now();
    session.assertActive(now);
    const widget = await input.widgets.findByTenant(session.organizationId);
    if (!widget || !widget.enabled) {
      throw new WidgetDisabledError();
    }

    WidgetPolicy.assertOriginAllowed(widget.allowedOrigins, requestOrigin(request));
    session.touch(now);
    await input.sessions.save(session);

    request.widgetSession = {
      sessionId: session.id,
      organizationId: session.organizationId,
      visitorId: session.visitorId,
      kind: session.kind,
      email: session.email,
      name: session.name,
      customerId: session.customerId,
    };
    request.requestContext = {
      ...request.requestContext,
      tenantId: session.organizationId,
      actorId: session.id,
    };
  };
}

export function readWidgetSessionToken(request: FastifyRequest): string | undefined {
  const header = request.headers['x-widget-session'];
  if (typeof header === 'string' && header.trim().length > 0) {
    return header.trim();
  }

  return readBearerToken(request.headers.authorization);
}

export function requestOrigin(request: FastifyRequest): string | undefined {
  const origin = request.headers.origin;
  return typeof origin === 'string' && origin.length > 0 ? origin : undefined;
}
