import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PlatformPermission } from '@ai-customer-support/contracts';
import { InsufficientPlatformPermissionError, UnauthorizedError } from '../../../domain/errors.js';
import { permissionsForPlatformRole } from '../../../domain/permissions.js';
import type { LoadPlatformActorService } from '../../../application/use-cases/operator-use-cases.js';

export function createResolvePlatformOperatorPreHandler(actors: LoadPlatformActorService) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!request.auth) {
      throw new UnauthorizedError();
    }
    const operator = await actors.execute(request.auth.userId);
    request.platformAccess = {
      userId: operator.userId,
      role: operator.role,
      permissions: permissionsForPlatformRole(operator.role),
    };
  };
}

export function createRequirePlatformPermissionPreHandler(permission: PlatformPermission) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const access = request.platformAccess;
    if (!access) {
      throw new InsufficientPlatformPermissionError(permission);
    }
    if (!access.permissions.includes(permission)) {
      throw new InsufficientPlatformPermissionError(permission);
    }
  };
}
