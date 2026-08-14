import { InvalidOAuthLoginCodeError, UserNotFoundError } from '../../domain/errors.js';
import { createUserId } from '../../domain/user-id.js';
import type { AuthSessionResult, RequestSecurityContext } from '../dtos.js';
import type { IssueAuthSessionService } from '../issue-auth-session-service.js';
import type { OAuthLoginCodeStorePort } from '../ports/oauth-state-store-port.js';
import type { RateLimiterPort } from '../ports/rate-limiter-port.js';
import type { UserRepository } from '../ports/user-repository.js';
import { AUTH_RATE_LIMITS } from '../rate-limits.js';

export type ExchangeOAuthLoginCodeCommand = {
  readonly code: string;
  readonly security: RequestSecurityContext;
};

export class ExchangeOAuthLoginCodeUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly oauthLoginCodes: OAuthLoginCodeStorePort,
    private readonly sessions: IssueAuthSessionService,
    private readonly rateLimiter: RateLimiterPort,
  ) {}

  async execute(command: ExchangeOAuthLoginCodeCommand): Promise<AuthSessionResult> {
    await this.rateLimiter.consume(
      `auth:oauth-exchange:ip:${command.security.ipAddress}`,
      AUTH_RATE_LIMITS.oauthExchangeIp.limit,
      AUTH_RATE_LIMITS.oauthExchangeIp.windowSeconds,
    );

    const pending = await this.oauthLoginCodes.take(command.code);
    if (!pending) {
      throw new InvalidOAuthLoginCodeError();
    }

    const user = await this.users.findById(createUserId(pending.userId));
    if (!user) {
      throw new UserNotFoundError();
    }

    user.assertCanAuthenticate();
    return this.sessions.issue(user, command.security, 'google');
  }
}
