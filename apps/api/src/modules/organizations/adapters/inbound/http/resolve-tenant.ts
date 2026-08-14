import type { FastifyReply, FastifyRequest } from 'fastify';
import { TenantContextRequiredError, TenantMismatchError, UnauthorizedError } from '../../../domain/errors.js';
import type { ResolveTenantAccessUseCase } from '../../../application/use-cases/resolve-tenant-access-use-case.js';

const TENANT_HEADER = 'x-tenant-id';

export function readTenantId(request: FastifyRequest): { pathId?: string; headerId?: string } {
  const params = request.params as Record<string, unknown>;
  const pathId = typeof params.organizationId === 'string' ? params.organizationId : undefined;
  const headerValue = request.headers[TENANT_HEADER];
  const headerId = typeof headerValue === 'string' && headerValue.length > 0 ? headerValue : undefined;
  return { pathId, headerId };
}

export function createResolveTenantPreHandler(resolveTenantAccess: ResolveTenantAccessUseCase) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!request.auth) {
      throw new UnauthorizedError();
    }

    const { pathId, headerId } = readTenantId(request);
    if (pathId && headerId && pathId !== headerId) {
      throw new TenantMismatchError();
    }

    const tenantId = pathId ?? headerId;
    if (!tenantId) {
      throw new TenantContextRequiredError();
    }

    const access = await resolveTenantAccess.execute({
      tenantId,
      actorId: request.auth.userId,
    });

    request.tenantAccess = access;
    request.requestContext = {
      ...request.requestContext,
      tenantId: access.tenantId,
      actorId: request.auth.userId,
    };
    request.log = request.log.child({
      tenantId: access.tenantId,
      actorId: request.auth.userId,
    });
  };
}
