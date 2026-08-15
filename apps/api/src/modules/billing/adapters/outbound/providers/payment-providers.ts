import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Logger } from '@ai-customer-support/shared';
import type {
  PaymentProviderPort,
  ProviderCheckoutInput,
  ProviderCheckoutResult,
  ProviderCustomerInput,
  ProviderSubscriptionUpdateInput,
} from '../../../application/ports.js';
import { BillingProviderError, InvalidBillingWebhookError } from '../../../domain/errors.js';
import type { NormalizedProviderEvent } from '../../../domain/provider-event.js';
import { jsonRecord, readString } from '../../../domain/values.js';

export class ConsolePaymentProvider implements PaymentProviderPort {
  readonly name = 'console' as const;

  constructor(
    private readonly logger: Logger,
    private readonly webhookSecret?: string,
  ) {}

  async createCustomer(input: ProviderCustomerInput): Promise<{ customerId: string }> {
    const customerId = `cus_console_${input.tenantId.replace(/-/g, '').slice(0, 16)}`;
    this.logger.info('Console billing customer created', { tenantId: input.tenantId, customerId });
    return { customerId };
  }

  async createCheckoutSession(input: ProviderCheckoutInput): Promise<ProviderCheckoutResult> {
    const sessionId = `cs_console_${crypto.randomUUID()}`;
    this.logger.info('Console billing checkout created', {
      tenantId: input.tenantId,
      planSlug: input.planSlug,
      sessionId,
    });
    return { sessionId, customerId: input.customerId };
  }

  async cancelSubscription(providerSubscriptionId: string, immediately: boolean): Promise<void> {
    this.logger.info('Console billing subscription canceled', { providerSubscriptionId, immediately });
  }

  async updateSubscriptionPlan(input: ProviderSubscriptionUpdateInput): Promise<void> {
    this.logger.info('Console billing subscription plan updated', {
      providerSubscriptionId: input.providerSubscriptionId,
      planName: input.planName,
    });
  }

  verifyWebhook(rawBody: string, signature: string | undefined): NormalizedProviderEvent {
    if (this.webhookSecret) {
      if (!signature) {
        throw new InvalidBillingWebhookError('Webhook signature is required');
      }
      const expected = createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
      const provided = signature.replace(/^sha256=/i, '');
      const a = Buffer.from(expected);
      const b = Buffer.from(provided);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        throw new InvalidBillingWebhookError('Webhook signature is invalid');
      }
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      throw new InvalidBillingWebhookError('Webhook body must be JSON');
    }
    const payload = jsonRecord(parsed);
    const data = jsonRecord(payload.data);
    const object = jsonRecord(data.object);
    const metadata = jsonRecord(object.metadata);
    const type = readString(payload, 'type');
    const id = readString(payload, 'id');
    if (!type || !id) {
      throw new InvalidBillingWebhookError('Webhook event id and type are required');
    }
    return {
      provider: 'console',
      providerEventId: id,
      type,
      tenantId: readString(object, 'client_reference_id') ?? readString(metadata, 'organizationId'),
      checkoutSessionId: readString(object, 'id') ?? readString(metadata, 'checkoutSessionId'),
      customerId: readString(object, 'customer'),
      subscriptionId: readString(object, 'subscription'),
      invoiceId: readString(object, 'invoice') ?? (type.startsWith('invoice.') ? readString(object, 'id') : undefined),
      planSlug: readString(metadata, 'planSlug'),
      status: readString(object, 'status'),
      amountPaidCents: typeof object.amount_paid === 'number' ? object.amount_paid : undefined,
      currency: readString(object, 'currency')?.toUpperCase(),
      payload,
    };
  }
}

export class StripePaymentProvider implements PaymentProviderPort {
  readonly name = 'stripe' as const;

  constructor(
    private readonly secretKey: string,
    private readonly webhookSecret: string,
    private readonly apiBaseUrl: string,
    private readonly logger: Logger,
  ) {
    if (!secretKey.trim()) {
      throw new BillingProviderError('STRIPE_SECRET_KEY is required when BILLING_PROVIDER=stripe');
    }
    if (!webhookSecret.trim()) {
      throw new BillingProviderError('STRIPE_WEBHOOK_SECRET is required when BILLING_PROVIDER=stripe');
    }
  }

  async createCustomer(input: ProviderCustomerInput): Promise<{ customerId: string }> {
    const customer = await this.post('/customers', {
      'metadata[organizationId]': input.tenantId,
      ...(input.email ? { email: input.email } : {}),
      ...(input.name ? { name: input.name } : {}),
    });
    const id = readString(customer, 'id');
    if (!id) {
      throw new BillingProviderError('Stripe did not return a customer id');
    }
    return { customerId: id };
  }

  async createCheckoutSession(input: ProviderCheckoutInput): Promise<ProviderCheckoutResult> {
    const body: Record<string, string> = {
      mode: 'subscription',
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.tenantId,
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': input.currency.toLowerCase(),
      'line_items[0][price_data][unit_amount]': String(input.amountCents),
      'line_items[0][price_data][product_data][name]': input.planName,
      'line_items[0][price_data][recurring][interval]': input.interval,
      'metadata[organizationId]': input.tenantId,
      'metadata[planSlug]': input.planSlug,
      'metadata[checkoutSessionId]': input.metadata.checkoutSessionId ?? '',
    };
    if (input.customerId) {
      body.customer = input.customerId;
    }
    const session = await this.post('/checkout/sessions', body);
    const sessionId = readString(session, 'id');
    if (!sessionId) {
      throw new BillingProviderError('Stripe did not return a checkout session id');
    }
    return {
      sessionId,
      url: readString(session, 'url'),
      customerId: readString(session, 'customer') ?? input.customerId,
    };
  }

  async cancelSubscription(providerSubscriptionId: string, immediately: boolean): Promise<void> {
    if (immediately) {
      await this.request('DELETE', `/subscriptions/${encodeURIComponent(providerSubscriptionId)}`);
      return;
    }
    await this.post(`/subscriptions/${encodeURIComponent(providerSubscriptionId)}`, {
      cancel_at_period_end: 'true',
    });
  }

  async updateSubscriptionPlan(input: ProviderSubscriptionUpdateInput): Promise<void> {
    this.logger.info('Stripe subscription plan change requested', {
      providerSubscriptionId: input.providerSubscriptionId,
      planName: input.planName,
    });
  }

  verifyWebhook(rawBody: string, signature: string | undefined): NormalizedProviderEvent {
    if (!signature) {
      throw new InvalidBillingWebhookError('Stripe-Signature header is required');
    }
    verifyStripeSignature(rawBody, signature, this.webhookSecret);
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      throw new InvalidBillingWebhookError('Webhook body must be JSON');
    }
    const payload = jsonRecord(parsed);
    const data = jsonRecord(payload.data);
    const object = jsonRecord(data.object);
    const metadata = jsonRecord(object.metadata);
    const type = readString(payload, 'type');
    const id = readString(payload, 'id');
    if (!type || !id) {
      throw new InvalidBillingWebhookError('Stripe event id and type are required');
    }
    const paymentDetails = jsonRecord(jsonRecord(object.payment_method_details).card);
    return {
      provider: 'stripe',
      providerEventId: id,
      type,
      tenantId: readString(object, 'client_reference_id') ?? readString(metadata, 'organizationId'),
      checkoutSessionId: type.startsWith('checkout.session.')
        ? readString(object, 'id')
        : readString(metadata, 'checkoutSessionId'),
      customerId: asId(object.customer),
      subscriptionId: asId(object.subscription) ?? (type.startsWith('customer.subscription.') ? readString(object, 'id') : undefined),
      invoiceId: asId(object.invoice) ?? (type.startsWith('invoice.') ? readString(object, 'id') : undefined),
      planSlug: readString(metadata, 'planSlug'),
      status: mapStripeStatus(readString(object, 'status')),
      amountPaidCents: typeof object.amount_paid === 'number' ? object.amount_paid : undefined,
      currency: readString(object, 'currency')?.toUpperCase(),
      paymentBrand: readString(paymentDetails, 'brand'),
      paymentLastFour: readString(paymentDetails, 'last4'),
      payload,
    };
  }

  private async post(path: string, body: Record<string, string>): Promise<Record<string, unknown>> {
    return this.request('POST', path, body);
  }

  private async request(
    method: string,
    path: string,
    body?: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    const url = `${this.apiBaseUrl.replace(/\/$/, '')}${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body ? new URLSearchParams(body) : undefined,
    });
    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new BillingProviderError('Stripe returned a non-JSON response');
    }
    const record = jsonRecord(parsed);
    if (!response.ok) {
      const error = jsonRecord(record.error);
      throw new BillingProviderError(readString(error, 'message') ?? `Stripe request failed (${response.status})`);
    }
    return record;
  }
}

function asId(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === 'string' ? id : undefined;
  }
  return undefined;
}

function mapStripeStatus(status: string | undefined): string | undefined {
  if (status === 'incomplete_expired') {
    return 'incomplete';
  }
  return status;
}

function verifyStripeSignature(payload: string, header: string, secret: string): void {
  const items = header.split(',').map((part) => part.trim());
  const timestamp = items.find((item) => item.startsWith('t='))?.slice(2);
  const signatures = items.filter((item) => item.startsWith('v1=')).map((item) => item.slice(3));
  if (!timestamp || signatures.length === 0) {
    throw new InvalidBillingWebhookError('Stripe-Signature header is malformed');
  }
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(Number(timestamp)) || age > 300) {
    throw new InvalidBillingWebhookError('Stripe webhook timestamp is too old');
  }
  const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  const expectedBuffer = Buffer.from(expected);
  const valid = signatures.some((signature) => {
    const provided = Buffer.from(signature);
    return provided.length === expectedBuffer.length && timingSafeEqual(provided, expectedBuffer);
  });
  if (!valid) {
    throw new InvalidBillingWebhookError('Stripe webhook signature is invalid');
  }
}
