import type { FastifyInstance } from 'fastify';

export function registerRequestCorrelation(app: FastifyInstance): void {
  app.addHook('onRequest', async (request, reply) => {
    const requestId = request.id;
    const correlationHeader = request.headers['x-correlation-id'];
    const correlationId =
      typeof correlationHeader === 'string' && correlationHeader.length > 0
        ? correlationHeader
        : requestId;

    const traceHeader = request.headers['x-trace-id'];
    const traceId =
      typeof traceHeader === 'string' && traceHeader.length > 0 ? traceHeader : correlationId;

    // tenantId and actorId are set by authentication, not by client headers.
    request.requestContext = {
      requestId,
      correlationId,
      traceId,
    };

    request.log = request.log.child({
      requestId,
      correlationId,
      traceId,
    });

    reply.header('x-request-id', requestId);
    reply.header('x-correlation-id', correlationId);
    reply.header('x-trace-id', traceId);
  });
}
