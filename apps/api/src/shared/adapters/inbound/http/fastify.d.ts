import type { RequestContext } from '@ai-customer-support/shared';

declare module 'fastify' {
  interface FastifyRequest {
    requestContext: RequestContext;
  }
}

export {};
