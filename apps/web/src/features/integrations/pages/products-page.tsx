import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ProductListResponse } from '@ai-customer-support/contracts';
import { Package, Plus, Search } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConnectorCoverage } from '@/features/integrations/components/connector-coverage';
import { QueryErrorAlert } from '@/features/integrations/components/query-error';
import { RegisterProductDialog } from '@/features/integrations/components/register-dialogs';
import {
  COMMERCE_PAGE_SIZE,
  formatMoney,
  productStatusLabel,
  productStatusVariant,
} from '@/features/integrations/labels';
import { formatDateTime } from '@/features/organizations/format';
import { hasPermission } from '@/features/organizations/permissions';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';

export function IntegrationProductsPage() {
  const { permissions } = useWorkspace();
  if (!hasPermission(permissions, 'customer.read')) {
    return (
      <Alert variant="warning">
        <AlertTitle>Products are limited</AlertTitle>
        <AlertDescription>You need customer.read to view tenant-scoped product records.</AlertDescription>
      </Alert>
    );
  }
  return <ProductsWorkspace />;
}

function ProductsWorkspace() {
  const { organizationId, permissions } = useWorkspace();
  const canManage = hasPermission(permissions, 'customer.manage');
  const [searchParams, setSearchParams] = useSearchParams();
  const [registerOpen, setRegisterOpen] = useState(false);
  const q = searchParams.get('q') ?? '';
  const sku = searchParams.get('sku') ?? '';
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const filters = useMemo(
    () => ({
      page,
      pageSize: COMMERCE_PAGE_SIZE,
      q: q.trim() || undefined,
      sku: sku.trim() || undefined,
    }),
    [page, q, sku],
  );

  const products = useApiQuery<ProductListResponse>({
    queryKey: queryKeys.products.list(organizationId, filters),
    path: `/api/organizations/${organizationId}/products`,
    params: filters,
  });

  function updateParams(next: Record<string, string | undefined>): void {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(next)) {
      if (!value) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    if (!('page' in next)) {
      params.delete('page');
    }
    setSearchParams(params);
  }

  const items = products.data?.items ?? [];
  const total = products.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / COMMERCE_PAGE_SIZE));

  return (
    <>
      <PageHeader
        actions={
          canManage ? (
            <Button onClick={() => setRegisterOpen(true)} type="button">
              <Plus />
              Register product
            </Button>
          ) : null
        }
        description="Tenant-scoped catalog used by product lookup tools. Check connector health before relying on live store data."
        title="Products"
      />
      <ConnectorCoverage dataset="products" />
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
              <Input
                aria-label="Search products"
                className="pl-8"
                onChange={(event) => {
                  updateParams({ q: event.target.value || undefined });
                }}
                placeholder="Search name or description"
                value={q}
              />
            </div>
            <Input
              aria-label="Filter by SKU"
              onChange={(event) => {
                updateParams({ sku: event.target.value || undefined });
              }}
              placeholder="Exact SKU"
              value={sku}
            />
          </div>
          {products.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : products.isError ? (
            <QueryErrorAlert
              message={products.error.message}
              onRetry={() => {
                void products.refetch();
              }}
              pending={products.isFetching}
              title="Unable to load products"
            />
          ) : items.length === 0 ? (
            <EmptyState
              action={
                canManage ? (
                  <Button onClick={() => setRegisterOpen(true)} type="button">
                    Register a product
                  </Button>
                ) : undefined
              }
              description="Connect a commerce provider or register a SKU so agents can look up catalog details."
              icon={<Package className="size-8" />}
              title="No products match"
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <p className="font-medium">{product.name}</p>
                        {product.description ? (
                          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{product.description}</p>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                      <TableCell>
                        <Badge variant={productStatusVariant(product.status)}>
                          {productStatusLabel(product.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatMoney(product.priceAmount, product.currency)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDateTime(product.updatedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                onPageChange={(next) => {
                  updateParams({ page: String(next) });
                }}
                page={page}
                pageCount={pageCount}
              />
            </>
          )}
        </CardContent>
      </Card>
      <RegisterProductDialog onOpenChange={setRegisterOpen} open={registerOpen} organizationId={organizationId} />
    </>
  );
}
