import type { AppConfig } from '@ai-customer-support/config';
import { isGoogleOAuthConfigured } from '@ai-customer-support/config';
import type { EventBus, Logger } from '@ai-customer-support/shared';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';
import { PostgresAuditLog } from './adapters/outbound/audit/postgres-audit-log.js';
import { Argon2PasswordHasher } from './adapters/outbound/crypto/argon2-password-hasher.js';
import { JoseAccessTokenIssuer } from './adapters/outbound/crypto/jose-access-token-issuer.js';
import {
  RandomSecureTokenGenerator,
  Sha256TokenHasher,
  SystemClock,
} from './adapters/outbound/crypto/token-crypto.js';
import { ConsoleEmailSender } from './adapters/outbound/email/console-email-sender.js';
import { SmtpEmailSender } from './adapters/outbound/email/smtp-email-sender.js';
import { GoogleOAuthAdapter } from './adapters/outbound/google/google-oauth-adapter.js';
import { registerIdentityRoutes } from './adapters/inbound/http/identity-routes.js';
import { createAuthenticatePreHandler } from './adapters/inbound/http/authenticate.js';
import { IdentityUserQuery } from './application/identity-user-query.js';
import { PostgresOAuthAccountRepository } from './adapters/outbound/persistence/postgres-oauth-account-repository.js';
import { PostgresOneTimeTokenRepository } from './adapters/outbound/persistence/postgres-one-time-token-repository.js';
import { PostgresRefreshSessionRepository } from './adapters/outbound/persistence/postgres-refresh-session-repository.js';
import { PostgresUserRepository } from './adapters/outbound/persistence/postgres-user-repository.js';
import { RedisOAuthLoginCodeStore, RedisOAuthStateStore } from './adapters/outbound/redis/redis-oauth-stores.js';
import { RedisRateLimiter } from './adapters/outbound/redis/redis-rate-limiter.js';
import { IssueAuthSessionService } from './application/issue-auth-session-service.js';
import type { EmailSenderPort } from './application/ports/email-sender-port.js';
import type { GoogleOAuthPort } from './application/ports/google-oauth-port.js';
import { CompleteGoogleOAuthUseCase } from './application/use-cases/complete-google-oauth-use-case.js';
import { ExchangeOAuthLoginCodeUseCase } from './application/use-cases/exchange-oauth-login-code-use-case.js';
import { GetAuthenticatedUserUseCase } from './application/use-cases/get-authenticated-user-use-case.js';
import { LoginWithPasswordUseCase } from './application/use-cases/login-with-password-use-case.js';
import { LogoutUseCase } from './application/use-cases/logout-use-case.js';
import { RefreshSessionUseCase } from './application/use-cases/refresh-session-use-case.js';
import { RegisterUserUseCase } from './application/use-cases/register-user-use-case.js';
import { RequestPasswordResetUseCase } from './application/use-cases/request-password-reset-use-case.js';
import { ResendVerificationEmailUseCase } from './application/use-cases/resend-verification-email-use-case.js';
import { ResetPasswordUseCase } from './application/use-cases/reset-password-use-case.js';
import { StartGoogleOAuthUseCase } from './application/use-cases/start-google-oauth-use-case.js';
import { VerifyEmailUseCase } from './application/use-cases/verify-email-use-case.js';

export type IdentityHttpRegistrar = {
  register(app: FastifyInstance): Promise<void>;
};

export type IdentityModule = IdentityHttpRegistrar & {
  readonly userQuery: IdentityUserQuery;
  readonly authenticate: ReturnType<typeof createAuthenticatePreHandler>;
};

export function composeIdentity(input: {
  readonly prisma: PrismaClient;
  readonly redis: Redis;
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly eventBus: EventBus;
}): IdentityModule {
  const users = new PostgresUserRepository(input.prisma);
  const refreshSessions = new PostgresRefreshSessionRepository(input.prisma);
  const oneTimeTokens = new PostgresOneTimeTokenRepository(input.prisma);
  const oauthAccounts = new PostgresOAuthAccountRepository(input.prisma);
  const passwordHasher = new Argon2PasswordHasher();
  const tokenIssuer = new JoseAccessTokenIssuer(input.config.JWT_SECRET, input.config.ACCESS_TOKEN_TTL_SECONDS);
  const tokenGenerator = new RandomSecureTokenGenerator();
  const tokenHasher = new Sha256TokenHasher();
  const clock = new SystemClock();
  const auditLog = new PostgresAuditLog(input.prisma);
  const rateLimiter = new RedisRateLimiter(input.redis);
  const oauthStateStore = new RedisOAuthStateStore(input.redis);
  const oauthLoginCodes = new RedisOAuthLoginCodeStore(input.redis);
  const emailSender = createEmailSender(input.config, input.logger);
  const googleOAuth = createGoogleOAuth(input.config);

  const sessions = new IssueAuthSessionService(
    refreshSessions,
    tokenIssuer,
    tokenGenerator,
    tokenHasher,
    clock,
    auditLog,
    input.eventBus,
    {
      accessTokenTtlSeconds: input.config.ACCESS_TOKEN_TTL_SECONDS,
      refreshTokenTtlSeconds: input.config.REFRESH_TOKEN_TTL_SECONDS,
    },
  );

  const useCases = {
    registerUser: new RegisterUserUseCase(
      users,
      oneTimeTokens,
      passwordHasher,
      tokenGenerator,
      tokenHasher,
      emailSender,
      auditLog,
      rateLimiter,
      clock,
      input.eventBus,
      input.config.WEB_ORIGIN,
      input.config.EMAIL_VERIFICATION_TTL_SECONDS,
    ),
    loginWithPassword: new LoginWithPasswordUseCase(
      users,
      passwordHasher,
      sessions,
      auditLog,
      rateLimiter,
      clock,
    ),
    refreshSession: new RefreshSessionUseCase(
      users,
      refreshSessions,
      tokenHasher,
      sessions,
      auditLog,
      rateLimiter,
      clock,
    ),
    logout: new LogoutUseCase(refreshSessions, tokenHasher, auditLog, clock, input.eventBus),
    requestPasswordReset: new RequestPasswordResetUseCase(
      users,
      oneTimeTokens,
      tokenGenerator,
      tokenHasher,
      emailSender,
      auditLog,
      rateLimiter,
      clock,
      input.eventBus,
      input.config.WEB_ORIGIN,
      input.config.PASSWORD_RESET_TTL_SECONDS,
    ),
    resetPassword: new ResetPasswordUseCase(
      users,
      oneTimeTokens,
      refreshSessions,
      passwordHasher,
      tokenHasher,
      auditLog,
      rateLimiter,
      clock,
      input.eventBus,
    ),
    verifyEmail: new VerifyEmailUseCase(
      users,
      oneTimeTokens,
      tokenHasher,
      sessions,
      auditLog,
      rateLimiter,
      clock,
      input.eventBus,
    ),
    resendVerification: new ResendVerificationEmailUseCase(
      users,
      oneTimeTokens,
      tokenGenerator,
      tokenHasher,
      emailSender,
      auditLog,
      rateLimiter,
      clock,
      input.config.WEB_ORIGIN,
      input.config.EMAIL_VERIFICATION_TTL_SECONDS,
    ),
    startGoogleOAuth: new StartGoogleOAuthUseCase(
      googleOAuth,
      oauthStateStore,
      tokenGenerator,
      tokenHasher,
      rateLimiter,
      input.config.GOOGLE_REDIRECT_URI,
    ),
    completeGoogleOAuth: new CompleteGoogleOAuthUseCase(
      googleOAuth,
      users,
      oauthAccounts,
      oauthStateStore,
      oauthLoginCodes,
      tokenGenerator,
      auditLog,
      rateLimiter,
      clock,
      input.eventBus,
      input.config.GOOGLE_REDIRECT_URI,
    ),
    exchangeOAuthLoginCode: new ExchangeOAuthLoginCodeUseCase(
      users,
      oauthLoginCodes,
      sessions,
      rateLimiter,
    ),
    getAuthenticatedUser: new GetAuthenticatedUserUseCase(users),
  };

  return {
    userQuery: new IdentityUserQuery(users),
    authenticate: createAuthenticatePreHandler(tokenIssuer),
    async register(app: FastifyInstance): Promise<void> {
      await registerIdentityRoutes(app, useCases, tokenIssuer, {
        webOrigin: input.config.WEB_ORIGIN,
        cookies: { secure: input.config.NODE_ENV === 'production' },
      });
    },
  };
}

function createEmailSender(config: AppConfig, logger: Logger): EmailSenderPort {
  if (config.SMTP_URL) {
    return new SmtpEmailSender(config.SMTP_URL, config.EMAIL_FROM, logger);
  }

  return new ConsoleEmailSender(logger, config.NODE_ENV);
}

function createGoogleOAuth(config: AppConfig): GoogleOAuthPort | undefined {
  if (!isGoogleOAuthConfigured(config) || !config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) {
    return undefined;
  }

  return new GoogleOAuthAdapter(config.GOOGLE_CLIENT_ID, config.GOOGLE_CLIENT_SECRET);
}
