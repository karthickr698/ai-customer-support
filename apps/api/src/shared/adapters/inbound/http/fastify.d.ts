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
    widgetSession?: {
      sessionId: string;
      organizationId: string;
      visitorId: string;
      kind: 'anonymous' | 'customer';
      email?: string;
      name?: string;
      customerId?: string;
    };
    apiCredential?: {
      kind: 'api_key' | 'oauth_token';
      tenantId: string;
      actorId: string;
      credentialId: string;
      scopes: readonly string[];
    };
  }
}

export {};
