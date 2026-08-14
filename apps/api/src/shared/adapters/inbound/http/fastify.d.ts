import type { RequestContext } from '@ai-customer-support/shared';

declare module 'fastify' {
  interface FastifyRequest {
    requestContext: RequestContext;
    auth?: {
      userId: string;
      email: string;
    };
    tenantAccess?: {
      tenantId: string;
      membershipId: string;
      role: string;
      permissions: readonly string[];
    };
  }
}

export {};
