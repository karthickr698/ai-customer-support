import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  API_KEY_TOKEN_PREFIX,
  OAUTH_ACCESS_TOKEN_PREFIX,
} from '../../../domain/api-version.js';
import { UnauthorizedError } from '../../../domain/errors.js';
import { intersectScopes } from '../../../domain/api-scopes.js';
import { PUBLIC_API_RATE_LIMITS } from '../../../application/rate-limits.js';
import type { AuthenticateApiCredentialUseCase } from '../../../application/use-cases/authenticate-api-credential-use-case.js';
import type { RateLimiterPort } from '../../../application/ports.js';
import type { AuthenticatePreHandler } from './integration-routes.js';
import {
  createResolveTenantPreHandler,
  type ResolveTenantAccessUseCase,
} from '../../../../organizations/index.js';

const API_KEY_HEADER = 'x-api-key';

export function createAuthenticatePublicApiPreHandler(input: {
  readonly authenticateSession: AuthenticatePreHandler;
  readonly authenticateCredential: AuthenticateApiCredentialUseCase;
  readonly resolveTenantAccess: ResolveTenantAccessUseCase;
  readonly rateLimiter: RateLimiterPort;
  readonly credentialLimit?: number;
}): AuthenticatePreHandler {
  const resolveTenant = createResolveTenantPreHandler(input.resolveTenantAccess);
  const limit = input.credentialLimit ?? PUBLIC_API_RATE_LIMITS.credential.limit;

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const credentialToken = readApiCredentialToken(request);
    if (credentialToken) {
      const credential = await input.authenticateCredential.execute(credentialToken);
      request.auth = { userId: credential.actorId, email: '' };
      request.apiCredential = credential;
      request.requestContext = {
        ...request.requestContext,
        actorId: credential.actorId,
        tenantId: credential.tenantId,
      };

      const pathTenant = pathOrganizationId(request);
      if (pathTenant && pathTenant !== credential.tenantId) {
        throw new UnauthorizedError('API credential does not match this organization');
      }

      await resolveTenant(request, reply);
      if (request.tenantAccess) {
        request.tenantAccess = {
          ...request.tenantAccess,
          permissions: intersectScopes(request.tenantAccess.permissions, credential.scopes),
        };
      }

      const rate = await input.rateLimiter.consume(
        `integrations:public-api:${credential.kind}:${credential.credentialId}`,
        limit,
        PUBLIC_API_RATE_LIMITS.credential.windowSeconds,
      );
      reply.header('x-ratelimit-limit', String(rate.limit));
      reply.header('x-ratelimit-remaining', String(rate.remaining));
      reply.header('x-ratelimit-reset', String(rate.resetSeconds));
      return;
    }

    await input.authenticateSession(request, reply);
    await resolveTenant(request, reply);
  };
}

function readApiCredentialToken(request: FastifyRequest): string | undefined {
  const header = request.headers[API_KEY_HEADER];
  if (typeof header === 'string' && header.startsWith(API_KEY_TOKEN_PREFIX)) {
    return header;
  }
  const bearer = readBearerToken(request.headers.authorization);
  if (!bearer) {
    return undefined;
  }
  if (bearer.startsWith(API_KEY_TOKEN_PREFIX) || bearer.startsWith(OAUTH_ACCESS_TOKEN_PREFIX)) {
    return bearer;
  }
  return undefined;
}

function readBearerToken(authorization: string | undefined): string | undefined {
  if (!authorization) {
    return undefined;
  }
  const [scheme, token] = authorization.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return undefined;
  }
  return token;
}

function pathOrganizationId(request: FastifyRequest): string | undefined {
  const params = request.params as Record<string, unknown>;
  return typeof params.organizationId === 'string' ? params.organizationId : undefined;
}
