import type { EventBus } from '@ai-customer-support/shared';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import type { ResolveTenantAccessUseCase } from '../organizations/application/use-cases/resolve-tenant-access-use-case.js';
import {
  registerCustomerRoutes,
  type AuthenticatePreHandler,
} from './adapters/inbound/http/customer-routes.js';
import { TenantBusinessDataLookupAdapter } from './adapters/inbound/tools/tenant-business-data-lookup-adapter.js';
import { SystemClock } from './adapters/outbound/clock/system-clock.js';
import { OrganizationsTenantAccessAdapter } from './adapters/outbound/organizations/organizations-tenant-access-adapter.js';
import {
  PostgresCustomerRepository,
  PostgresOrderRepository,
  PostgresProductRepository,
  PostgresReturnRepository,
  PostgresShipmentRepository,
} from './adapters/outbound/persistence/postgres-commerce-repositories.js';
import type { BusinessDataLookupPort } from './application/ports/repositories.js';
import {
  GetCustomerUseCase,
  ListCustomersUseCase,
  RegisterCustomerUseCase,
} from './application/use-cases/customer-use-cases.js';
import {
  GetOrderUseCase,
  ListOrdersUseCase,
  RegisterOrderUseCase,
} from './application/use-cases/order-use-cases.js';
import {
  GetProductUseCase,
  ListProductsUseCase,
  RegisterProductUseCase,
} from './application/use-cases/product-use-cases.js';
import {
  GetReturnUseCase,
  ListReturnsUseCase,
  RegisterReturnUseCase,
} from './application/use-cases/return-use-cases.js';
import {
  GetShipmentUseCase,
  ListShipmentsUseCase,
  RegisterShipmentUseCase,
} from './application/use-cases/shipment-use-cases.js';

export type CustomersModule = {
  readonly lookup: BusinessDataLookupPort;
  register(app: FastifyInstance): Promise<void>;
};

export function composeCustomers(input: {
  readonly prisma: PrismaClient;
  readonly eventBus: EventBus;
  readonly authenticate: AuthenticatePreHandler;
  readonly resolveTenantAccess: ResolveTenantAccessUseCase;
}): CustomersModule {
  const tenantAccess = new OrganizationsTenantAccessAdapter(input.resolveTenantAccess);
  const clock = new SystemClock();
  const customers = new PostgresCustomerRepository(input.prisma);
  const products = new PostgresProductRepository(input.prisma);
  const orders = new PostgresOrderRepository(input.prisma);
  const shipments = new PostgresShipmentRepository(input.prisma);
  const returns = new PostgresReturnRepository(input.prisma);

  const registerCustomer = new RegisterCustomerUseCase(tenantAccess, customers, clock, input.eventBus);
  const getCustomer = new GetCustomerUseCase(tenantAccess, customers);
  const listCustomers = new ListCustomersUseCase(tenantAccess, customers);
  const registerProduct = new RegisterProductUseCase(tenantAccess, products, clock, input.eventBus);
  const getProduct = new GetProductUseCase(tenantAccess, products);
  const listProducts = new ListProductsUseCase(tenantAccess, products);
  const registerOrder = new RegisterOrderUseCase(tenantAccess, orders, customers, clock, input.eventBus);
  const getOrder = new GetOrderUseCase(tenantAccess, orders);
  const listOrders = new ListOrdersUseCase(tenantAccess, orders);
  const registerShipment = new RegisterShipmentUseCase(
    tenantAccess,
    shipments,
    orders,
    clock,
    input.eventBus,
  );
  const getShipment = new GetShipmentUseCase(tenantAccess, shipments);
  const listShipments = new ListShipmentsUseCase(tenantAccess, shipments);
  const registerReturn = new RegisterReturnUseCase(tenantAccess, returns, orders, clock, input.eventBus);
  const getReturn = new GetReturnUseCase(tenantAccess, returns, orders);
  const listReturns = new ListReturnsUseCase(tenantAccess, returns);

  return {
    lookup: new TenantBusinessDataLookupAdapter(
      tenantAccess,
      customers,
      products,
      orders,
      shipments,
      returns,
    ),
    async register(app: FastifyInstance): Promise<void> {
      await registerCustomerRoutes(
        app,
        {
          registerCustomer,
          getCustomer,
          listCustomers,
          registerProduct,
          getProduct,
          listProducts,
          registerOrder,
          getOrder,
          listOrders,
          registerShipment,
          getShipment,
          listShipments,
          registerReturn,
          getReturn,
          listReturns,
        },
        input.authenticate,
        input.resolveTenantAccess,
      );
    },
  };
}
