import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { OrganizationListResponse } from '@ai-customer-support/contracts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useAuthStore } from '@/features/identity/auth-store';
import { RequireAuth } from '@/features/identity/components/require-auth';
import { validateOrganizationName } from '@/features/onboarding/validation';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { ApiError } from '@/services/api-error';
import { queryKeys } from '@/services/query-keys';
import { organizationsApi } from '../api';
import { hasPermission, roleLabel } from '../permissions';

export function OrganizationsPage() {
  return (
    <RequireAuth>
      <OrganizationsWorkspace />
    </RequireAuth>
  );
}

function OrganizationsWorkspace() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string>();

  const organizations = useApiQuery<OrganizationListResponse>({
    queryKey: queryKeys.organizations.list(),
    path: '/api/organizations',
  });

  const create = useApiMutation({
    mutationFn: organizationsApi.create,
    invalidateKeys: [queryKeys.organizations.all()],
    successMessage: 'Organization created',
    onSuccess: (result) => {
      void navigate(`/organizations/${result.organization.id}/onboarding`);
    },
  });

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = validateOrganizationName(name);
    setNameError(error);
    if (error) {
      return;
    }
    await create.mutateAsync({ name: name.trim() });
    setName('');
  }

  const items = organizations.data?.organizations ?? [];
  const loadError = organizations.error instanceof ApiError ? organizations.error.message : undefined;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
      <PageHeader
        actions={
          <Button onClick={() => void logout()} type="button" variant="outline">
            Sign out
          </Button>
        }
        description="Create a workspace or open one you already belong to. Tenant isolation is enforced on the server."
        title="Organizations"
      />

      <Card>
        <CardHeader>
          <CardTitle>New organization</CardTitle>
          <CardDescription>
            You become the owner and continue into AI onboarding. Invite teammates after the workspace exists.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end" noValidate onSubmit={(event) => void onCreate(event)}>
            <Field className="flex-1" error={nameError} id="organization-name" label="Workspace name" required>
              <Input
                id="organization-name"
                onChange={(event) => {
                  setName(event.target.value);
                  setNameError(undefined);
                }}
                placeholder="Acme Support"
                value={name}
              />
            </Field>
            <Button disabled={create.isPending} type="submit">
              {create.isPending ? (
                <>
                  <Spinner label="Creating organization" />
                  Creating…
                </>
              ) : (
                'Create and set up'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {organizations.isLoading ? (
        <div className="grid gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load organizations</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : items.length === 0 ? (
        <EmptyState
          description="Create an organization to start inviting your team and configuring the AI assistant."
          title="No organizations yet"
        />
      ) : (
        <div className="grid gap-3">
          {items.map((organization) => {
            const canUpdate = hasPermission(organization.membership.permissions, 'organization.update');
            return (
              <div
                className="rounded-xl border border-border bg-card p-5 shadow-sm"
                key={organization.id}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Link className="min-w-0 hover:underline" to={`/organizations/${organization.id}`}>
                    <p className="font-medium">{organization.name}</p>
                    <p className="text-sm text-muted-foreground">{organization.slug}</p>
                  </Link>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{roleLabel(organization.membership.role)}</Badge>
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/organizations/${organization.id}`}>Open</Link>
                    </Button>
                    <Button asChild size="sm" variant={canUpdate ? 'default' : 'outline'}>
                      <Link to={`/organizations/${organization.id}/onboarding`}>
                        {canUpdate ? 'AI setup' : 'View setup'}
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
