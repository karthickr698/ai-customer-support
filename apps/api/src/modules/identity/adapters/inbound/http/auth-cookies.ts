import type { FastifyReply } from 'fastify';
import type { AuthSessionResult } from '../../../application/dtos.js';

export const ACCESS_COOKIE_NAME = 'access_token';
export const REFRESH_COOKIE_NAME = 'refresh_token';

export type AuthCookieOptions = {
  readonly secure: boolean;
};

function baseCookie(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    signed: false,
  };
}

export function setAuthCookies(
  reply: FastifyReply,
  session: AuthSessionResult,
  options: AuthCookieOptions,
): void {
  const base = baseCookie(options.secure);

  void reply.setCookie(ACCESS_COOKIE_NAME, session.accessToken, {
    ...base,
    expires: session.accessTokenExpiresAt,
  });

  void reply.setCookie(REFRESH_COOKIE_NAME, session.refreshToken, {
    ...base,
    expires: session.refreshTokenExpiresAt,
  });
}

export function clearAuthCookies(reply: FastifyReply, options: AuthCookieOptions): void {
  const base = baseCookie(options.secure);
  void reply.clearCookie(ACCESS_COOKIE_NAME, base);
  void reply.clearCookie(REFRESH_COOKIE_NAME, base);
}

export function readBearerToken(authorization: string | undefined): string | undefined {
  if (!authorization) {
    return undefined;
  }

  const [scheme, token] = authorization.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return undefined;
  }

  return token;
}
