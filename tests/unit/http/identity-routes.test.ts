import type { AppConfig } from '@ai-customer-support/config';
import type { EventBus, Logger } from '@ai-customer-support/shared';
import pino from 'pino';
import { afterEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../../apps/api/src/bootstrap/server.ts';
import type { AppDependencies } from '../../../apps/api/src/bootstrap/dependencies.ts';
import type { AIServicePort } from '../../../apps/api/src/modules/ai/application/ports/ai-service-port.ts';
import { IssueAuthSessionService } from '../../../apps/api/src/modules/identity/application/issue-auth-session-service.ts';
import { registerIdentityRoutes } from '../../../apps/api/src/modules/identity/adapters/inbound/http/identity-routes.ts';
import { CompleteGoogleOAuthUseCase } from '../../../apps/api/src/modules/identity/application/use-cases/complete-google-oauth-use-case.ts';
import { ExchangeOAuthLoginCodeUseCase } from '../../../apps/api/src/modules/identity/application/use-cases/exchange-oauth-login-code-use-case.ts';
import { GetAuthenticatedUserUseCase } from '../../../apps/api/src/modules/identity/application/use-cases/get-authenticated-user-use-case.ts';
import { LoginWithPasswordUseCase } from '../../../apps/api/src/modules/identity/application/use-cases/login-with-password-use-case.ts';
import { LogoutUseCase } from '../../../apps/api/src/modules/identity/application/use-cases/logout-use-case.ts';
import { RefreshSessionUseCase } from '../../../apps/api/src/modules/identity/application/use-cases/refresh-session-use-case.ts';
import { RegisterUserUseCase } from '../../../apps/api/src/modules/identity/application/use-cases/register-user-use-case.ts';
import { RequestPasswordResetUseCase } from '../../../apps/api/src/modules/identity/application/use-cases/request-password-reset-use-case.ts';
import { ResendVerificationEmailUseCase } from '../../../apps/api/src/modules/identity/application/use-cases/resend-verification-email-use-case.ts';
import { ResetPasswordUseCase } from '../../../apps/api/src/modules/identity/application/use-cases/reset-password-use-case.ts';
import { StartGoogleOAuthUseCase } from '../../../apps/api/src/modules/identity/application/use-cases/start-google-oauth-use-case.ts';
import { VerifyEmailUseCase } from '../../../apps/api/src/modules/identity/application/use-cases/verify-email-use-case.ts';
import type { DatabasePort } from '../../../apps/api/src/shared/application/ports/database-port.ts';
import type { QueuePort } from '../../../apps/api/src/shared/application/ports/queue-port.ts';
import type { RedisPort } from '../../../apps/api/src/shared/application/ports/redis-port.ts';
import { InfrastructureHealthChecker } from '../../../apps/api/src/shared/infrastructure/health/infrastructure-health-checker.ts';
import { PinoLogger } from '../../../apps/api/src/shared/infrastructure/logging/pino-logger.ts';
import {
  FakeGoogleOAuth,
  FakePasswordHasher,
  FakeTokenHasher,
  FakeTokenIssuer,
  FixedClock,
  InMemoryOAuthAccountRepository,
  InMemoryOAuthLoginCodeStore,
  InMemoryOAuthStateStore,
  InMemoryOneTimeTokenRepository,
  InMemoryRateLimiter,
  InMemoryRefreshSessionRepository,
  InMemoryUserRepository,
  RecordingAuditLog,
  RecordingEmailSender,
  RecordingEventBus,
  SequenceTokenGenerator,
} from '../identity/fakes.ts';

class FakeDatabase implements DatabasePort {
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async isReady(): Promise<boolean> {
    return true;
  }
}

class FakeRedis implements RedisPort {
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async isReady(): Promise<boolean> {
    return true;
  }
}

class FakeQueue implements QueuePort {
  async enqueue(): Promise<void> {}
  process(): void {}
  async close(): Promise<void> {}
}

class FakeAIService implements AIServicePort {
  async isReady(): Promise<boolean> {
    return true;
  }
}

function testConfig(): AppConfig {
  return {
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: 3001,
    LOG_LEVEL: 'fatal',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/ai_customer_support',
    REDIS_URL: 'redis://localhost:6380',
    JWT_SECRET: 'a'.repeat(32),
    ACCESS_TOKEN_TTL_SECONDS: 900,
    REFRESH_TOKEN_TTL_SECONDS: 604800,
    EMAIL_VERIFICATION_TTL_SECONDS: 86_400,
    PASSWORD_RESET_TTL_SECONDS: 3600,
    INVITATION_TTL_SECONDS: 604800,
    WEB_ORIGIN: 'http://localhost:5173',
    AI_SERVICE_URL: 'http://localhost:8000',
    EMAIL_FROM: 'noreply@localhost',
    GOOGLE_REDIRECT_URI: 'http://localhost:3000/api/auth/google/callback',
  };
}

function createIdentityDeps(eventBus: EventBus) {
  const users = new InMemoryUserRepository();
  const refreshSessions = new InMemoryRefreshSessionRepository();
  const oneTimeTokens = new InMemoryOneTimeTokenRepository();
  const oauthAccounts = new InMemoryOAuthAccountRepository();
  const passwordHasher = new FakePasswordHasher();
  const tokenIssuer = new FakeTokenIssuer();
  const tokenGenerator = new SequenceTokenGenerator();
  const tokenHasher = new FakeTokenHasher();
  const emailSender = new RecordingEmailSender();
  const auditLog = new RecordingAuditLog();
  const rateLimiter = new InMemoryRateLimiter();
  const clock = new FixedClock(new Date('2026-08-14T12:00:00.000Z'));
  const oauthStateStore = new InMemoryOAuthStateStore();
  const oauthLoginCodes = new InMemoryOAuthLoginCodeStore();
  const googleOAuth = new FakeGoogleOAuth({
    providerAccountId: 'google-1',
    email: 'google@example.com',
    emailVerified: true,
    displayName: 'Google User',
  });
  const sessions = new IssueAuthSessionService(
    refreshSessions,
    tokenIssuer,
    tokenGenerator,
    tokenHasher,
    clock,
    auditLog,
    eventBus,
    { accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 604800 },
  );

  return {
    emailSender,
    tokenIssuer,
    useCases: {
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
        eventBus,
        'http://localhost:5173',
        86_400,
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
      logout: new LogoutUseCase(refreshSessions, tokenHasher, auditLog, clock, eventBus),
      requestPasswordReset: new RequestPasswordResetUseCase(
        users,
        oneTimeTokens,
        tokenGenerator,
        tokenHasher,
        emailSender,
        auditLog,
        rateLimiter,
        clock,
        eventBus,
        'http://localhost:5173',
        3600,
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
        eventBus,
      ),
      verifyEmail: new VerifyEmailUseCase(
        users,
        oneTimeTokens,
        tokenHasher,
        sessions,
        auditLog,
        rateLimiter,
        clock,
        eventBus,
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
        'http://localhost:5173',
        86_400,
      ),
      startGoogleOAuth: new StartGoogleOAuthUseCase(
        googleOAuth,
        oauthStateStore,
        tokenGenerator,
        tokenHasher,
        rateLimiter,
        'http://localhost:3000/api/auth/google/callback',
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
        eventBus,
        'http://localhost:3000/api/auth/google/callback',
      ),
      exchangeOAuthLoginCode: new ExchangeOAuthLoginCodeUseCase(
        users,
        oauthLoginCodes,
        sessions,
        rateLimiter,
      ),
      getAuthenticatedUser: new GetAuthenticatedUserUseCase(users),
    },
  };
}

describe('identity HTTP routes', () => {
  const apps: Array<{ close: () => Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function start() {
    const rootLogger = pino({ level: 'silent' });
    const logger: Logger = new PinoLogger(rootLogger);
    const database = new FakeDatabase();
    const redis = new FakeRedis();
    const eventBus = new RecordingEventBus();
    const identity = createIdentityDeps(eventBus);
    const deps: AppDependencies = {
      config: testConfig(),
      logger,
      database,
      redis,
      eventBus,
      queue: new FakeQueue(),
      aiService: new FakeAIService(),
      healthChecker: new InfrastructureHealthChecker(database, redis),
      identity: {
        register: async (app) => {
          await registerIdentityRoutes(app, identity.useCases, identity.tokenIssuer, {
            webOrigin: 'http://localhost:5173',
            cookies: { secure: false },
          });
        },
      },
    };

    const app = await buildServer(deps, rootLogger);
    apps.push(app);
    return { app, identity };
  }

  it('rejects weak passwords at the HTTP boundary', async () => {
    const { app } = await start();

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'agent@example.com', password: 'short', displayName: 'Alex' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('registers, verifies email, and authenticates the current user', async () => {
    const { app, identity } = await start();

    const register = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'agent@example.com',
        password: 'correct-horse-1',
        displayName: 'Alex Agent',
      },
    });

    expect(register.statusCode).toBe(201);
    expect(register.json().user.emailVerified).toBe(false);

    const verifyUrl =
      identity.emailSender.messages[0] && identity.emailSender.messages[0].kind === 'email_verification'
        ? identity.emailSender.messages[0].verifyUrl
        : '';
    const token = new URL(verifyUrl).searchParams.get('token');

    const verify = await app.inject({
      method: 'POST',
      url: '/api/auth/email/verify',
      payload: { token },
    });

    expect(verify.statusCode).toBe(200);
    expect(verify.json().user.emailVerified).toBe(true);
    expect(verify.cookies.some((cookie) => cookie.name === 'access_token')).toBe(true);
    expect(verify.cookies.some((cookie) => cookie.name === 'refresh_token')).toBe(true);

    const cookieHeader = verify.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: cookieHeader },
    });

    expect(me.statusCode).toBe(200);
    expect(me.json().user.email).toBe('agent@example.com');
  });

  it('requires authentication for the current user endpoint', async () => {
    const { app } = await start();
    const response = await app.inject({ method: 'GET', url: '/api/auth/me' });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
  });
});
