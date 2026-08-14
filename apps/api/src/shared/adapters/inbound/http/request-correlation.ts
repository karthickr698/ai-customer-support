import type { FastifyInstance } from 'fastify';

export function registerRequestCorrelation(app: FastifyInstance): void {
  app.addHook('onRequest', async (request, reply) => {
    const requestId = request.id;
    const correlationHeader = request.headers['x-correlation-id'];
    const correlationId =
      typeof correlationHeader === 'string' && correlationHeader.length > 0
        ? correlationHeader
        : requestId;

    // tenantId and actorId are set by authentication, not by client headers.
    request.requestContext = {
      requestId,
      correlationId,
    };

    request.log = request.log.child({
      requestId,
      correlationId,
    });

    reply.header('x-request-id', requestId);
    reply.header('x-correlation-id', correlationId);
  });
}
