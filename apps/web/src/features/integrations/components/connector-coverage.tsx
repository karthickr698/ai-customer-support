import { useMemo, useState } from 'react';
import type {
  ConnectorCatalogResponse,
  ConnectorConnectionDto,
  ConnectorConnectionListResponse,
  ConnectorDefinitionDto,
} from '@ai-customer-support/contracts';
import { Link } from 'react-router-dom';
import { HeartPulse, Plug, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { hasPermission } from '@/features/organizations/permissions';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { integrationsApi } from '../api';
import {
  commerceDatasetLabel,
  connectionStatusLabel,
  connectionStatusVariant,
  DATASET_CONNECTOR_PERMISSIONS,
  healthStatusLabel,
  healthStatusVariant,
  integrationsPath,
  type CommerceDataset,
} from '../labels';
import { QueryErrorAlert } from './query-error';
import { ConnectionDetailDialog } from './setup-wizard';

function connectionCoversDataset(
  connection: ConnectorConnectionDto,
  definition: ConnectorDefinitionDto | undefined,
  dataset: CommerceDataset,
): boolean {
  const keys = DATASET_CONNECTOR_PERMISSIONS[dataset];
  const granted = connection.permissions;
  const catalogIds = definition?.permissions.map((item) => item.id) ?? [];
  if (keys.some((key) => granted.includes(key) || catalogIds.includes(key))) {
    return true;
  }
  const category = definition?.category;
  if (dataset === 'returns') {
    return category === 'payments' || category === 'commerce';
  }
  if (dataset === 'customers') {
    return category === 'commerce' || category === 'payments' || category === 'support';
  }
  return category === 'commerce';
}

export function ConnectorCoverage({ dataset }: { readonly dataset: CommerceDataset }) {
  const { organizationId, permissions } = useWorkspace();
  const canManage = hasPermission(permissions, 'integration.manage');
  const [managing, setManaging] = useState<ConnectorConnectionDto>();
  const [probingId, setProbingId] = useState<string>();

  const catalog = useApiQuery<ConnectorCatalogResponse>({
    queryKey: queryKeys.integrations.catalog(organizationId),
    path: `/api/organizations/${organizationId}/connectors/catalog`,
    enabled: canManage,
  });
  const connections = useApiQuery<ConnectorConnectionListResponse>({
    queryKey: queryKeys.integrations.connections(organizationId),
    path: `/api/organizations/${organizationId}/connectors`,
    enabled: canManage,
  });

  const probe = useApiMutation({
    mutationFn: (connectionId: string) => integrationsApi.probeHealth(organizationId, connectionId),
    invalidateKeys: [queryKeys.integrations.connections(organizationId)],
    successMessage: 'Health check finished',
  });

  const definitionById = useMemo(() => {
    const map = new Map<string, ConnectorDefinitionDto>();
    for (const item of catalog.data?.items ?? []) {
      map.set(item.id, item);
    }
    return map;
  }, [catalog.data?.items]);

  const covering = useMemo(() => {
    return (connections.data?.items ?? []).filter((item) => {
      if (item.status === 'disconnected') {
        return false;
      }
      return connectionCoversDataset(item, definitionById.get(item.catalogId), dataset);
    });
  }, [connections.data?.items, dataset, definitionById]);

  const title = `${commerceDatasetLabel(dataset)} connectors`;

  if (!canManage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            Connection health, status, and permission controls are limited to workspace admins. You can still view
            tenant-scoped {commerceDatasetLabel(dataset).toLowerCase()} records.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (catalog.isPending || connections.isPending) {
    return <Skeleton className="h-28 w-full" />;
  }

  if (catalog.isError || connections.isError) {
    return (
      <QueryErrorAlert
        message={catalog.error?.message ?? connections.error?.message ?? 'Unable to load connector coverage.'}
        onRetry={() => {
          void catalog.refetch();
          void connections.refetch();
        }}
        pending={catalog.isFetching || connections.isFetching}
        title="Unable to load connection health"
      />
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            Health, connection status, and granted permissions for connectors that can supply this data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {covering.length === 0 ? (
            <EmptyState
              action={
                <Button asChild>
                  <Link to={integrationsPath(organizationId)}>Open marketplace</Link>
                </Button>
              }
              description="Connect a catalog item and grant the matching scopes so support tools can look up this data."
              icon={<Plug className="size-8" />}
              title={`No ${commerceDatasetLabel(dataset).toLowerCase()} connector installed`}
            />
          ) : (
            <ul className="space-y-3">
              {covering.map((item) => {
                const definition = definitionById.get(item.catalogId);
                const granted = item.permissions;
                const catalogPermissions = definition?.permissions ?? [];
                return (
                  <li
                    className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-start sm:justify-between"
                    key={item.id}
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{item.name}</p>
                        <Badge variant={connectionStatusVariant(item.status)}>
                          {connectionStatusLabel(item.status)}
                        </Badge>
                        <Badge variant={healthStatusVariant(item.health.status)}>
                          {healthStatusLabel(item.health.status)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{item.health.message}</p>
                      <div className="flex flex-wrap gap-1">
                        {catalogPermissions.length > 0
                          ? catalogPermissions.map((permission) => {
                              const active = granted.includes(permission.id) || permission.required;
                              return (
                                <Badge key={permission.id} variant={active ? 'secondary' : 'outline'}>
                                  {active ? permission.label : `Missing ${permission.label}`}
                                </Badge>
                              );
                            })
                          : granted.map((permission) => (
                              <Badge key={permission} variant="secondary">
                                {permission}
                              </Badge>
                            ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={probe.isPending || item.status === 'disconnected'}
                        onClick={() => {
                          setProbingId(item.id);
                          void probe.mutateAsync(item.id).finally(() => {
                            setProbingId(undefined);
                          });
                        }}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {probe.isPending && probingId === item.id ? (
                          <Spinner label="Checking health" />
                        ) : (
                          <HeartPulse className="size-4" />
                        )}
                        Check health
                      </Button>
                      <Button
                        onClick={() => {
                          setManaging(item);
                        }}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Shield className="size-4" />
                        Permissions
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
      {managing ? (
        <ConnectionDetailDialog
          connection={managing}
          definition={definitionById.get(managing.catalogId)}
          onClose={() => {
            setManaging(undefined);
          }}
          organizationId={organizationId}
        />
      ) : null}
    </>
  );
}
