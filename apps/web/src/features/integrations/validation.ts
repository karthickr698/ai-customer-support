import type {
  ConnectorDefinitionDto,
  CustomerStatus,
  OrderLineItemDto,
  OrderStatus,
  ProductStatus,
  RegisterCustomerRequest,
  RegisterOrderRequest,
  RegisterProductRequest,
  RegisterReturnRequest,
  RegisterShipmentRequest,
  ReturnStatus,
  SetupConnectorRequest,
  ShipmentStatus,
} from '@ai-customer-support/contracts';
import {
  CUSTOMER_STATUSES,
  ORDER_STATUSES,
  PRODUCT_STATUSES,
  RETURN_STATUSES,
  SHIPMENT_STATUSES,
} from '@ai-customer-support/contracts';
import { validateEmail } from '@/features/identity/validation';
import { validateSafeHttpsUrl } from '@/features/tools/validation';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SetupWizardStep = 'review' | 'permissions' | 'credentials' | 'authorize' | 'health';

export type SetupFormValues = {
  name: string;
  permissions: string[];
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  toolName: string;
  credentialKind: 'api_key' | 'bearer';
  secret: string;
  baseUrl: string;
  headerName: string;
};

export type SetupFormErrors = Partial<Record<keyof SetupFormValues, string>>;

export function emptySetupForm(definition: ConnectorDefinitionDto): SetupFormValues {
  const required = definition.permissions.filter((item) => item.required).map((item) => item.id);
  const defaults = definition.defaultScopes.length > 0 ? [...definition.defaultScopes] : required;
  return {
    name: definition.name,
    permissions: defaults,
    clientId: '',
    clientSecret: '',
    authorizationUrl: definition.defaultAuthorizationUrl ?? '',
    tokenUrl: definition.defaultTokenUrl ?? '',
    toolName: definition.kind === 'http' ? (definition.permissions[0]?.id ?? '') : '',
    credentialKind: 'bearer',
    secret: '',
    baseUrl: '',
    headerName: 'Authorization',
  };
}

export function wizardStepsFor(definition: ConnectorDefinitionDto): readonly SetupWizardStep[] {
  return definition.kind === 'oauth'
    ? ['review', 'permissions', 'credentials', 'authorize', 'health']
    : ['review', 'permissions', 'credentials', 'health'];
}

export function validateSetupCredentials(
  definition: ConnectorDefinitionDto,
  values: SetupFormValues,
): SetupFormErrors {
  const errors: SetupFormErrors = {};
  const name = values.name.trim();
  if (name.length < 1 || name.length > 120) {
    errors.name = 'Name must be between 1 and 120 characters';
  }

  if (definition.kind === 'oauth') {
    if (values.clientId.trim().length < 1 || values.clientId.trim().length > 200) {
      errors.clientId = 'Client id is required';
    }
    if (values.clientSecret.trim().length < 8) {
      errors.clientSecret = 'Client secret must be at least 8 characters';
    }
    const authError = validateSafeHttpsUrl(values.authorizationUrl, 'Authorization URL');
    if (authError) {
      errors.authorizationUrl = authError;
    }
    const tokenError = validateSafeHttpsUrl(values.tokenUrl, 'Token URL');
    if (tokenError) {
      errors.tokenUrl = tokenError;
    }
  } else {
    if (!values.toolName.trim()) {
      errors.toolName = 'Select the HTTP tool this credential may call';
    }
    if (values.secret.trim().length < 8) {
      errors.secret = 'Secret must be at least 8 characters';
    }
    const urlError = validateSafeHttpsUrl(values.baseUrl, 'Base URL');
    if (urlError) {
      errors.baseUrl = urlError;
    }
  }

  return errors;
}

export function toSetupRequest(definition: ConnectorDefinitionDto, values: SetupFormValues): SetupConnectorRequest {
  if (definition.kind === 'oauth') {
    return {
      catalogId: definition.id,
      name: values.name.trim(),
      permissions: values.permissions,
      clientId: values.clientId.trim(),
      clientSecret: values.clientSecret.trim(),
      authorizationUrl: values.authorizationUrl.trim(),
      tokenUrl: values.tokenUrl.trim(),
    };
  }

  return {
    catalogId: definition.id,
    name: values.name.trim(),
    permissions: values.toolName ? [values.toolName] : values.permissions,
    toolName: values.toolName as SetupConnectorRequest['toolName'],
    credentialKind: values.credentialKind,
    secret: values.secret.trim(),
    baseUrl: values.baseUrl.trim(),
    headerName: values.headerName.trim() || undefined,
    provider: definition.provider,
  };
}

export function optionalTrimmed(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function parseMinorUnits(raw: string, label: string): { amount?: number; error?: string } {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { error: `${label} is required` };
  }
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { error: `${label} must be a non-negative amount` };
  }
  const amount = Math.round(parsed * 100);
  if (!Number.isInteger(amount) || amount > 1_000_000_000) {
    return { error: `${label} is out of range` };
  }
  return { amount };
}

export function parseOptionalIsoDate(raw: string, label: string): { value?: string; error?: string } {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return {};
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return { error: `${label} must be a valid date` };
  }
  return { value: date.toISOString() };
}

export function validateCurrency(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (!/^[A-Za-z]{3}$/.test(trimmed)) {
    return 'Currency must be a 3-letter code';
  }
  return undefined;
}

export type CustomerFormValues = {
  email: string;
  name: string;
  phone: string;
  status: CustomerStatus;
  externalCustomerId: string;
};

export type CustomerFormErrors = Partial<Record<keyof CustomerFormValues, string>>;

export const emptyCustomerForm = (): CustomerFormValues => ({
  email: '',
  name: '',
  phone: '',
  status: 'active',
  externalCustomerId: '',
});

export function validateCustomerForm(values: CustomerFormValues): CustomerFormErrors {
  const errors: CustomerFormErrors = {};
  const emailError = validateEmail(values.email);
  if (emailError) {
    errors.email = emailError;
  }
  const name = values.name.trim();
  if (name.length < 1 || name.length > 80) {
    errors.name = 'Name must be between 1 and 80 characters';
  }
  const phone = values.phone.trim();
  if (phone.length > 0 && (phone.length > 32 || phone.length < 1)) {
    errors.phone = 'Phone must be at most 32 characters';
  }
  if (!(CUSTOMER_STATUSES as readonly string[]).includes(values.status)) {
    errors.status = 'Select a status';
  }
  const externalId = values.externalCustomerId.trim();
  if (externalId.length > 80) {
    errors.externalCustomerId = 'External id must be at most 80 characters';
  }
  return errors;
}

export function toRegisterCustomerRequest(values: CustomerFormValues): RegisterCustomerRequest {
  return {
    email: values.email.trim(),
    name: values.name.trim(),
    phone: optionalTrimmed(values.phone),
    status: values.status,
    externalCustomerId: optionalTrimmed(values.externalCustomerId),
  };
}

export type ProductFormValues = {
  sku: string;
  name: string;
  description: string;
  status: ProductStatus;
  currency: string;
  price: string;
};

export type ProductFormErrors = Partial<Record<keyof ProductFormValues, string>>;

export const emptyProductForm = (): ProductFormValues => ({
  sku: '',
  name: '',
  description: '',
  status: 'active',
  currency: 'USD',
  price: '',
});

export function validateProductForm(values: ProductFormValues): ProductFormErrors {
  const errors: ProductFormErrors = {};
  const sku = values.sku.trim();
  if (sku.length < 1 || sku.length > 80) {
    errors.sku = 'SKU must be between 1 and 80 characters';
  }
  const name = values.name.trim();
  if (name.length < 1 || name.length > 200) {
    errors.name = 'Name must be between 1 and 200 characters';
  }
  const description = values.description.trim();
  if (description.length > 4_000) {
    errors.description = 'Description must be at most 4000 characters';
  }
  if (!(PRODUCT_STATUSES as readonly string[]).includes(values.status)) {
    errors.status = 'Select a status';
  }
  const currencyError = validateCurrency(values.currency);
  if (currencyError) {
    errors.currency = currencyError;
  } else if (values.currency.trim().length === 0) {
    errors.currency = 'Currency is required';
  }
  const price = parseMinorUnits(values.price, 'Price');
  if (price.error) {
    errors.price = price.error;
  }
  return errors;
}

export function toRegisterProductRequest(values: ProductFormValues): RegisterProductRequest {
  const price = parseMinorUnits(values.price, 'Price');
  return {
    sku: values.sku.trim(),
    name: values.name.trim(),
    description: optionalTrimmed(values.description),
    status: values.status,
    currency: values.currency.trim().toUpperCase(),
    priceAmount: price.amount ?? 0,
  };
}

export type OrderLineFormValues = {
  sku: string;
  name: string;
  quantity: string;
  unitPrice: string;
};

export type OrderFormValues = {
  customerId: string;
  externalOrderId: string;
  status: OrderStatus;
  currency: string;
  total: string;
  placedAt: string;
  lineItems: OrderLineFormValues[];
};

export type OrderFormErrors = Partial<Record<keyof Omit<OrderFormValues, 'lineItems'>, string>> & {
  lineItems?: string;
  lines?: Array<Partial<Record<keyof OrderLineFormValues, string>>>;
};

export const emptyOrderLine = (): OrderLineFormValues => ({
  sku: '',
  name: '',
  quantity: '1',
  unitPrice: '',
});

export const emptyOrderForm = (): OrderFormValues => ({
  customerId: '',
  externalOrderId: '',
  status: 'pending',
  currency: 'USD',
  total: '',
  placedAt: '',
  lineItems: [emptyOrderLine()],
});

function validateOrderLine(line: OrderLineFormValues): Partial<Record<keyof OrderLineFormValues, string>> {
  const errors: Partial<Record<keyof OrderLineFormValues, string>> = {};
  if (line.sku.trim().length < 1 || line.sku.trim().length > 80) {
    errors.sku = 'SKU is required';
  }
  if (line.name.trim().length < 1 || line.name.trim().length > 200) {
    errors.name = 'Name is required';
  }
  const quantity = Number.parseInt(line.quantity.trim(), 10);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10_000) {
    errors.quantity = 'Quantity must be between 1 and 10000';
  }
  const unit = parseMinorUnits(line.unitPrice, 'Unit price');
  if (unit.error) {
    errors.unitPrice = unit.error;
  }
  return errors;
}

export function validateOrderForm(values: OrderFormValues): OrderFormErrors {
  const errors: OrderFormErrors = {};
  if (!UUID_PATTERN.test(values.customerId.trim())) {
    errors.customerId = 'Customer id must be a UUID';
  }
  const externalId = values.externalOrderId.trim();
  if (externalId.length < 1 || externalId.length > 80) {
    errors.externalOrderId = 'External order id must be between 1 and 80 characters';
  }
  if (!(ORDER_STATUSES as readonly string[]).includes(values.status)) {
    errors.status = 'Select a status';
  }
  const currencyError = validateCurrency(values.currency);
  if (currencyError) {
    errors.currency = currencyError;
  } else if (values.currency.trim().length === 0) {
    errors.currency = 'Currency is required';
  }
  const total = parseMinorUnits(values.total, 'Total');
  if (total.error) {
    errors.total = total.error;
  }
  const placedAt = parseOptionalIsoDate(values.placedAt, 'Placed at');
  if (placedAt.error) {
    errors.placedAt = placedAt.error;
  }
  if (values.lineItems.length < 1 || values.lineItems.length > 50) {
    errors.lineItems = 'Add between 1 and 50 line items';
  }
  errors.lines = values.lineItems.map(validateOrderLine);
  if (errors.lines.every((line) => Object.keys(line).length === 0)) {
    delete errors.lines;
  }
  return errors;
}

export function toRegisterOrderRequest(values: OrderFormValues): RegisterOrderRequest {
  const total = parseMinorUnits(values.total, 'Total');
  const placedAt = parseOptionalIsoDate(values.placedAt, 'Placed at');
  const lineItems: OrderLineItemDto[] = values.lineItems.map((line) => ({
    sku: line.sku.trim(),
    name: line.name.trim(),
    quantity: Number.parseInt(line.quantity.trim(), 10),
    unitAmount: parseMinorUnits(line.unitPrice, 'Unit price').amount ?? 0,
  }));
  return {
    customerId: values.customerId.trim(),
    externalOrderId: values.externalOrderId.trim(),
    status: values.status,
    currency: values.currency.trim().toUpperCase(),
    totalAmount: total.amount ?? 0,
    lineItems,
    placedAt: placedAt.value,
  };
}

export type ShipmentFormValues = {
  orderId: string;
  trackingNumber: string;
  carrier: string;
  status: ShipmentStatus;
  shippedAt: string;
  estimatedDeliveryAt: string;
};

export type ShipmentFormErrors = Partial<Record<keyof ShipmentFormValues, string>>;

export const emptyShipmentForm = (): ShipmentFormValues => ({
  orderId: '',
  trackingNumber: '',
  carrier: '',
  status: 'pending',
  shippedAt: '',
  estimatedDeliveryAt: '',
});

export function validateShipmentForm(values: ShipmentFormValues): ShipmentFormErrors {
  const errors: ShipmentFormErrors = {};
  const orderId = values.orderId.trim();
  if (orderId.length < 1 || orderId.length > 80) {
    errors.orderId = 'Order id must be between 1 and 80 characters';
  }
  const tracking = values.trackingNumber.trim();
  if (tracking.length < 1 || tracking.length > 80) {
    errors.trackingNumber = 'Tracking number must be between 1 and 80 characters';
  }
  const carrier = values.carrier.trim();
  if (carrier.length < 1 || carrier.length > 80) {
    errors.carrier = 'Carrier must be between 1 and 80 characters';
  }
  if (!(SHIPMENT_STATUSES as readonly string[]).includes(values.status)) {
    errors.status = 'Select a status';
  }
  const shippedAt = parseOptionalIsoDate(values.shippedAt, 'Shipped at');
  if (shippedAt.error) {
    errors.shippedAt = shippedAt.error;
  }
  const estimated = parseOptionalIsoDate(values.estimatedDeliveryAt, 'Estimated delivery');
  if (estimated.error) {
    errors.estimatedDeliveryAt = estimated.error;
  }
  return errors;
}

export function toRegisterShipmentRequest(values: ShipmentFormValues): RegisterShipmentRequest {
  return {
    orderId: values.orderId.trim(),
    trackingNumber: values.trackingNumber.trim(),
    carrier: values.carrier.trim(),
    status: values.status,
    shippedAt: parseOptionalIsoDate(values.shippedAt, 'Shipped at').value,
    estimatedDeliveryAt: parseOptionalIsoDate(values.estimatedDeliveryAt, 'Estimated delivery').value,
  };
}

export type ReturnFormValues = {
  orderId: string;
  status: ReturnStatus;
  reason: string;
  requestedAt: string;
};

export type ReturnFormErrors = Partial<Record<keyof ReturnFormValues, string>>;

export const emptyReturnForm = (): ReturnFormValues => ({
  orderId: '',
  status: 'requested',
  reason: '',
  requestedAt: '',
});

export function validateReturnForm(values: ReturnFormValues): ReturnFormErrors {
  const errors: ReturnFormErrors = {};
  const orderId = values.orderId.trim();
  if (orderId.length < 1 || orderId.length > 80) {
    errors.orderId = 'Order id must be between 1 and 80 characters';
  }
  if (!(RETURN_STATUSES as readonly string[]).includes(values.status)) {
    errors.status = 'Select a status';
  }
  const reason = values.reason.trim();
  if (reason.length > 1_000) {
    errors.reason = 'Reason must be at most 1000 characters';
  }
  const requestedAt = parseOptionalIsoDate(values.requestedAt, 'Requested at');
  if (requestedAt.error) {
    errors.requestedAt = requestedAt.error;
  }
  return errors;
}

export function toRegisterReturnRequest(values: ReturnFormValues): RegisterReturnRequest {
  return {
    orderId: values.orderId.trim(),
    status: values.status,
    reason: optionalTrimmed(values.reason),
    requestedAt: parseOptionalIsoDate(values.requestedAt, 'Requested at').value,
  };
}

export function orderFormHasErrors(errors: OrderFormErrors): boolean {
  return Boolean(
    errors.customerId ||
      errors.externalOrderId ||
      errors.status ||
      errors.currency ||
      errors.total ||
      errors.placedAt ||
      errors.lineItems ||
      (errors.lines && errors.lines.some((line) => Object.keys(line).length > 0)),
  );
}
