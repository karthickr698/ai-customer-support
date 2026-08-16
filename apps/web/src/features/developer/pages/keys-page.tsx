import { useState, type FormEvent } from 'react';
import type { OrganizationApiKeyListResponse } from '@ai-customer-support/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { QueryErrorAlert } from '@/components/ui/query-error';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime } from '@/features/organizations/format';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { developerApi } from '../api';

export function DeveloperKeysPage() {
  const { organizationId } = useWorkspace();
  const [token, setToken] = useState<string | undefined>();
  const keys = useApiQuery<OrganizationApiKeyListResponse>({
    queryKey: queryKeys.developer.keys(organizationId),
    path: `/api/organizations/${organizationId}/api-keys`,
  });
  const createKey = useApiMutation({
    mutationFn: (name: string) => developerApi.createApiKey(organizationId, name),
    invalidateKeys: [queryKeys.developer.keys(organizationId)],
    successMessage: 'API key created',
  });
  const revoke = useApiMutation({
    mutationFn: (id: string) => developerApi.revokeApiKey(organizationId, id),
    invalidateKeys: [queryKeys.developer.keys(organizationId)],
    successMessage: 'API key revoked',
  });

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        {keys.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : keys.isError ? (
          <QueryErrorAlert message={keys.error.message} onRetry={() => void keys.refetch()} title="Unable to load keys" />
        ) : (keys.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="No API keys" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(keys.data?.items ?? []).map((key) => (
                <TableRow key={key.id}>
                  <TableCell>{key.name}</TableCell>
                  <TableCell className="font-mono text-xs">{key.prefix}</TableCell>
                  <TableCell>{key.lastUsedAt ? formatDateTime(key.lastUsedAt) : 'Never'}</TableCell>
                  <TableCell>
                    <Badge variant={key.status === 'active' ? 'success' : 'secondary'}>{key.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {key.status === 'active' ? (
                      <Button onClick={() => revoke.mutate(key.id)} size="sm" type="button" variant="ghost">
                        Revoke
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <form
          className="flex gap-2"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const name = (event.currentTarget.elements.namedItem('name') as HTMLInputElement).value.trim();
            if (!name) {
              return;
            }
            void createKey.mutateAsync(name).then((result) => {
              setToken(result.token);
              event.currentTarget.reset();
            });
          }}
        >
          <Input name="name" placeholder="Key name" />
          <Button type="submit">Create</Button>
        </form>
        {token ? <p className="break-all font-mono text-xs">Copy now: {token}</p> : null}
      </CardContent>
    </Card>
  );
}
