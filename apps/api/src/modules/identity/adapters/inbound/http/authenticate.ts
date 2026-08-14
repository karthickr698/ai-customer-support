import type { FastifyReply, FastifyRequest } from 'fastify';
import type { TokenIssuerPort } from '../../../application/ports/token-issuer-port.js';
import { UnauthorizedError } from '../../../domain/errors.js';
import { ACCESS_COOKIE_NAME, readBearerToken } from './auth-cookies.js';

export function createAuthenticatePreHandler(tokenIssuer: TokenIssuerPort) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const token = request.cookies[ACCESS_COOKIE_NAME] ?? readBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedError();
    }

    const claims = await tokenIssuer.verifyAccessToken(token);
    if (!claims) {
      throw new UnauthorizedError();
    }

    request.auth = claims;
    request.requestContext = {
      ...request.requestContext,
      actorId: claims.userId,
    };
  };
}
