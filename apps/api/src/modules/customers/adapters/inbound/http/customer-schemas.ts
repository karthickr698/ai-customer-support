import {
  CUSTOMER_STATUSES,
  ORDER_STATUSES,
  PRODUCT_STATUSES,
  RETURN_STATUSES,
  SHIPMENT_STATUSES,
} from '@ai-customer-support/contracts';
import { z } from 'zod';

const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

export const registerCustomerBodySchema = z.object({
  email: z.string().trim().email().max(254),
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(1).max(32).optional(),
  status: z.enum(CUSTOMER_STATUSES).optional(),
  externalCustomerId: z.string().trim().min(1).max(80).optional(),
});

export const customerListQuerySchema = z.object({
  ...pageQuery,
  email: z.string().trim().email().max(254).optional(),
  q: z.string().trim().min(1).max(200).optional(),
});

export const registerProductBodySchema = z.object({
  sku: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(4_000).optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
  currency: z.string().trim().length(3).optional(),
  priceAmount: z.number().int().min(0).max(1_000_000_000),
});

export const productListQuerySchema = z.object({
  ...pageQuery,
  sku: z.string().trim().min(1).max(80).optional(),
  q: z.string().trim().min(1).max(200).optional(),
});

export const registerOrderBodySchema = z.object({
  customerId: z.string().uuid(),
  externalOrderId: z.string().trim().min(1).max(80),
  status: z.enum(ORDER_STATUSES).optional(),
  currency: z.string().trim().length(3).optional(),
  totalAmount: z.number().int().min(0).max(1_000_000_000),
  lineItems: z
    .array(
      z.object({
        sku: z.string().trim().min(1).max(80),
        name: z.string().trim().min(1).max(200),
        quantity: z.number().int().min(1).max(10_000),
        unitAmount: z.number().int().min(0).max(1_000_000_000),
      }),
    )
    .min(1)
    .max(50),
  placedAt: z.string().datetime().optional(),
});

export const orderListQuerySchema = z.object({
  ...pageQuery,
  customerId: z.string().uuid().optional(),
  externalOrderId: z.string().trim().min(1).max(80).optional(),
});

export const registerShipmentBodySchema = z.object({
  orderId: z.string().trim().min(1).max(80),
  trackingNumber: z.string().trim().min(1).max(80),
  carrier: z.string().trim().min(1).max(80),
  status: z.enum(SHIPMENT_STATUSES).optional(),
  shippedAt: z.string().datetime().optional(),
  estimatedDeliveryAt: z.string().datetime().optional(),
});

export const shipmentListQuerySchema = z.object({
  ...pageQuery,
  orderId: z.string().uuid().optional(),
  trackingNumber: z.string().trim().min(1).max(80).optional(),
});

export const registerReturnBodySchema = z.object({
  orderId: z.string().trim().min(1).max(80),
  status: z.enum(RETURN_STATUSES).optional(),
  reason: z.string().trim().min(1).max(1_000).optional(),
  requestedAt: z.string().datetime().optional(),
});

export const returnListQuerySchema = z.object({
  ...pageQuery,
  orderId: z.string().uuid().optional(),
});
