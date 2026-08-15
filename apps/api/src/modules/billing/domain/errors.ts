import { DomainError } from '@ai-customer-support/shared';

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';

  constructor(message = 'Authentication required') {
    super(message, 401);
  }
}

export class InsufficientBillingPermissionError extends DomainError {
  readonly code = 'INSUFFICIENT_PERMISSION';

  constructor(permission?: string) {
    super(
      permission ? `Missing permission: ${permission}` : 'You do not have permission to perform this action',
      403,
    );
  }
}

export class InvalidBillingError extends DomainError {
  readonly code = 'INVALID_BILLING';

  constructor(message: string) {
    super(message, 400);
  }
}

export class InvalidBillingStateError extends DomainError {
  readonly code = 'INVALID_BILLING_STATE';

  constructor(message: string) {
    super(message, 400);
  }
}

export class BillingPlanNotFoundError extends DomainError {
  readonly code = 'BILLING_PLAN_NOT_FOUND';

  constructor() {
    super('Billing plan not found', 404);
  }
}

export class BillingSubscriptionNotFoundError extends DomainError {
  readonly code = 'BILLING_SUBSCRIPTION_NOT_FOUND';

  constructor() {
    super('Billing subscription not found', 404);
  }
}

export class BillingCheckoutNotFoundError extends DomainError {
  readonly code = 'BILLING_CHECKOUT_NOT_FOUND';

  constructor() {
    super('Checkout session not found', 404);
  }
}

export class BillingInvoiceNotFoundError extends DomainError {
  readonly code = 'BILLING_INVOICE_NOT_FOUND';

  constructor() {
    super('Invoice not found', 404);
  }
}

export class DuplicateBillingSubscriptionError extends DomainError {
  readonly code = 'DUPLICATE_BILLING_SUBSCRIPTION';

  constructor() {
    super('This organization already has a subscription', 409);
  }
}

export class DuplicateBillingInvoiceError extends DomainError {
  readonly code = 'DUPLICATE_BILLING_INVOICE';

  constructor() {
    super('An invoice for that billing period already exists', 409);
  }
}

export class QuotaExceededError extends DomainError {
  readonly code = 'QUOTA_EXCEEDED';

  constructor(metric: string) {
    super(`Usage quota exceeded for ${metric}`, 402);
  }
}

export class SubscriptionInactiveError extends DomainError {
  readonly code = 'SUBSCRIPTION_INACTIVE';

  constructor(status: string) {
    super(`Subscription is ${status} and cannot consume billed usage`, 402);
  }
}

export class BillingProviderError extends DomainError {
  readonly code = 'BILLING_PROVIDER_FAILED';

  constructor(message: string) {
    super(message, 502);
  }
}

export class InvalidBillingWebhookError extends DomainError {
  readonly code = 'INVALID_BILLING_WEBHOOK';

  constructor(message = 'Payment provider webhook is invalid') {
    super(message, 400);
  }
}
