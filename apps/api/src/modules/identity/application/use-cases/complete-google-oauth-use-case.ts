import { AuditActions } from '../../domain/audit-actions.js';
import { EmailAddress } from '../../domain/email-address.js';
import {
  GoogleOAuthFailedError,
  GoogleOAuthNotConfiguredError,
  UserDisabledError,
} from '../../domain/errors.js';
import { GoogleAccountLinkedEvent, UserRegisteredEvent } from '../../domain/events.js';
import { OAuthAccount } from '../../domain/oauth-account.js';
import { User } from '../../domain/user.js';
import type { EventBus } from '@ai-customer-support/shared';
import type { RequestSecurityContext } from '../dtos.js';
import type { AuditLogPort } from '../ports/audit-log-port.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { GoogleOAuthPort } from '../ports/google-oauth-port.js';
import type { OAuthAccountRepository } from '../ports/oauth-account-repository.js';
import type { OAuthLoginCodeStorePort, OAuthStateStorePort } from '../ports/oauth-state-store-port.js';
import type { RateLimiterPort } from '../ports/rate-limiter-port.js';
import type { SecureTokenGeneratorPort } from '../ports/secure-token-generator-port.js';
import type { UserRepository } from '../ports/user-repository.js';
import { AUTH_RATE_LIMITS, OAUTH_LOGIN_CODE_TTL_SECONDS } from '../rate-limits.js';

export type CompleteGoogleOAuthCommand = {
  readonly code?: string;
  readonly state?: string;
  readonly oauthError?: string;
  readonly security: RequestSecurityContext;
};

export class CompleteGoogleOAuthUseCase {
  constructor(
    private readonly googleOAuth: GoogleOAuthPort | undefined,
    private readonly users: UserRepository,
    private readonly oauthAccounts: OAuthAccountRepository,
    private readonly oauthStateStore: OAuthStateStorePort,
    private readonly oauthLoginCodes: OAuthLoginCodeStorePort,
    private readonly tokenGenerator: SecureTokenGeneratorPort,
    private readonly auditLog: AuditLogPort,
    private readonly rateLimiter: RateLimiterPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly redirectUri: string | undefined,
  ) {}

  async execute(command: CompleteGoogleOAuthCommand): Promise<{ loginCode: string }> {
    await this.rateLimiter.consume(
      `auth:google-complete:ip:${command.security.ipAddress}`,
      AUTH_RATE_LIMITS.googleCompleteIp.limit,
      AUTH_RATE_LIMITS.googleCompleteIp.windowSeconds,
    );

    if (!this.googleOAuth || !this.redirectUri) {
      throw new GoogleOAuthNotConfiguredError();
    }

    if (command.oauthError || !command.code || !command.state) {
      throw new GoogleOAuthFailedError();
    }

    const storedState = await this.oauthStateStore.take(command.state);
    if (!storedState) {
      throw new GoogleOAuthFailedError('Google sign-in expired. Try again.');
    }

    const profile = await this.googleOAuth.exchangeAuthorizationCode({
      code: command.code,
      codeVerifier: storedState.codeVerifier,
      redirectUri: this.redirectUri,
    });

    if (!profile.emailVerified) {
      throw new GoogleOAuthFailedError('Google did not verify this email address');
    }

    const email = EmailAddress.parse(profile.email);
    const now = this.clock.now();
    const existingOAuth = await this.oauthAccounts.findByGoogleAccountId(profile.providerAccountId);

    let user = existingOAuth ? await this.users.findById(existingOAuth.userId) : null;
    if (existingOAuth && !user) {
      throw new GoogleOAuthFailedError();
    }

    if (user) {
      user.assertCanAuthenticate();
    }

    if (!user) {
      user = await this.users.findByEmail(email);
      if (user) {
        user.assertCanAuthenticate();
        if (!user.emailVerified) {
          user.verifyEmail(now);
          await this.users.save(user);
        }

        await this.oauthAccounts.save(
          OAuthAccount.linkGoogle({
            userId: user.id,
            providerAccountId: profile.providerAccountId,
            now,
          }),
        );

        await this.auditLog.record({
          actorId: user.id,
          action: AuditActions.GOOGLE_ACCOUNT_LINKED,
          ipAddress: command.security.ipAddress,
          userAgent: command.security.userAgent,
          requestId: command.security.requestId,
          occurredAt: now,
        });

        await this.eventBus.publish(
          new GoogleAccountLinkedEvent(
            crypto.randomUUID(),
            now,
            user.id,
            command.security.correlationId,
          ),
        );
      } else {
        user = User.registerFromGoogle({
          email,
          displayName: profile.displayName || email.value.split('@')[0] || 'User',
          now,
        });
        await this.users.save(user);
        await this.oauthAccounts.save(
          OAuthAccount.linkGoogle({
            userId: user.id,
            providerAccountId: profile.providerAccountId,
            now,
          }),
        );

        await this.auditLog.record({
          actorId: user.id,
          action: AuditActions.USER_REGISTERED,
          metadata: { method: 'google' },
          ipAddress: command.security.ipAddress,
          userAgent: command.security.userAgent,
          requestId: command.security.requestId,
          occurredAt: now,
        });

        await this.eventBus.publish(
          new UserRegisteredEvent(
            crypto.randomUUID(),
            now,
            user.id,
            user.email.value,
            command.security.correlationId,
          ),
        );
      }
    }

    if (user.status === 'disabled') {
      throw new UserDisabledError();
    }

    const loginCode = this.tokenGenerator.generate();
    await this.oauthLoginCodes.save(loginCode, { userId: user.id }, OAUTH_LOGIN_CODE_TTL_SECONDS);
    return { loginCode };
  }
}
