import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { RequestSecurityContext } from '../../../application/dtos.js';
import type { CompleteGoogleOAuthUseCase } from '../../../application/use-cases/complete-google-oauth-use-case.js';
import type { ExchangeOAuthLoginCodeUseCase } from '../../../application/use-cases/exchange-oauth-login-code-use-case.js';
import type { GetAuthenticatedUserUseCase } from '../../../application/use-cases/get-authenticated-user-use-case.js';
import type { LoginWithPasswordUseCase } from '../../../application/use-cases/login-with-password-use-case.js';
import type { LogoutUseCase } from '../../../application/use-cases/logout-use-case.js';
import type { RefreshSessionUseCase } from '../../../application/use-cases/refresh-session-use-case.js';
import type { RegisterUserUseCase } from '../../../application/use-cases/register-user-use-case.js';
import type { RequestPasswordResetUseCase } from '../../../application/use-cases/request-password-reset-use-case.js';
import type { ResendVerificationEmailUseCase } from '../../../application/use-cases/resend-verification-email-use-case.js';
import type { ResetPasswordUseCase } from '../../../application/use-cases/reset-password-use-case.js';
import type { StartGoogleOAuthUseCase } from '../../../application/use-cases/start-google-oauth-use-case.js';
import type { VerifyEmailUseCase } from '../../../application/use-cases/verify-email-use-case.js';
import type { TokenIssuerPort } from '../../../application/ports/token-issuer-port.js';
import {
  completeOAuthBodySchema,
  emailOnlyBodySchema,
  loginBodySchema,
  registerBodySchema,
  resetPasswordBodySchema,
  verifyEmailBodySchema,
} from './auth-schemas.js';
import {
  clearAuthCookies,
  REFRESH_COOKIE_NAME,
  setAuthCookies,
  type AuthCookieOptions,
} from './auth-cookies.js';
import { createAuthenticatePreHandler } from './authenticate.js';
import { parseBody } from './parse-body.js';

export type IdentityHttpUseCases = {
  readonly registerUser: RegisterUserUseCase;
  readonly loginWithPassword: LoginWithPasswordUseCase;
  readonly refreshSession: RefreshSessionUseCase;
  readonly logout: LogoutUseCase;
  readonly requestPasswordReset: RequestPasswordResetUseCase;
  readonly resetPassword: ResetPasswordUseCase;
  readonly verifyEmail: VerifyEmailUseCase;
  readonly resendVerification: ResendVerificationEmailUseCase;
  readonly startGoogleOAuth: StartGoogleOAuthUseCase;
  readonly completeGoogleOAuth: CompleteGoogleOAuthUseCase;
  readonly exchangeOAuthLoginCode: ExchangeOAuthLoginCodeUseCase;
  readonly getAuthenticatedUser: GetAuthenticatedUserUseCase;
};

export type IdentityHttpConfig = {
  readonly webOrigin: string;
  readonly cookies: AuthCookieOptions;
};

export async function registerIdentityRoutes(
  app: FastifyInstance,
  useCases: IdentityHttpUseCases,
  tokenIssuer: TokenIssuerPort,
  config: IdentityHttpConfig,
): Promise<void> {
  const authenticate = createAuthenticatePreHandler(tokenIssuer);

  app.post('/api/auth/register', async (request, reply) => {
    const body = parseBody(registerBodySchema, request.body);
    const result = await useCases.registerUser.execute({
      email: body.email,
      password: body.password,
      displayName: body.displayName,
      security: securityContext(request),
    });

    return reply.status(201).send({
      user: result.user,
      message: 'Check your email to verify your account',
    });
  });

  app.post('/api/auth/login', async (request, reply) => {
    const body = parseBody(loginBodySchema, request.body);
    const session = await useCases.loginWithPassword.execute({
      email: body.email,
      password: body.password,
      security: securityContext(request),
    });

    setAuthCookies(reply, session, config.cookies);
    return reply.status(200).send({ user: session.user });
  });

  app.post('/api/auth/refresh', async (request, reply) => {
    const refreshToken = request.cookies[REFRESH_COOKIE_NAME];
    if (!refreshToken) {
      clearAuthCookies(reply, config.cookies);
      return reply.status(401).send({
        error: { code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token is invalid or expired' },
      });
    }

    const session = await useCases.refreshSession.execute({
      refreshToken,
      security: securityContext(request),
    });

    setAuthCookies(reply, session, config.cookies);
    return reply.status(200).send({ user: session.user });
  });

  app.post('/api/auth/logout', async (request, reply) => {
    await useCases.logout.execute({
      refreshToken: request.cookies[REFRESH_COOKIE_NAME],
      actorId: request.auth?.userId,
      security: securityContext(request),
    });

    clearAuthCookies(reply, config.cookies);
    return reply.status(204).send();
  });

  app.get('/api/auth/me', { preHandler: authenticate }, async (request, reply) => {
    const result = await useCases.getAuthenticatedUser.execute(request.auth?.userId);
    return reply.status(200).send(result);
  });

  app.post('/api/auth/password/forgot', async (request, reply) => {
    const body = parseBody(emailOnlyBodySchema, request.body);
    await useCases.requestPasswordReset.execute({
      email: body.email,
      security: securityContext(request),
    });

    return reply.status(200).send({
      message: 'If an account exists for that email, we sent a reset link',
    });
  });

  app.post('/api/auth/password/reset', async (request, reply) => {
    const body = parseBody(resetPasswordBodySchema, request.body);
    await useCases.resetPassword.execute({
      token: body.token,
      password: body.password,
      security: securityContext(request),
    });

    clearAuthCookies(reply, config.cookies);
    return reply.status(200).send({ message: 'Password updated. You can sign in now.' });
  });

  app.post('/api/auth/email/verify', async (request, reply) => {
    const body = parseBody(verifyEmailBodySchema, request.body);
    const session = await useCases.verifyEmail.execute({
      token: body.token,
      security: securityContext(request),
    });

    setAuthCookies(reply, session, config.cookies);
    return reply.status(200).send({ user: session.user });
  });

  app.post('/api/auth/email/resend', async (request, reply) => {
    const body = parseBody(emailOnlyBodySchema, request.body);
    await useCases.resendVerification.execute({
      email: body.email,
      security: securityContext(request),
    });

    return reply.status(200).send({
      message: 'If an unverified account exists for that email, we sent a new link',
    });
  });

  app.post('/api/auth/google/start', async (request, reply) => {
    const result = await useCases.startGoogleOAuth.execute({
      security: securityContext(request),
    });

    return reply.status(200).send(result);
  });

  app.get('/api/auth/google/callback', async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const loginErrorRedirect = `${config.webOrigin}/login?error=google`;

    try {
      const result = await useCases.completeGoogleOAuth.execute({
        code: typeof query.code === 'string' ? query.code : undefined,
        state: typeof query.state === 'string' ? query.state : undefined,
        oauthError: typeof query.error === 'string' ? query.error : undefined,
        security: securityContext(request),
      });

      const redirect = new URL('/auth/callback', config.webOrigin);
      redirect.searchParams.set('code', result.loginCode);
      return reply.redirect(redirect.toString());
    } catch {
      return reply.redirect(loginErrorRedirect);
    }
  });

  app.post('/api/auth/google/complete', async (request, reply) => {
    const body = parseBody(completeOAuthBodySchema, request.body);
    const session = await useCases.exchangeOAuthLoginCode.execute({
      code: body.code,
      security: securityContext(request),
    });

    setAuthCookies(reply, session, config.cookies);
    return reply.status(200).send({ user: session.user });
  });
}

function securityContext(request: FastifyRequest): RequestSecurityContext {
  const userAgentHeader = request.headers['user-agent'];

  return {
    ipAddress: request.ip,
    userAgent: typeof userAgentHeader === 'string' ? userAgentHeader : undefined,
    requestId: request.requestContext.requestId,
    correlationId: request.requestContext.correlationId,
  };
}
