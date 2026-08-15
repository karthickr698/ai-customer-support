import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  createRequirePermissionPreHandler,
  createResolveTenantPreHandler,
  Permissions,
  type ResolveTenantAccessUseCase,
} from '../../../../organizations/index.js';
import type { RequestSecurityContext } from '../../../application/dtos.js';
import type {
  GetCustomerUseCase,
  ListCustomersUseCase,
  RegisterCustomerUseCase,
} from '../../../application/use-cases/customer-use-cases.js';
import type {
  GetOrderUseCase,
  ListOrdersUseCase,
  RegisterOrderUseCase,
} from '../../../application/use-cases/order-use-cases.js';
import type {
  GetProductUseCase,
  ListProductsUseCase,
  RegisterProductUseCase,
} from '../../../application/use-cases/product-use-cases.js';
import type {
  GetReturnUseCase,
  ListReturnsUseCase,
  RegisterReturnUseCase,
} from '../../../application/use-cases/return-use-cases.js';
import type {
  GetShipmentUseCase,
  ListShipmentsUseCase,
  RegisterShipmentUseCase,
} from '../../../application/use-cases/shipment-use-cases.js';
import { UnauthorizedError } from '../../../domain/errors.js';
import {
  customerListQuerySchema,
  orderListQuerySchema,
  productListQuerySchema,
  registerCustomerBodySchema,
  registerOrderBodySchema,
  registerProductBodySchema,
  registerReturnBodySchema,
  registerShipmentBodySchema,
  returnListQuerySchema,
  shipmentListQuerySchema,
} from './customer-schemas.js';
import { parseBody } from './parse-body.js';

export type CustomerHttpUseCases = {
  readonly registerCustomer: RegisterCustomerUseCase;
  readonly getCustomer: GetCustomerUseCase;
  readonly listCustomers: ListCustomersUseCase;
  readonly registerProduct: RegisterProductUseCase;
  readonly getProduct: GetProductUseCase;
  readonly listProducts: ListProductsUseCase;
  readonly registerOrder: RegisterOrderUseCase;
  readonly getOrder: GetOrderUseCase;
  readonly listOrders: ListOrdersUseCase;
  readonly registerShipment: RegisterShipmentUseCase;
  readonly getShipment: GetShipmentUseCase;
  readonly listShipments: ListShipmentsUseCase;
  readonly registerReturn: RegisterReturnUseCase;
  readonly getReturn: GetReturnUseCase;
  readonly listReturns: ListReturnsUseCase;
};

export type AuthenticatePreHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

export async function registerCustomerRoutes(
  app: FastifyInstance,
  useCases: CustomerHttpUseCases,
  authenticate: AuthenticatePreHandler,
  resolveTenantAccess: ResolveTenantAccessUseCase,
): Promise<void> {
  const resolveTenant = createResolveTenantPreHandler(resolveTenantAccess);
  const requireRead = createRequirePermissionPreHandler(Permissions.CUSTOMER_READ);
  const requireManage = createRequirePermissionPreHandler(Permissions.CUSTOMER_MANAGE);
  const tenantAuth = [authenticate, resolveTenant];
  const org = '/api/organizations/:organizationId';

  app.post(`${org}/customers`, { preHandler: [...tenantAuth, requireManage] }, async (request, reply) => {
    const body = parseBody(registerCustomerBodySchema, request.body);
    const result = await useCases.registerCustomer.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      email: body.email,
      name: body.name,
      phone: body.phone,
      status: body.status,
      externalCustomerId: body.externalCustomerId,
      security: securityContext(request),
    });
    return reply.status(201).send(result);
  });

  app.get(`${org}/customers`, { preHandler: [...tenantAuth, requireRead] }, async (request, reply) => {
    const query = parseBody(customerListQuerySchema, request.query);
    const result = await useCases.listCustomers.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      page: { page: query.page, pageSize: query.pageSize },
      email: query.email,
      query: query.q,
    });
    return reply.status(200).send(result);
  });

  app.get(`${org}/customers/:customerId`, { preHandler: [...tenantAuth, requireRead] }, async (request, reply) => {
    const result = await useCases.getCustomer.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      customerId: routeParam(request, 'customerId'),
    });
    return reply.status(200).send(result);
  });

  app.post(`${org}/products`, { preHandler: [...tenantAuth, requireManage] }, async (request, reply) => {
    const body = parseBody(registerProductBodySchema, request.body);
    const result = await useCases.registerProduct.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      sku: body.sku,
      name: body.name,
      description: body.description,
      status: body.status,
      currency: body.currency,
      priceAmount: body.priceAmount,
      security: securityContext(request),
    });
    return reply.status(201).send(result);
  });

  app.get(`${org}/products`, { preHandler: [...tenantAuth, requireRead] }, async (request, reply) => {
    const query = parseBody(productListQuerySchema, request.query);
    const result = await useCases.listProducts.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      page: { page: query.page, pageSize: query.pageSize },
      sku: query.sku,
      query: query.q,
    });
    return reply.status(200).send(result);
  });

  app.get(`${org}/products/:productId`, { preHandler: [...tenantAuth, requireRead] }, async (request, reply) => {
    const result = await useCases.getProduct.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      productId: routeParam(request, 'productId'),
    });
    return reply.status(200).send(result);
  });

  app.post(`${org}/orders`, { preHandler: [...tenantAuth, requireManage] }, async (request, reply) => {
    const body = parseBody(registerOrderBodySchema, request.body);
    const result = await useCases.registerOrder.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      customerId: body.customerId,
      externalOrderId: body.externalOrderId,
      status: body.status,
      currency: body.currency,
      totalAmount: body.totalAmount,
      lineItems: body.lineItems,
      placedAt: body.placedAt,
      security: securityContext(request),
    });
    return reply.status(201).send(result);
  });

  app.get(`${org}/orders`, { preHandler: [...tenantAuth, requireRead] }, async (request, reply) => {
    const query = parseBody(orderListQuerySchema, request.query);
    const result = await useCases.listOrders.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      page: { page: query.page, pageSize: query.pageSize },
      customerId: query.customerId,
      externalOrderId: query.externalOrderId,
    });
    return reply.status(200).send(result);
  });

  app.get(`${org}/orders/:orderId`, { preHandler: [...tenantAuth, requireRead] }, async (request, reply) => {
    const result = await useCases.getOrder.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      orderId: routeParam(request, 'orderId'),
    });
    return reply.status(200).send(result);
  });

  app.post(`${org}/shipments`, { preHandler: [...tenantAuth, requireManage] }, async (request, reply) => {
    const body = parseBody(registerShipmentBodySchema, request.body);
    const result = await useCases.registerShipment.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      orderId: body.orderId,
      trackingNumber: body.trackingNumber,
      carrier: body.carrier,
      status: body.status,
      shippedAt: body.shippedAt,
      estimatedDeliveryAt: body.estimatedDeliveryAt,
      security: securityContext(request),
    });
    return reply.status(201).send(result);
  });

  app.get(`${org}/shipments`, { preHandler: [...tenantAuth, requireRead] }, async (request, reply) => {
    const query = parseBody(shipmentListQuerySchema, request.query);
    const result = await useCases.listShipments.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      page: { page: query.page, pageSize: query.pageSize },
      orderId: query.orderId,
      trackingNumber: query.trackingNumber,
    });
    return reply.status(200).send(result);
  });

  app.get(`${org}/shipments/:shipmentId`, { preHandler: [...tenantAuth, requireRead] }, async (request, reply) => {
    const result = await useCases.getShipment.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      shipmentId: routeParam(request, 'shipmentId'),
    });
    return reply.status(200).send(result);
  });

  app.post(`${org}/returns`, { preHandler: [...tenantAuth, requireManage] }, async (request, reply) => {
    const body = parseBody(registerReturnBodySchema, request.body);
    const result = await useCases.registerReturn.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      orderId: body.orderId,
      status: body.status,
      reason: body.reason,
      requestedAt: body.requestedAt,
      security: securityContext(request),
    });
    return reply.status(201).send(result);
  });

  app.get(`${org}/returns`, { preHandler: [...tenantAuth, requireRead] }, async (request, reply) => {
    const query = parseBody(returnListQuerySchema, request.query);
    const result = await useCases.listReturns.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      page: { page: query.page, pageSize: query.pageSize },
      orderId: query.orderId,
    });
    return reply.status(200).send(result);
  });

  app.get(`${org}/returns/:returnId`, { preHandler: [...tenantAuth, requireRead] }, async (request, reply) => {
    const result = await useCases.getReturn.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      returnId: routeParam(request, 'returnId'),
    });
    return reply.status(200).send(result);
  });
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
