import { useState, type FormEvent } from 'react';
import type { PlatformOperatorListResponse, PlatformRole } from '@ai-customer-support/contracts';
import { PLATFORM_ROLES } from '@ai-customer-support/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { QueryErrorAlert } from '@/components/ui/query-error';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/features/organizations/components/confirm-dialog';
import { formatDateTime } from '@/features/organizations/format';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { platformApi } from '../api';
import { hasPlatformPermission } from '../permissions';
import { usePlatformOperator } from '../platform-context';

const ROLE_OPTIONS = PLATFORM_ROLES.map((role) => ({ value: role, label: role }));

export function PlatformOperatorsPage() {
  const operator = usePlatformOperator();
  const canManage = hasPlatformPermission(operator, 'platform.operators.manage');
  const [grantRole, setGrantRole] = useState<PlatformRole>('operator');
  const [revokeUserId, setRevokeUserId] = useState<string | undefined>();

  const operators = useApiQuery<PlatformOperatorListResponse>({
    queryKey: queryKeys.platform.operators(),
    path: '/api/platform/operators',
  });
  const grant = useApiMutation({
    mutationFn: (input: { email: string; role: PlatformRole }) => platformApi.grantOperator(input.email, input.role),
    invalidateKeys: [queryKeys.platform.operators()],
    successMessage: 'Operator granted',
  });
  const changeRole = useApiMutation({
    mutationFn: (input: { userId: string; role: PlatformRole }) =>
      platformApi.changeOperatorRole(input.userId, input.role),
    invalidateKeys: [queryKeys.platform.operators(), queryKeys.platform.me()],
    successMessage: 'Role updated',
  });
  const revoke = useApiMutation({
    mutationFn: (userId: string) => platformApi.revokeOperator(userId),
    invalidateKeys: [queryKeys.platform.operators()],
    successMessage: 'Operator revoked',
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Platform users</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {operators.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : operators.isError ? (
          <QueryErrorAlert
            message={operators.error.message}
            onRetry={() => {
              void operators.refetch();
            }}
            requestId={operators.error.requestId}
            title="Unable to load operators"
          />
        ) : (operators.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="No operators" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Granted</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(operators.data?.items ?? []).map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.displayName}</TableCell>
                  <TableCell>{item.email}</TableCell>
                  <TableCell>
                    {canManage && item.status === 'active' ? (
                      <Select
                        onValueChange={(value) => {
                          if ((PLATFORM_ROLES as readonly string[]).includes(value)) {
                            changeRole.mutate({ userId: item.userId, role: value as PlatformRole });
                          }
                        }}
                        options={ROLE_OPTIONS}
                        searchable={false}
                        value={item.role}
                      />
                    ) : (
                      item.role
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.status === 'active' ? 'success' : 'secondary'}>{item.status}</Badge>
                  </TableCell>
                  <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                  <TableCell>
                    {canManage && item.status === 'active' && item.userId !== operator.userId ? (
                      <Button onClick={() => setRevokeUserId(item.userId)} size="sm" type="button" variant="ghost">
                        Revoke
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {canManage ? (
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const email = (event.currentTarget.elements.namedItem('email') as HTMLInputElement).value.trim();
              if (!email) {
                return;
              }
              grant.mutate({ email, role: grantRole });
              event.currentTarget.reset();
            }}
          >
            <Input name="email" placeholder="user@example.com" type="email" />
            <Select
              onValueChange={(value) => {
                if ((PLATFORM_ROLES as readonly string[]).includes(value)) {
                  setGrantRole(value as PlatformRole);
                }
              }}
              options={ROLE_OPTIONS}
              searchable={false}
              value={grantRole}
            />
            <Button type="submit">Grant access</Button>
          </form>
        ) : null}
      </CardContent>
      <ConfirmDialog
        confirmLabel="Revoke"
        description="This user will lose platform console access immediately."
        onConfirm={() => {
          if (revokeUserId) {
            revoke.mutate(revokeUserId);
          }
          setRevokeUserId(undefined);
        }}
        onOpenChange={(open) => {
          if (!open) {
            setRevokeUserId(undefined);
          }
        }}
        open={Boolean(revokeUserId)}
        title="Revoke operator?"
        variant="destructive"
      />
    </Card>
  );
}
