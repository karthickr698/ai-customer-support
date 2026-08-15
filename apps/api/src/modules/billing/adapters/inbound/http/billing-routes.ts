import { Readable } from 'node:stream';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  createRequirePermissionPreHandler,
  createResolveTenantPreHandler,
  Permissions,
  type ResolveTenantAccessUseCase,
} from '../../../../organizations/index.js';
import type { RequestSecurityContext } from '../../../application/dtos.js';
import type { StartBillingCheckoutUseCase, CompleteBillingCheckoutUseCase } from '../../../application/use-cases/checkout-use-cases.js';
import type {
  GetBillingInvoiceUseCase,
  IssueBillingInvoiceUseCase,
  ListBillingInvoicesUseCase,
  ListBillingPaymentMethodsUseCase,
  PayBillingInvoiceUseCase,
  VoidBillingInvoiceUseCase,
} from '../../../application/use-cases/invoice-use-cases.js';
import type { ListBillingPlansUseCase } from '../../../application/use-cases/plan-use-cases.js';
import type {
  CancelBillingSubscriptionUseCase,
  ChangeBillingPlanUseCase,
  ResumeBillingSubscriptionUseCase,
} from '../../../application/use-cases/subscription-mutation-use-cases.js';
import type { GetBillingSubscriptionUseCase } from '../../../application/use-cases/subscription-query-use-cases.js';
import type {
  CheckBillingQuotaUseCase,
  GetBillingUsageUseCase,
  RecordBillingUsageUseCase,
} from '../../../application/use-cases/usage-use-cases.js';
import type {
  DispatchBillingRenewalUseCase,
  HandleBillingWebhookUseCase,
} from '../../../application/use-cases/webhook-use-cases.js';
import { UnauthorizedError } from '../../../domain/errors.js';
import {
  cancelSubscriptionBodySchema,
  changePlanBodySchema,
  checkQuotaBodySchema,
  completeCheckoutBodySchema,
  invoiceListQuerySchema,
  issueInvoiceBodySchema,
  recordUsageBodySchema,
  startCheckoutBodySchema,
} from './billing-schemas.js';
import { parseBody } from './parse-body.js';

export type BillingHttpUseCases = {
  readonly listPlans: ListBillingPlansUseCase;
  readonly getSubscription: GetBillingSubscriptionUseCase;
  readonly startCheckout: StartBillingCheckoutUseCase;
  readonly completeCheckout: CompleteBillingCheckoutUseCase;
  readonly changePlan: ChangeBillingPlanUseCase;
  readonly cancel: CancelBillingSubscriptionUseCase;
  readonly resume: ResumeBillingSubscriptionUseCase;
  readonly getUsage: GetBillingUsageUseCase;
  readonly recordUsage: RecordBillingUsageUseCase;
  readonly checkQuota: CheckBillingQuotaUseCase;
  readonly listInvoices: ListBillingInvoicesUseCase;
  readonly getInvoice: GetBillingInvoiceUseCase;
  readonly issueInvoice: IssueBillingInvoiceUseCase;
  readonly payInvoice: PayBillingInvoiceUseCase;
  readonly voidInvoice: VoidBillingInvoiceUseCase;
  readonly listPaymentMethods: ListBillingPaymentMethodsUseCase;
  readonly renew: DispatchBillingRenewalUseCase;
  readonly handleWebhook: HandleBillingWebhookUseCase;
};

export type AuthenticatePreHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

type RequestWithRawBody = FastifyRequest & { rawBody?: string };

export async function registerBillingRoutes(
  app: FastifyInstance,
  useCases: BillingHttpUseCases,
  authenticate: AuthenticatePreHandler,
  resolveTenantAccess: ResolveTenantAccessUseCase,
): Promise<void> {
  const resolveTenant = createResolveTenantPreHandler(resolveTenantAccess);
  const requireRead = createRequirePermissionPreHandler(Permissions.BILLING_READ);
  const requireManage = createRequirePermissionPreHandler(Permissions.BILLING_MANAGE);
  const tenantAuth = [authenticate, resolveTenant];
  const org = '/api/organizations/:organizationId';

  app.get('/api/billing/plans', { preHandler: [authenticate] }, async (_request, reply) => {
    const result = await useCases.listPlans.execute();
    return reply.status(200).send(result);
  });

  app.post(
    '/api/billing/webhooks/:provider',
    {
      preParsing: async (request: RequestWithRawBody, _reply, payload) => {
        const chunks: Buffer[] = [];
        for await (const chunk of payload) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const raw = Buffer.concat(chunks);
        request.rawBody = raw.toString('utf8');
        return Readable.from(raw);
      },
    },
    async (request: RequestWithRawBody, reply) => {
      const signatureHeader = request.headers['stripe-signature'] ?? request.headers['x-billing-signature'];
      const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
      const result = await useCases.handleWebhook.execute({
        rawBody: request.rawBody ?? JSON.stringify(request.body ?? {}),
        signature,
      });
      return reply.status(200).send(result);
    },
  );

  app.get(
    `${org}/billing/subscription`,
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const result = await useCases.getSubscription.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    `${org}/billing/checkout`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const body = parseBody(startCheckoutBodySchema, request.body);
      const result = await useCases.startCheckout.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        ...body,
        security: securityContext(request),
      });
      return reply.status(201).send(result);
    },
  );

  app.post(
    `${org}/billing/checkout/complete`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const body = parseBody(completeCheckoutBodySchema, request.body);
      const result = await useCases.completeCheckout.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        sessionId: body.sessionId,
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    `${org}/billing/subscription/change-plan`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const body = parseBody(changePlanBodySchema, request.body);
      const result = await useCases.changePlan.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        planSlug: body.planSlug,
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    `${org}/billing/subscription/cancel`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const body = parseBody(cancelSubscriptionBodySchema, request.body ?? {});
      const result = await useCases.cancel.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        immediately: body.immediately,
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    `${org}/billing/subscription/resume`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const result = await useCases.resume.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.get(
    `${org}/billing/usage`,
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const result = await useCases.getUsage.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    `${org}/billing/usage`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const body = parseBody(recordUsageBodySchema, request.body);
      const result = await useCases.recordUsage.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        ...body,
        security: securityContext(request),
      });
      return reply.status(201).send(result);
    },
  );

  app.get(
    `${org}/billing/quotas`,
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const result = await useCases.getUsage.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    `${org}/billing/quotas/check`,
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const body = parseBody(checkQuotaBodySchema, request.body);
      const result = await useCases.checkQuota.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        metric: body.metric,
        quantity: body.quantity,
      });
      return reply.status(200).send(result);
    },
  );

  app.get(
    `${org}/billing/invoices`,
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const query = parseBody(invoiceListQuerySchema, request.query);
      const result = await useCases.listInvoices.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        page: { page: query.page, pageSize: query.pageSize },
        status: query.status,
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    `${org}/billing/invoices`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const body = parseBody(issueInvoiceBodySchema, request.body ?? {});
      const result = await useCases.issueInvoice.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
        security: securityContext(request),
      });
      return reply.status(201).send(result);
    },
  );

  app.get(
    `${org}/billing/invoices/:invoiceId`,
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const result = await useCases.getInvoice.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        invoiceId: routeParam(request, 'invoiceId'),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    `${org}/billing/invoices/:invoiceId/pay`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const result = await useCases.payInvoice.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        invoiceId: routeParam(request, 'invoiceId'),
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    `${org}/billing/invoices/:invoiceId/void`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const result = await useCases.voidInvoice.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        invoiceId: routeParam(request, 'invoiceId'),
      });
      return reply.status(200).send(result);
    },
  );

  app.get(
    `${org}/billing/payment-methods`,
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const result = await useCases.listPaymentMethods.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    `${org}/billing/renew`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const result = await useCases.renew.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
      });
      return reply.status(200).send(result);
    },
  );
}

function requireUserId(request: FastifyRequest): string {
  if (!request.auth) {
    throw new UnauthorizedError();
  }
  return request.auth.userId;
}

function requireTenantId(request: FastifyRequest): string {
  const tenantId = request.tenantAccess?.tenantId ?? request.requestContext.tenantId;
  if (!tenantId) {
    throw new UnauthorizedError('Select an organization to continue');
  }
  return tenantId;
}

function routeParam(request: FastifyRequest, key: string): string {
  const params = request.params as Record<string, unknown>;
  const value = params[key];
  return typeof value === 'string' ? value : '';
}

function securityContext(request: FastifyRequest): RequestSecurityContext {
  const userAgentHeader = request.headers['user-agent'];
  return {
    ipAddress: request.ip,
    userAgent: typeof userAgentHeader === 'string' ? userAgentHeader : undefined,
    requestId: request.requestContext.requestId,
    correlationId: request.requestContext.correlationId,
  };
}
