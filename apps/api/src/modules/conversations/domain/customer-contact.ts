import { InvalidCustomerEmailError, InvalidCustomerNameError } from './errors.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class CustomerContact {
  private constructor(
    readonly email: string,
    readonly name: string,
    readonly customerId: string | undefined,
  ) {}

  static parse(input: {
    readonly email: string;
    readonly name: string;
    readonly customerId?: string;
  }): CustomerContact {
    return CustomerContact.create(input);
  }

  static forWidgetVisitor(input: {
    readonly visitorId: string;
    readonly email?: string;
    readonly name?: string;
    readonly customerId?: string;
  }): CustomerContact {
    const email = input.email?.trim();
    return CustomerContact.create({
      email: email && email.length > 0 ? email : anonymousVisitorEmail(input.visitorId),
      name: input.name?.trim() || 'Visitor',
      customerId: input.customerId,
    });
  }

  static create(input: {
    readonly email: string;
    readonly name: string;
    readonly customerId?: string;
  }): CustomerContact {
    const email = input.email.trim().toLowerCase();
    if (email.length === 0 || email.length > 254 || !EMAIL_PATTERN.test(email)) {
      throw new InvalidCustomerEmailError();
    }

    const name = input.name.trim();
    if (name.length < 1 || name.length > 80) {
      throw new InvalidCustomerNameError();
    }

    const customerId = input.customerId?.trim();

    return new CustomerContact(
      email,
      name,
      customerId && customerId.length > 0 ? customerId : undefined,
    );
  }

  get isAnonymous(): boolean {
    return this.email.endsWith('@widget.invalid');
  }
}

export function anonymousVisitorEmail(visitorId: string): string {
  const id = visitorId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 32) || 'unknown';
  return `visitor-${id}@widget.invalid`;
}
