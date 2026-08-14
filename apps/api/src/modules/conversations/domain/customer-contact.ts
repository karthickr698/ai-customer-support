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
}
