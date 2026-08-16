import { useMemo, useState } from 'react';
import type {
  ConnectorCatalogResponse,
  ConnectorCategory,
  ConnectorConnectionDto,
  ConnectorConnectionListResponse,
  ConnectorDefinitionDto,
  ConnectorKind,
} from '@ai-customer-support/contracts';
import { CONNECTOR_CATEGORIES } from '@ai-customer-support/contracts';
import { Plug, Search, Store } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConnectionDetailDialog, SetupWizardDialog } from '@/features/integrations/components/setup-wizard';
import { hasPermission } from '@/features/organizations/permissions';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { QueryErrorAlert } from '../components/query-error';
import {
  connectorCategoryLabel,
  connectorKindLabel,
  connectionStatusLabel,
  connectionStatusVariant,
  healthStatusLabel,
  healthStatusVariant,
} from '../labels';

export function IntegrationsMarketplacePage() {
  const { permissions } = useWorkspace();
  if (!hasPermission(permissions, 'integration.manage')) {
    return (
      <Alert variant="warning">
        <AlertTitle>Marketplace is limited to admins</AlertTitle>
        <AlertDescription>
          You need integration.manage to browse the connector marketplace, run the setup wizard, and disconnect
          connectors.
        </AlertDescription>
      </Alert>
    );
  }
  return <MarketplaceWorkspace />;
}

function MarketplaceWorkspace() {
  const { organizationId } = useWorkspace();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ConnectorCategory | 'all'>('all');
  const [kind, setKind] = useState<ConnectorKind | 'all'>('all');
  const [setup, setSetup] = useState<ConnectorDefinitionDto>();
  const [managing, setManaging] = useState<ConnectorConnectionDto>();

  const catalog = useApiQuery<ConnectorCatalogResponse>({
    queryKey: queryKeys.integrations.catalog(organizationId, {
      q: query,
      kind,
      category,
    }),
    path: `/api/organizations/${organizationId}/connectors/catalog`,
    params: {
      q: query.trim() || undefined,
      kind: kind === 'all' ? undefined : kind,
      category: category === 'all' ? undefined : category,
    },
  });
  const connections = useApiQuery<ConnectorConnectionListResponse>({
    queryKey: queryKeys.integrations.connections(organizationId),
    path: `/api/organizations/${organizationId}/connectors`,
  });

  const connectionByCatalog = useMemo(() => {
    const map = new Map<string, ConnectorConnectionDto>();
    for (const item of connections.data?.items ?? []) {
      if (item.status === 'disconnected') {
        continue;
      }
      map.set(item.catalogId, item);
    }
    return map;
  }, [connections.data?.items]);

  const items = catalog.data?.items ?? [];
  const installed = (connections.data?.items ?? []).filter((item) => item.status !== 'disconnected');

  return (
    <>
      <PageHeader
        description="Search the connector catalog, run the setup wizard, complete OAuth, check connection health, manage permissions, and disconnect."
        title="Integrations"
      />

      <section className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search connectors"
              className="pl-9"
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder="Search Shopify, Stripe, Zendesk, HTTP…"
              value={query}
            />
          </div>
          <Tabs
            onValueChange={(value) => {
              setKind(value as ConnectorKind | 'all');
            }}
            value={kind}
          >
            <TabsList>
              <TabsTrigger value="all">All kinds</TabsTrigger>
              <TabsTrigger value="oauth">OAuth</TabsTrigger>
              <TabsTrigger value="http">HTTP</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <Tabs
          onValueChange={(value) => {
            setCategory(value as ConnectorCategory | 'all');
          }}
          value={category}
        >
          <TabsList>
            <TabsTrigger value="all">All categories</TabsTrigger>
            {CONNECTOR_CATEGORIES.map((item) => (
              <TabsTrigger key={item} value={item}>
                {connectorCategoryLabel(item)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </section>

      {catalog.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : catalog.isError ? (
        <QueryErrorAlert
          message={catalog.error.message}
          onRetry={() => {
            void catalog.refetch();
          }}
          pending={catalog.isFetching}
          title="Unable to load the marketplace"
        />
      ) : items.length === 0 ? (
        <EmptyState
          description="Try a different search or category."
          icon={<Store className="size-8" />}
          title="No connectors match"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => {
            const existing = connectionByCatalog.get(item.id);
            return (
              <Card key={item.id}>
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle>{item.name}</CardTitle>
                      <CardDescription>{item.description}</CardDescription>
                    </div>
                    {existing ? (
                      <Badge variant={connectionStatusVariant(existing.status)}>
                        {connectionStatusLabel(existing.status)}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{connectorKindLabel(item.kind)}</Badge>
                    <Badge variant="secondary">{connectorCategoryLabel(item.category)}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {existing ? (
                    <Button
                      onClick={() => {
                        setManaging(existing);
                      }}
                      type="button"
                    >
                      Manage
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        setSetup(item);
                      }}
                      type="button"
                    >
                      Connect
                    </Button>
                  )}
                  {item.websiteUrl ? (
                    <Button asChild type="button" variant="outline">
                      <a href={item.websiteUrl} rel="noreferrer" target="_blank">
                        Website
                      </a>
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Installed connections</h2>
          <p className="text-sm text-muted-foreground">
            Health, granted permissions, OAuth, and disconnect controls for this workspace.
          </p>
        </div>
        {connections.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : connections.isError ? (
          <QueryErrorAlert
            message={connections.error.message}
            onRetry={() => {
              void connections.refetch();
            }}
            pending={connections.isFetching}
            title="Unable to load connections"
          />
        ) : installed.length === 0 ? (
          <EmptyState
            description="Connect a catalog item to store encrypted credentials and run health checks."
            icon={<Plug className="size-8" />}
            title="No connectors installed"
          />
        ) : (
          <div className="grid gap-3">
            {installed.map((item) => (
              <Card key={item.id}>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <CardTitle>{item.name}</CardTitle>
                    <CardDescription>
                      {connectorKindLabel(item.kind)} · {item.provider}
                      {item.permissions.length > 0 ? ` · ${item.permissions.join(', ')}` : ''}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={connectionStatusVariant(item.status)}>{connectionStatusLabel(item.status)}</Badge>
                    <Badge variant={healthStatusVariant(item.health.status)}>
                      {healthStatusLabel(item.health.status)}
                    </Badge>
                    <Button
                      onClick={() => {
                        setManaging(item);
                      }}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Manage
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </section>

      {setup ? (
        <SetupWizardDialog
          definition={setup}
          onClose={() => {
            setSetup(undefined);
          }}
          organizationId={organizationId}
        />
      ) : null}
      {managing ? (
        <ConnectionDetailDialog
          connection={managing}
          definition={items.find((item) => item.id === managing.catalogId)}
          onClose={() => {
            setManaging(undefined);
          }}
          organizationId={organizationId}
        />
      ) : null}
    </>
  );
}
