import { DomainError } from '@ai-customer-support/shared';

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';

  constructor(message = 'Authentication required') {
    super(message, 401);
  }
}

export class InsufficientCustomerPermissionError extends DomainError {
  readonly code = 'INSUFFICIENT_PERMISSION';

  constructor(permission?: string) {
    super(
      permission ? `Missing permission: ${permission}` : 'You do not have permission to perform this action',
      403,
    );
  }
}

export class InvalidCustomerRecordError extends DomainError {
  readonly code = 'INVALID_CUSTOMER';

  constructor(message: string) {
    super(message, 400);
  }
}

export class CustomerNotFoundError extends DomainError {
  readonly code = 'CUSTOMER_NOT_FOUND';

  constructor() {
    super('Customer not found', 404);
  }
}

export class DuplicateCustomerError extends DomainError {
  readonly code = 'DUPLICATE_CUSTOMER';

  constructor() {
    super('A customer with that email already exists in this organization', 409);
  }
}

export class InvalidProductError extends DomainError {
  readonly code = 'INVALID_PRODUCT';

  constructor(message: string) {
    super(message, 400);
  }
}

export class ProductNotFoundError extends DomainError {
  readonly code = 'PRODUCT_NOT_FOUND';

  constructor() {
    super('Product not found', 404);
  }
}

export class DuplicateProductError extends DomainError {
  readonly code = 'DUPLICATE_PRODUCT';

  constructor() {
    super('A product with that SKU already exists in this organization', 409);
  }
}

export class InvalidOrderError extends DomainError {
  readonly code = 'INVALID_ORDER';

  constructor(message: string) {
    super(message, 400);
  }
}

export class OrderNotFoundError extends DomainError {
  readonly code = 'ORDER_NOT_FOUND';

  constructor() {
    super('Order not found', 404);
  }
}

export class DuplicateOrderError extends DomainError {
  readonly code = 'DUPLICATE_ORDER';

  constructor() {
    super('An order with that id already exists in this organization', 409);
  }
}

export class InvalidShipmentError extends DomainError {
  readonly code = 'INVALID_SHIPMENT';

  constructor(message: string) {
    super(message, 400);
  }
}

export class ShipmentNotFoundError extends DomainError {
  readonly code = 'SHIPMENT_NOT_FOUND';

  constructor() {
    super('Shipment not found', 404);
  }
}

export class DuplicateShipmentError extends DomainError {
  readonly code = 'DUPLICATE_SHIPMENT';

  constructor() {
    super('A shipment with that tracking number already exists in this organization', 409);
  }
}

export class InvalidReturnError extends DomainError {
  readonly code = 'INVALID_RETURN';

  constructor(message: string) {
    super(message, 400);
  }
}

export class ReturnNotFoundError extends DomainError {
  readonly code = 'RETURN_NOT_FOUND';

  constructor() {
    super('Return not found', 404);
  }
}

export class TooManyCustomerRecordsError extends DomainError {
  readonly code = 'TOO_MANY_CUSTOMER_RECORDS';

  constructor(resource: string) {
    super(`This organization already has the maximum number of ${resource}`, 409);
  }
}
