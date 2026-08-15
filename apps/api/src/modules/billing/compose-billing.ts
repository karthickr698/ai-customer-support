import type { EventBus, Logger } from '@ai-customer-support/shared';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import type { ResolveTenantAccessUseCase } from '../organizations/application/use-cases/resolve-tenant-access-use-case.js';
import {
  registerBillingRoutes,
  type AuthenticatePreHandler,
} from './adapters/inbound/http/billing-routes.js';
import { SystemClock } from './adapters/outbound/clock/system-clock.js';
import { OrganizationsTenantAccessAdapter } from './adapters/outbound/organizations/organizations-tenant-access-adapter.js';
import {
  PostgresBillingCheckoutSessionRepository,
  PostgresBillingInvoiceRepository,
  PostgresBillingPaymentMethodRepository,
  PostgresBillingPlanRepository,
  PostgresBillingProviderEventRepository,
  PostgresBillingSubscriptionRepository,
  PostgresBillingUsageRepository,
} from './adapters/outbound/persistence/postgres-billing-repositories.js';
import {
  ConsolePaymentProvider,
  StripePaymentProvider,
} from './adapters/outbound/providers/payment-providers.js';
import type { PaymentProviderPort } from './application/ports.js';
import {
  CompleteBillingCheckoutUseCase,
  StartBillingCheckoutUseCase,
} from './application/use-cases/checkout-use-cases.js';
import {
  GetBillingInvoiceUseCase,
  IssueBillingInvoiceUseCase,
  ListBillingInvoicesUseCase,
  ListBillingPaymentMethodsUseCase,
  PayBillingInvoiceUseCase,
  VoidBillingInvoiceUseCase,
} from './application/use-cases/invoice-use-cases.js';
import { ListBillingPlansUseCase, SeedBillingPlansUseCase } from './application/use-cases/plan-use-cases.js';
import { RenewBillingSubscriptionsUseCase } from './application/use-cases/renew-subscriptions-use-case.js';
import {
  CancelBillingSubscriptionUseCase,
  ChangeBillingPlanUseCase,
  ResumeBillingSubscriptionUseCase,
} from './application/use-cases/subscription-mutation-use-cases.js';
import {
  GetBillingSubscriptionUseCase,
  ProvisionOrganizationSubscriptionUseCase,
} from './application/use-cases/subscription-query-use-cases.js';
import {
  CheckBillingQuotaUseCase,
  GetBillingUsageUseCase,
  RecordBillingUsageUseCase,
  RecordEventUsageUseCase,
} from './application/use-cases/usage-use-cases.js';
import {
  DispatchBillingRenewalUseCase,
  HandleBillingWebhookUseCase,
} from './application/use-cases/webhook-use-cases.js';
import { METERED_SOURCE_EVENTS } from './domain/catalog.js';
import { RENEWAL_INTERVAL_MS } from './domain/billing-policy.js';

export type BillingModule = {
  register(app: FastifyInstance): Promise<void>;
  start(): Promise<void>;
  stop(): void;
  readonly checkQuota: CheckBillingQuotaUseCase;
};

export function composeBilling(input: {
  readonly prisma: PrismaClient;
  readonly eventBus: EventBus;
  readonly logger: Logger;
  readonly authenticate: AuthenticatePreHandler;
  readonly resolveTenantAccess: ResolveTenantAccessUseCase;
  readonly billingProvider: 'console' | 'stripe';
  readonly stripeSecretKey?: string;
  readonly stripeWebhookSecret?: string;
  readonly stripeApiBaseUrl?: string;
  readonly billingWebhookSecret?: string;
  readonly successUrl: string;
  readonly cancelUrl: string;
  readonly allowLocalHttp: boolean;
}): BillingModule {
  const tenantAccess = new OrganizationsTenantAccessAdapter(input.resolveTenantAccess);
  const clock = new SystemClock();
  const plans = new PostgresBillingPlanRepository(input.prisma);
  const subscriptions = new PostgresBillingSubscriptionRepository(input.prisma);
  const checkouts = new PostgresBillingCheckoutSessionRepository(input.prisma);
  const usage = new PostgresBillingUsageRepository(input.prisma);
  const invoices = new PostgresBillingInvoiceRepository(input.prisma);
  const paymentMethods = new PostgresBillingPaymentMethodRepository(input.prisma);
  const providerEvents = new PostgresBillingProviderEventRepository(input.prisma);
  const provider = createPaymentProvider(input);
  const seedPlans = new SeedBillingPlansUseCase(plans, clock);
  const provision = new ProvisionOrganizationSubscriptionUseCase(
    plans,
    subscriptions,
    clock,
    input.eventBus,
    provider,
  );
  const recordUsage = new RecordBillingUsageUseCase(
    tenantAccess,
    plans,
    subscriptions,
    usage,
    clock,
    input.eventBus,
  );
  const recordEventUsage = new RecordEventUsageUseCase(recordUsage);
  const renew = new RenewBillingSubscriptionsUseCase(
    plans,
    subscriptions,
    usage,
    invoices,
    clock,
    input.eventBus,
    input.logger,
  );
  const checkQuota = new CheckBillingQuotaUseCase(tenantAccess, plans, subscriptions, usage);

  input.eventBus.subscribe('OrganizationCreated', async (event) => {
    if (!event.tenantId) {
      return;
    }
    const actorId =
      'ownerUserId' in event && typeof event.ownerUserId === 'string' ? event.ownerUserId : 'system';
    await provision.execute({
      tenantId: event.tenantId,
      actorId,
      correlationId: event.correlationId,
    });
  });
  for (const eventName of METERED_SOURCE_EVENTS) {
    input.eventBus.subscribe(eventName, (event) => recordEventUsage.handle(event));
  }

  let timer: NodeJS.Timeout | undefined;

  return {
    checkQuota,
    async register(app: FastifyInstance): Promise<void> {
      await registerBillingRoutes(
        app,
        {
          listPlans: new ListBillingPlansUseCase(plans),
          getSubscription: new GetBillingSubscriptionUseCase(tenantAccess, plans, subscriptions, provision),
          startCheckout: new StartBillingCheckoutUseCase(
            tenantAccess,
            plans,
            subscriptions,
            checkouts,
            provider,
            clock,
            provision,
            input.successUrl,
            input.cancelUrl,
            input.allowLocalHttp,
          ),
          completeCheckout: new CompleteBillingCheckoutUseCase(
            tenantAccess,
            plans,
            subscriptions,
            checkouts,
            paymentMethods,
            clock,
            input.eventBus,
          ),
          changePlan: new ChangeBillingPlanUseCase(
            tenantAccess,
            plans,
            subscriptions,
            provider,
            clock,
            input.eventBus,
          ),
          cancel: new CancelBillingSubscriptionUseCase(
            tenantAccess,
            plans,
            subscriptions,
            provider,
            clock,
            input.eventBus,
          ),
          resume: new ResumeBillingSubscriptionUseCase(
            tenantAccess,
            plans,
            subscriptions,
            clock,
            input.eventBus,
          ),
          getUsage: new GetBillingUsageUseCase(tenantAccess, plans, subscriptions, usage),
          recordUsage,
          checkQuota,
          listInvoices: new ListBillingInvoicesUseCase(tenantAccess, invoices),
          getInvoice: new GetBillingInvoiceUseCase(tenantAccess, invoices),
          issueInvoice: new IssueBillingInvoiceUseCase(
            tenantAccess,
            plans,
            subscriptions,
            usage,
            invoices,
            clock,
            input.eventBus,
          ),
          payInvoice: new PayBillingInvoiceUseCase(
            tenantAccess,
            invoices,
            subscriptions,
            plans,
            clock,
            input.eventBus,
          ),
          voidInvoice: new VoidBillingInvoiceUseCase(tenantAccess, invoices, clock),
          listPaymentMethods: new ListBillingPaymentMethodsUseCase(tenantAccess, paymentMethods),
          renew: new DispatchBillingRenewalUseCase(tenantAccess, renew),
          handleWebhook: new HandleBillingWebhookUseCase(
            provider,
            providerEvents,
            plans,
            subscriptions,
            checkouts,
            invoices,
            paymentMethods,
            clock,
            input.eventBus,
            input.logger,
          ),
        },
        input.authenticate,
        input.resolveTenantAccess,
      );
    },
    async start(): Promise<void> {
      await seedPlans.execute();
      timer = setInterval(() => {
        void renew.execute().catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Billing renewal failed';
          input.logger.warn('Billing renewal failed', { message });
        });
      }, RENEWAL_INTERVAL_MS);
      timer.unref();
    },
    stop(): void {
      if (timer) {
        clearInterval(timer);
      }
    },
  };
}

function createPaymentProvider(input: {
  readonly billingProvider: 'console' | 'stripe';
  readonly stripeSecretKey?: string;
  readonly stripeWebhookSecret?: string;
  readonly stripeApiBaseUrl?: string;
  readonly billingWebhookSecret?: string;
  readonly logger: Logger;
}): PaymentProviderPort {
  if (input.billingProvider === 'stripe') {
    return new StripePaymentProvider(
      input.stripeSecretKey ?? '',
      input.stripeWebhookSecret ?? '',
      input.stripeApiBaseUrl ?? 'https://api.stripe.com/v1',
      input.logger,
    );
  }
  return new ConsolePaymentProvider(input.logger, input.billingWebhookSecret);
}
