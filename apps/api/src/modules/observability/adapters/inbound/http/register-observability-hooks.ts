import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Logger } from '@ai-customer-support/shared';
import type { RecordHttpObservabilityUseCase } from '../../../application/use-cases/record-http-observability-use-case.js';
import { shouldSkipObservabilityPath } from '../../../domain/route-template.js';

const STARTED_AT = Symbol('observabilityStartedAt');
const ERROR_CODE = Symbol('observabilityErrorCode');

type InstrumentedRequest = FastifyRequest & {
  [STARTED_AT]?: number;
  [ERROR_CODE]?: string;
};

export function registerObservabilityHooks(
  app: FastifyInstance,
  input: {
    readonly recordHttp: RecordHttpObservabilityUseCase;
    readonly logger: Logger;
  },
): void {
  app.addHook('onRequest', async (request, reply) => {
    const path = request.url.split('?')[0] ?? request.url;
    if (request.method === 'OPTIONS' || shouldSkipObservabilityPath(path)) {
      return;
    }
    const traceHeader = request.headers['x-trace-id'];
    const traceId =
      typeof traceHeader === 'string' && traceHeader.length > 0
        ? traceHeader
        : (request.requestContext.correlationId ?? request.id);
    const spanId = crypto.randomUUID();
    request.requestContext = {
      ...request.requestContext,
      traceId,
      spanId,
    };
    request.log = request.log.child({ traceId, spanId });
    (request as InstrumentedRequest)[STARTED_AT] = Date.now();
    reply.header('x-trace-id', traceId);
    reply.header('x-span-id', spanId);
  });

  app.addHook('onSend', async (request, _reply, payload) => {
    const code = errorCodeFromPayload(payload);
    if (code) {
      (request as InstrumentedRequest)[ERROR_CODE] = code;
    }
    return payload;
  });

  app.addHook('onResponse', async (request, reply) => {
    const path = request.url.split('?')[0] ?? request.url;
    if (request.method === 'OPTIONS' || shouldSkipObservabilityPath(path)) {
      return;
    }
    const startedAtMs = (request as InstrumentedRequest)[STARTED_AT];
    if (!startedAtMs) {
      return;
    }
    try {
      await input.recordHttp.execute({
        startedAt: new Date(startedAtMs),
        endedAt: new Date(),
        method: request.method,
        path,
        statusCode: reply.statusCode,
        requestId: request.requestContext.requestId,
        correlationId: request.requestContext.correlationId,
        traceId: request.requestContext.traceId ?? request.requestContext.correlationId,
        spanId: request.requestContext.spanId ?? request.id,
        organizationId: request.requestContext.tenantId,
        actorId: request.requestContext.actorId,
        errorCode: (request as InstrumentedRequest)[ERROR_CODE],
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Observability persist failed';
      input.logger.warn('Failed to record HTTP observability', { message });
    }
  });
}

function errorCodeFromPayload(payload: unknown): string | undefined {
  if (typeof payload !== 'string') {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(payload);
    if (typeof parsed !== 'object' || parsed === null || !('error' in parsed)) {
      return undefined;
    }
    const error = (parsed as { error?: { code?: unknown } }).error;
    return typeof error?.code === 'string' ? error.code : undefined;
  } catch {
    return undefined;
  }
}
