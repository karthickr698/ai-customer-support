import { type FormEvent, useState } from 'react';
import type { CustomerStatus, OrderStatus, ProductStatus, ReturnStatus, ShipmentStatus } from '@ai-customer-support/contracts';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useApiMutation } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { commerceApi } from '../api';
import {
  CUSTOMER_STATUS_OPTIONS,
  ORDER_STATUS_OPTIONS,
  PRODUCT_STATUS_OPTIONS,
  RETURN_STATUS_OPTIONS,
  SHIPMENT_STATUS_OPTIONS,
} from '../labels';
import {
  emptyCustomerForm,
  emptyOrderForm,
  emptyOrderLine,
  emptyProductForm,
  emptyReturnForm,
  emptyShipmentForm,
  orderFormHasErrors,
  toRegisterCustomerRequest,
  toRegisterOrderRequest,
  toRegisterProductRequest,
  toRegisterReturnRequest,
  toRegisterShipmentRequest,
  validateCustomerForm,
  validateOrderForm,
  validateProductForm,
  validateReturnForm,
  validateShipmentForm,
  type CustomerFormErrors,
  type CustomerFormValues,
  type OrderFormErrors,
  type OrderFormValues,
  type ProductFormErrors,
  type ProductFormValues,
  type ReturnFormErrors,
  type ReturnFormValues,
  type ShipmentFormErrors,
  type ShipmentFormValues,
} from '../validation';

type DialogProps = {
  readonly organizationId: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

export function RegisterCustomerDialog({ organizationId, open, onOpenChange }: DialogProps) {
  const [form, setForm] = useState<CustomerFormValues>(emptyCustomerForm);
  const [errors, setErrors] = useState<CustomerFormErrors>({});
  const register = useApiMutation({
    mutationFn: () => commerceApi.registerCustomer(organizationId, toRegisterCustomerRequest(form)),
    invalidateKeys: [queryKeys.customers.all()],
    successMessage: 'Customer registered',
  });

  function patch<K extends keyof CustomerFormValues>(key: K, value: CustomerFormValues[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const nextErrors = validateCustomerForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    await register.mutateAsync();
    setForm(emptyCustomerForm());
    onOpenChange(false);
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) {
          setForm(emptyCustomerForm());
          setErrors({});
        }
        onOpenChange(next);
      }}
      open={open}
    >
      <DialogContent>
        <form className="grid gap-4" noValidate onSubmit={(event) => void onSubmit(event)}>
          <DialogHeader>
            <DialogTitle>Register customer</DialogTitle>
            <DialogDescription>
              Store a tenant-scoped customer for support lookup. Records never cross organizations.
            </DialogDescription>
          </DialogHeader>
          <Field error={errors.email} id="customer-email" label="Email" required>
            <Input
              id="customer-email"
              onChange={(event) => {
                patch('email', event.target.value);
              }}
              type="email"
              value={form.email}
            />
          </Field>
          <Field error={errors.name} id="customer-name" label="Name" required>
            <Input
              id="customer-name"
              onChange={(event) => {
                patch('name', event.target.value);
              }}
              value={form.name}
            />
          </Field>
          <Field error={errors.phone} id="customer-phone" label="Phone">
            <Input
              id="customer-phone"
              onChange={(event) => {
                patch('phone', event.target.value);
              }}
              value={form.phone}
            />
          </Field>
          <Field error={errors.status} id="customer-status" label="Status" required>
            <Select
              id="customer-status"
              onValueChange={(value) => {
                patch('status', value as CustomerStatus);
              }}
              options={CUSTOMER_STATUS_OPTIONS}
              searchable={false}
              value={form.status}
            />
          </Field>
          <Field error={errors.externalCustomerId} id="customer-external" label="External customer id">
            <Input
              id="customer-external"
              onChange={(event) => {
                patch('externalCustomerId', event.target.value);
              }}
              value={form.externalCustomerId}
            />
          </Field>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={register.isPending} type="submit">
              {register.isPending ? <Spinner label="Saving customer" /> : null}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RegisterProductDialog({ organizationId, open, onOpenChange }: DialogProps) {
  const [form, setForm] = useState<ProductFormValues>(emptyProductForm);
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const register = useApiMutation({
    mutationFn: () => commerceApi.registerProduct(organizationId, toRegisterProductRequest(form)),
    invalidateKeys: [queryKeys.products.all()],
    successMessage: 'Product registered',
  });

  function patch<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const nextErrors = validateProductForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    await register.mutateAsync();
    setForm(emptyProductForm());
    onOpenChange(false);
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) {
          setForm(emptyProductForm());
          setErrors({});
        }
        onOpenChange(next);
      }}
      open={open}
    >
      <DialogContent>
        <form className="grid gap-4" noValidate onSubmit={(event) => void onSubmit(event)}>
          <DialogHeader>
            <DialogTitle>Register product</DialogTitle>
            <DialogDescription>Catalog a SKU for tenant-scoped product lookup. Price is in major currency units.</DialogDescription>
          </DialogHeader>
          <Field error={errors.sku} id="product-sku" label="SKU" required>
            <Input
              id="product-sku"
              onChange={(event) => {
                patch('sku', event.target.value);
              }}
              value={form.sku}
            />
          </Field>
          <Field error={errors.name} id="product-name" label="Name" required>
            <Input
              id="product-name"
              onChange={(event) => {
                patch('name', event.target.value);
              }}
              value={form.name}
            />
          </Field>
          <Field error={errors.description} id="product-description" label="Description">
            <Textarea
              id="product-description"
              onChange={(event) => {
                patch('description', event.target.value);
              }}
              value={form.description}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field error={errors.status} id="product-status" label="Status" required>
              <Select
                id="product-status"
                onValueChange={(value) => {
                  patch('status', value as ProductStatus);
                }}
                options={PRODUCT_STATUS_OPTIONS}
                searchable={false}
                value={form.status}
              />
            </Field>
            <Field error={errors.currency} id="product-currency" label="Currency" required>
              <Input
                id="product-currency"
                maxLength={3}
                onChange={(event) => {
                  patch('currency', event.target.value);
                }}
                value={form.currency}
              />
            </Field>
            <Field error={errors.price} hint="Major units, for example 12.99" id="product-price" label="Price" required>
              <Input
                id="product-price"
                inputMode="decimal"
                onChange={(event) => {
                  patch('price', event.target.value);
                }}
                value={form.price}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={register.isPending} type="submit">
              {register.isPending ? <Spinner label="Saving product" /> : null}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RegisterOrderDialog({ organizationId, open, onOpenChange }: DialogProps) {
  const [form, setForm] = useState<OrderFormValues>(emptyOrderForm);
  const [errors, setErrors] = useState<OrderFormErrors>({});
  const register = useApiMutation({
    mutationFn: () => commerceApi.registerOrder(organizationId, toRegisterOrderRequest(form)),
    invalidateKeys: [queryKeys.orders.all()],
    successMessage: 'Order registered',
  });

  function patch<K extends keyof Omit<OrderFormValues, 'lineItems'>>(key: K, value: OrderFormValues[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const nextErrors = validateOrderForm(form);
    setErrors(nextErrors);
    if (orderFormHasErrors(nextErrors)) {
      return;
    }
    await register.mutateAsync();
    setForm(emptyOrderForm());
    onOpenChange(false);
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) {
          setForm(emptyOrderForm());
          setErrors({});
        }
        onOpenChange(next);
      }}
      open={open}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <form className="grid gap-4" noValidate onSubmit={(event) => void onSubmit(event)}>
          <DialogHeader>
            <DialogTitle>Register order</DialogTitle>
            <DialogDescription>
              Attach an order to a workspace customer. Line-item prices and totals use major currency units.
            </DialogDescription>
          </DialogHeader>
          <Field error={errors.customerId} id="order-customer" label="Customer id" required>
            <Input
              id="order-customer"
              onChange={(event) => {
                patch('customerId', event.target.value);
              }}
              placeholder="UUID"
              value={form.customerId}
            />
          </Field>
          <Field error={errors.externalOrderId} id="order-external" label="External order id" required>
            <Input
              id="order-external"
              onChange={(event) => {
                patch('externalOrderId', event.target.value);
              }}
              value={form.externalOrderId}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field error={errors.status} id="order-status" label="Status" required>
              <Select
                id="order-status"
                onValueChange={(value) => {
                  patch('status', value as OrderStatus);
                }}
                options={ORDER_STATUS_OPTIONS}
                searchable={false}
                value={form.status}
              />
            </Field>
            <Field error={errors.currency} id="order-currency" label="Currency" required>
              <Input
                id="order-currency"
                maxLength={3}
                onChange={(event) => {
                  patch('currency', event.target.value);
                }}
                value={form.currency}
              />
            </Field>
            <Field error={errors.total} id="order-total" label="Total" required>
              <Input
                id="order-total"
                inputMode="decimal"
                onChange={(event) => {
                  patch('total', event.target.value);
                }}
                value={form.total}
              />
            </Field>
          </div>
          <Field error={errors.placedAt} id="order-placed" label="Placed at">
            <Input
              id="order-placed"
              onChange={(event) => {
                patch('placedAt', event.target.value);
              }}
              type="datetime-local"
              value={form.placedAt}
            />
          </Field>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Line items</p>
              <Button
                onClick={() => {
                  setForm((current) => ({ ...current, lineItems: [...current.lineItems, emptyOrderLine()] }));
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                Add line
              </Button>
            </div>
            {errors.lineItems ? <p className="text-xs text-destructive">{errors.lineItems}</p> : null}
            {form.lineItems.map((line, index) => {
              const lineErrors = errors.lines?.[index];
              return (
                <div className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-4" key={`line-${String(index)}`}>
                  <Field error={lineErrors?.sku} id={`line-sku-${String(index)}`} label="SKU" required>
                    <Input
                      id={`line-sku-${String(index)}`}
                      onChange={(event) => {
                        const sku = event.target.value;
                        setForm((current) => ({
                          ...current,
                          lineItems: current.lineItems.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, sku } : item,
                          ),
                        }));
                      }}
                      value={line.sku}
                    />
                  </Field>
                  <Field error={lineErrors?.name} id={`line-name-${String(index)}`} label="Name" required>
                    <Input
                      id={`line-name-${String(index)}`}
                      onChange={(event) => {
                        const name = event.target.value;
                        setForm((current) => ({
                          ...current,
                          lineItems: current.lineItems.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, name } : item,
                          ),
                        }));
                      }}
                      value={line.name}
                    />
                  </Field>
                  <Field error={lineErrors?.quantity} id={`line-qty-${String(index)}`} label="Qty" required>
                    <Input
                      id={`line-qty-${String(index)}`}
                      inputMode="numeric"
                      onChange={(event) => {
                        const quantity = event.target.value;
                        setForm((current) => ({
                          ...current,
                          lineItems: current.lineItems.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, quantity } : item,
                          ),
                        }));
                      }}
                      value={line.quantity}
                    />
                  </Field>
                  <Field error={lineErrors?.unitPrice} id={`line-price-${String(index)}`} label="Unit price" required>
                    <Input
                      id={`line-price-${String(index)}`}
                      inputMode="decimal"
                      onChange={(event) => {
                        const unitPrice = event.target.value;
                        setForm((current) => ({
                          ...current,
                          lineItems: current.lineItems.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, unitPrice } : item,
                          ),
                        }));
                      }}
                      value={line.unitPrice}
                    />
                  </Field>
                  {form.lineItems.length > 1 ? (
                    <Button
                      className="sm:col-span-4"
                      onClick={() => {
                        setForm((current) => ({
                          ...current,
                          lineItems: current.lineItems.filter((_, itemIndex) => itemIndex !== index),
                        }));
                      }}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Remove line
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={register.isPending} type="submit">
              {register.isPending ? <Spinner label="Saving order" /> : null}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RegisterShipmentDialog({ organizationId, open, onOpenChange }: DialogProps) {
  const [form, setForm] = useState<ShipmentFormValues>(emptyShipmentForm);
  const [errors, setErrors] = useState<ShipmentFormErrors>({});
  const register = useApiMutation({
    mutationFn: () => commerceApi.registerShipment(organizationId, toRegisterShipmentRequest(form)),
    invalidateKeys: [queryKeys.shipments.all()],
    successMessage: 'Shipment registered',
  });

  function patch<K extends keyof ShipmentFormValues>(key: K, value: ShipmentFormValues[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const nextErrors = validateShipmentForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    await register.mutateAsync();
    setForm(emptyShipmentForm());
    onOpenChange(false);
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) {
          setForm(emptyShipmentForm());
          setErrors({});
        }
        onOpenChange(next);
      }}
      open={open}
    >
      <DialogContent>
        <form className="grid gap-4" noValidate onSubmit={(event) => void onSubmit(event)}>
          <DialogHeader>
            <DialogTitle>Register shipment</DialogTitle>
            <DialogDescription>Track a shipment against an order id or external order id.</DialogDescription>
          </DialogHeader>
          <Field error={errors.orderId} id="shipment-order" label="Order id" required>
            <Input
              id="shipment-order"
              onChange={(event) => {
                patch('orderId', event.target.value);
              }}
              value={form.orderId}
            />
          </Field>
          <Field error={errors.trackingNumber} id="shipment-tracking" label="Tracking number" required>
            <Input
              id="shipment-tracking"
              onChange={(event) => {
                patch('trackingNumber', event.target.value);
              }}
              value={form.trackingNumber}
            />
          </Field>
          <Field error={errors.carrier} id="shipment-carrier" label="Carrier" required>
            <Input
              id="shipment-carrier"
              onChange={(event) => {
                patch('carrier', event.target.value);
              }}
              value={form.carrier}
            />
          </Field>
          <Field error={errors.status} id="shipment-status" label="Status" required>
            <Select
              id="shipment-status"
              onValueChange={(value) => {
                patch('status', value as ShipmentStatus);
              }}
              options={SHIPMENT_STATUS_OPTIONS}
              searchable={false}
              value={form.status}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field error={errors.shippedAt} id="shipment-shipped" label="Shipped at">
              <Input
                id="shipment-shipped"
                onChange={(event) => {
                  patch('shippedAt', event.target.value);
                }}
                type="datetime-local"
                value={form.shippedAt}
              />
            </Field>
            <Field error={errors.estimatedDeliveryAt} id="shipment-eta" label="Estimated delivery">
              <Input
                id="shipment-eta"
                onChange={(event) => {
                  patch('estimatedDeliveryAt', event.target.value);
                }}
                type="datetime-local"
                value={form.estimatedDeliveryAt}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={register.isPending} type="submit">
              {register.isPending ? <Spinner label="Saving shipment" /> : null}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RegisterReturnDialog({ organizationId, open, onOpenChange }: DialogProps) {
  const [form, setForm] = useState<ReturnFormValues>(emptyReturnForm);
  const [errors, setErrors] = useState<ReturnFormErrors>({});
  const register = useApiMutation({
    mutationFn: () => commerceApi.registerReturn(organizationId, toRegisterReturnRequest(form)),
    invalidateKeys: [queryKeys.returns.all()],
    successMessage: 'Return registered',
  });

  function patch<K extends keyof ReturnFormValues>(key: K, value: ReturnFormValues[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const nextErrors = validateReturnForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    await register.mutateAsync();
    setForm(emptyReturnForm());
    onOpenChange(false);
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) {
          setForm(emptyReturnForm());
          setErrors({});
        }
        onOpenChange(next);
      }}
      open={open}
    >
      <DialogContent>
        <form className="grid gap-4" noValidate onSubmit={(event) => void onSubmit(event)}>
          <DialogHeader>
            <DialogTitle>Register return</DialogTitle>
            <DialogDescription>Record a return against an order id or external order id.</DialogDescription>
          </DialogHeader>
          <Field error={errors.orderId} id="return-order" label="Order id" required>
            <Input
              id="return-order"
              onChange={(event) => {
                patch('orderId', event.target.value);
              }}
              value={form.orderId}
            />
          </Field>
          <Field error={errors.status} id="return-status" label="Status" required>
            <Select
              id="return-status"
              onValueChange={(value) => {
                patch('status', value as ReturnStatus);
              }}
              options={RETURN_STATUS_OPTIONS}
              searchable={false}
              value={form.status}
            />
          </Field>
          <Field error={errors.reason} id="return-reason" label="Reason">
            <Textarea
              id="return-reason"
              onChange={(event) => {
                patch('reason', event.target.value);
              }}
              value={form.reason}
            />
          </Field>
          <Field error={errors.requestedAt} id="return-requested" label="Requested at">
            <Input
              id="return-requested"
              onChange={(event) => {
                patch('requestedAt', event.target.value);
              }}
              type="datetime-local"
              value={form.requestedAt}
            />
          </Field>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={register.isPending} type="submit">
              {register.isPending ? <Spinner label="Saving return" /> : null}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
