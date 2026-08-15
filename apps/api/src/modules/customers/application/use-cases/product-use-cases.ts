import type { EventBus, PageRequest } from '@ai-customer-support/shared';
import type { ProductListResponse, ProductResponse } from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { CustomerPolicy, MAX_PRODUCTS_PER_TENANT } from '../../domain/customer-policy.js';
import { DuplicateProductError, InvalidProductError, ProductNotFoundError, TooManyCustomerRecordsError } from '../../domain/errors.js';
import { ProductRegisteredEvent } from '../../domain/events.js';
import { createProductId } from '../../domain/ids.js';
import { Product } from '../../domain/product.js';
import { isUuid, normalizeSku } from '../../domain/values.js';
import { toProductDto, type RequestSecurityContext } from '../dtos.js';
import type { ProductRepository } from '../ports/repositories.js';
import type { ClockPort, TenantAccessPort } from '../ports/tenant-access-port.js';

export class RegisterProductUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly products: ProductRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly sku: string;
    readonly name: string;
    readonly description?: string;
    readonly status?: string;
    readonly currency?: string;
    readonly priceAmount: number;
    readonly security: RequestSecurityContext;
  }): Promise<ProductResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    CustomerPolicy.assertPermission(actor.permissions, Permissions.CUSTOMER_MANAGE);
    const count = await this.products.countByTenant(actor.tenantId);
    if (count >= MAX_PRODUCTS_PER_TENANT) {
      throw new TooManyCustomerRecordsError('products');
    }
    const product = Product.create({
      organizationId: actor.tenantId,
      sku: input.sku,
      name: input.name,
      description: input.description,
      status: input.status,
      currency: input.currency,
      priceAmount: input.priceAmount,
      createdByUserId: actor.actorId,
      now: this.clock.now(),
    });
    if (await this.products.findBySku(actor.tenantId, product.sku)) {
      throw new DuplicateProductError();
    }
    await this.products.save(product);
    await this.eventBus.publish(
      new ProductRegisteredEvent(
        crypto.randomUUID(),
        product.createdAt,
        actor.tenantId,
        product.id,
        actor.actorId,
        input.security.correlationId,
      ),
    );
    return { product: toProductDto(product) };
  }
}

export class GetProductUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly products: ProductRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly productId?: string;
    readonly sku?: string;
  }): Promise<ProductResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    CustomerPolicy.assertPermission(actor.permissions, Permissions.CUSTOMER_READ);
    const product = await findProduct(this.products, actor.tenantId, input);
    if (!product || !product.belongsTo(actor.tenantId)) {
      throw new ProductNotFoundError();
    }
    return { product: toProductDto(product) };
  }
}

export class ListProductsUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly products: ProductRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly page: PageRequest;
    readonly sku?: string;
    readonly query?: string;
  }): Promise<ProductListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    CustomerPolicy.assertPermission(actor.permissions, Permissions.CUSTOMER_READ);
    const result = await this.products.listByTenant(actor.tenantId, input.page, {
      sku: input.sku ? normalizeSku(input.sku) : undefined,
      query: input.query?.trim() || undefined,
    });
    return {
      items: result.items.filter((item) => item.belongsTo(actor.tenantId)).map(toProductDto),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }
}

export async function findProduct(
  products: ProductRepository,
  tenantId: string,
  input: { readonly productId?: string; readonly sku?: string },
): Promise<Product | null> {
  if (input.productId) {
    if (!isUuid(input.productId)) {
      throw new InvalidProductError('productId must be a UUID');
    }
    return products.findById(tenantId, createProductId(input.productId));
  }
  if (input.sku) {
    return products.findBySku(tenantId, normalizeSku(input.sku));
  }
  throw new InvalidProductError('Provide productId or sku');
}
