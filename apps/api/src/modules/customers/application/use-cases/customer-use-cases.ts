import type { EventBus, PageRequest } from '@ai-customer-support/shared';
import type { CustomerListResponse, CustomerResponse } from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import {
  MAX_CUSTOMERS_PER_TENANT,
  CustomerPolicy,
} from '../../domain/customer-policy.js';
import { Customer } from '../../domain/customer.js';
import {
  CustomerNotFoundError,
  DuplicateCustomerError,
  InvalidCustomerRecordError,
  TooManyCustomerRecordsError,
} from '../../domain/errors.js';
import { CustomerRegisteredEvent } from '../../domain/events.js';
import { createCustomerId } from '../../domain/ids.js';
import { isUuid, normalizeEmail } from '../../domain/values.js';
import { toCustomerDto, type RequestSecurityContext } from '../dtos.js';
import type { ClockPort, TenantAccessPort } from '../ports/tenant-access-port.js';
import type { CustomerRepository } from '../ports/repositories.js';

export class RegisterCustomerUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly customers: CustomerRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly email: string;
    readonly name: string;
    readonly phone?: string;
    readonly status?: string;
    readonly externalCustomerId?: string;
    readonly security: RequestSecurityContext;
  }): Promise<CustomerResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    CustomerPolicy.assertPermission(actor.permissions, Permissions.CUSTOMER_MANAGE);

    const count = await this.customers.countByTenant(actor.tenantId);
    if (count >= MAX_CUSTOMERS_PER_TENANT) {
      throw new TooManyCustomerRecordsError('customers');
    }

    const customer = Customer.create({
      organizationId: actor.tenantId,
      email: input.email,
      name: input.name,
      phone: input.phone,
      status: input.status,
      externalCustomerId: input.externalCustomerId,
      createdByUserId: actor.actorId,
      now: this.clock.now(),
    });
    const existing = await this.customers.findByEmail(actor.tenantId, customer.email);
    if (existing) {
      throw new DuplicateCustomerError();
    }
    await this.customers.save(customer);
    await this.eventBus.publish(
      new CustomerRegisteredEvent(
        crypto.randomUUID(),
        customer.createdAt,
        actor.tenantId,
        customer.id,
        actor.actorId,
        input.security.correlationId,
      ),
    );
    return { customer: toCustomerDto(customer) };
  }
}

export class GetCustomerUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly customers: CustomerRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly customerId?: string;
    readonly email?: string;
  }): Promise<CustomerResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    CustomerPolicy.assertPermission(actor.permissions, Permissions.CUSTOMER_READ);
    const customer = await findCustomer(this.customers, actor.tenantId, input);
    if (!customer || !customer.belongsTo(actor.tenantId)) {
      throw new CustomerNotFoundError();
    }
    return { customer: toCustomerDto(customer) };
  }
}

export class ListCustomersUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly customers: CustomerRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly page: PageRequest;
    readonly email?: string;
    readonly query?: string;
  }): Promise<CustomerListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    CustomerPolicy.assertPermission(actor.permissions, Permissions.CUSTOMER_READ);
    const result = await this.customers.listByTenant(actor.tenantId, input.page, {
      email: input.email ? normalizeEmail(input.email) : undefined,
      query: input.query?.trim() || undefined,
    });
    return {
      items: result.items.filter((item) => item.belongsTo(actor.tenantId)).map(toCustomerDto),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }
}

export async function findCustomer(
  customers: CustomerRepository,
  tenantId: string,
  input: { readonly customerId?: string; readonly email?: string },
): Promise<Customer | null> {
  if (input.customerId) {
    if (!isUuid(input.customerId)) {
      throw new InvalidCustomerRecordError('customerId must be a UUID');
    }
    return customers.findById(tenantId, createCustomerId(input.customerId));
  }
  if (input.email) {
    return customers.findByEmail(tenantId, normalizeEmail(input.email));
  }
  throw new InvalidCustomerRecordError('Provide customerId or email');
}
