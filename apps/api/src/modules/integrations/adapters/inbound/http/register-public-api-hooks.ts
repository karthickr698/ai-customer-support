import type { FastifyInstance } from 'fastify';
import type { Logger } from '@ai-customer-support/shared';
import type { PublicApiAuthKind } from '@ai-customer-support/contracts';
import {
  isPublicApiDocumentationPath,
  isVersionedApiPath,
  PUBLIC_API_VERSION,
  PUBLIC_API_VERSION_HEADER,
} from '../../../domain/api-version.js';
import type { RecordApiUsageUseCase } from '../../../application/use-cases/api-usage-use-cases.js';

export function registerPublicApiHooks(
  app: FastifyInstance,
  recordUsage: RecordApiUsageUseCase,
  logger: Logger,
): void {
  app.addHook('onSend', async (request, reply) => {
    const path = request.url.split('?')[0] ?? request.url;
    if (isVersionedApiPath(path)) {
      reply.header(PUBLIC_API_VERSION_HEADER, PUBLIC_API_VERSION);
    }
  });

  app.addHook('onResponse', async (request, reply) => {
    const path = request.url.split('?')[0] ?? request.url;
    if (!isVersionedApiPath(path) || isPublicApiDocumentationPath(path) || request.method === 'OPTIONS') {
      return;
    }
    const tenantId = request.tenantAccess?.tenantId ?? request.apiCredential?.tenantId;
    if (!tenantId) {
      return;
    }
    const userAgentHeader = request.headers['user-agent'];
    const authKind: PublicApiAuthKind = request.apiCredential?.kind ?? 'session';
    try {
      await recordUsage.execute({
        tenantId,
        actorId: request.auth?.userId ?? request.apiCredential?.actorId,
        authKind,
        credentialId: request.apiCredential?.credentialId,
        method: request.method,
        path,
        statusCode: reply.statusCode,
        durationMs: reply.elapsedTime,
        ipAddress: request.ip,
        userAgent: typeof userAgentHeader === 'string' ? userAgentHeader : undefined,
        requestId: request.requestContext?.requestId ?? request.id,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'API usage recording failed';
      logger.warn('Public API usage recording failed', { message, tenantId, path });
    }
  });
}
