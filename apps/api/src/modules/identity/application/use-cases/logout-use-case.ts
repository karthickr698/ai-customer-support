import { AuditActions } from '../../domain/audit-actions.js';
import { UserLoggedOutEvent } from '../../domain/events.js';
import type { EventBus } from '@ai-customer-support/shared';
import type { RequestSecurityContext } from '../dtos.js';
import type { AuditLogPort } from '../ports/audit-log-port.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { RefreshSessionRepository } from '../ports/refresh-session-repository.js';
import type { TokenHasherPort } from '../ports/token-hasher-port.js';

export type LogoutCommand = {
  readonly refreshToken?: string;
  readonly actorId?: string;
  readonly security: RequestSecurityContext;
};

export class LogoutUseCase {
  constructor(
    private readonly refreshSessions: RefreshSessionRepository,
    private readonly tokenHasher: TokenHasherPort,
    private readonly auditLog: AuditLogPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: LogoutCommand): Promise<void> {
    const now = this.clock.now();
    let userId = command.actorId;

    if (command.refreshToken) {
      const session = await this.refreshSessions.findByTokenHash(
        this.tokenHasher.hash(command.refreshToken),
      );

      if (session && !session.isRevoked()) {
        session.revoke(now);
        await this.refreshSessions.save(session);
        userId = session.userId;
      }
    }

    await this.auditLog.record({
      actorId: userId,
      action: AuditActions.LOGOUT,
      ipAddress: command.security.ipAddress,
      userAgent: command.security.userAgent,
      requestId: command.security.requestId,
      occurredAt: now,
    });

    if (userId) {
      await this.eventBus.publish(
        new UserLoggedOutEvent(crypto.randomUUID(), now, userId, command.security.correlationId),
      );
    }
  }
}
