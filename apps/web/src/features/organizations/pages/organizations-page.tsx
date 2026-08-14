import { type FormEvent, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import type { OrganizationListResponse } from '@ai-customer-support/contracts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { useAuthStore } from '@/features/identity/auth-store';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { organizationsApi } from '../api';

export function OrganizationsPage() {
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const logout = useAuthStore((state) => state.logout);
  const [name, setName] = useState('');

  const organizations = useApiQuery<OrganizationListResponse>({
    queryKey: queryKeys.organizations.list(),
    path: '/api/organizations',
    enabled: status === 'authenticated',
  });

  const create = useApiMutation({
    mutationFn: organizationsApi.create,
    invalidateKeys: [queryKeys.organizations.all()],
    successMessage: 'Organization created',
  });

  if (status === 'idle' || status === 'loading') {
    return <p className="p-8 text-sm text-muted-foreground">Checking session…</p>;
  }

  if (!user) {
    return <Navigate replace to="/login" />;
  }

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await create.mutateAsync({ name });
    setName('');
  }

  const items = organizations.data?.organizations ?? [];

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
          <CardDescription>You become the owner and can invite teammates afterward.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => void onCreate(event)}>
            <div className="flex-1 space-y-2">
              <Label htmlFor="organization-name">Name</Label>
              <Input
                id="organization-name"
                onChange={(event) => setName(event.target.value)}
                placeholder="Acme Support"
                required
                value={name}
              />
            </div>
            <Button disabled={create.isPending || name.trim().length === 0} type="submit">
              {create.isPending ? 'Creating…' : 'Create'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {items.length === 0 ? (
        <EmptyState
          description="Create an organization to start inviting your team."
          title="No organizations yet"
        />
      ) : (
        <div className="grid gap-3">
          {items.map((organization) => (
            <Link
              className="rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:bg-accent/40"
              key={organization.id}
              to={`/organizations/${organization.id}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{organization.name}</p>
                  <p className="text-sm text-muted-foreground">{organization.slug}</p>
                </div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{organization.membership.role}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
