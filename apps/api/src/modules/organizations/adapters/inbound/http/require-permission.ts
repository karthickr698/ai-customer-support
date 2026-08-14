import type { FastifyReply, FastifyRequest } from 'fastify';
import { InsufficientPermissionError, TenantContextRequiredError } from '../../../domain/errors.js';
import type { Permission } from '../../../domain/permissions.js';

export function createRequirePermissionPreHandler(permission: Permission) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const access = request.tenantAccess;
    if (!access) {
      throw new TenantContextRequiredError();
    }

    if (!access.permissions.includes(permission)) {
      throw new InsufficientPermissionError(permission);
    }
  };
}
