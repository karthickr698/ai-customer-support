import type { RequestContext } from '@ai-customer-support/shared';

declare module 'fastify' {
  interface FastifyRequest {
    requestContext: RequestContext;
    auth?: {
      userId: string;
      email: string;
    };
  }
}

export {};
