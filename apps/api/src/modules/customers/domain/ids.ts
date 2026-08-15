export type CustomerId = string & { readonly __brand: 'CustomerId' };
export type ProductId = string & { readonly __brand: 'ProductId' };
export type OrderId = string & { readonly __brand: 'OrderId' };
export type ShipmentId = string & { readonly __brand: 'ShipmentId' };
export type ReturnId = string & { readonly __brand: 'ReturnId' };

export function createCustomerId(id: string = crypto.randomUUID()): CustomerId {
  return id as CustomerId;
}

export function createProductId(id: string = crypto.randomUUID()): ProductId {
  return id as ProductId;
}

export function createOrderId(id: string = crypto.randomUUID()): OrderId {
  return id as OrderId;
}

export function createShipmentId(id: string = crypto.randomUUID()): ShipmentId {
  return id as ShipmentId;
}

export function createReturnId(id: string = crypto.randomUUID()): ReturnId {
  return id as ReturnId;
}
