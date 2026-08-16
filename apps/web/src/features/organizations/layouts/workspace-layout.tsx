import { useState } from 'react';
import { Link, Outlet, useParams } from 'react-router-dom';
import type { OrganizationListResponse, OrganizationResponse } from '@ai-customer-support/contracts';
import { Menu } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { RequireAuth } from '@/features/identity/components/require-auth';
import { useApiQuery } from '@/hooks/use-api';
import { ApiError } from '@/services/api-error';
import { queryKeys } from '@/services/query-keys';
import { CreateWorkspaceDialog } from '../components/create-workspace-dialog';
import { WorkspaceSidebar } from '../components/workspace-sidebar';
import { useTenantScope } from '../use-tenant-scope';
import { WorkspaceProvider } from '../workspace-context';
import { WorkspaceRealtimeProvider } from '@/features/conversations/realtime/realtime-context';

export function WorkspaceLayout() {
  return (
    <RequireAuth>
      <WorkspaceShell />
    </RequireAuth>
  );
}

function WorkspaceShell() {
  const { organizationId = '' } = useParams();
  useTenantScope(organizationId);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const organization = useApiQuery<OrganizationResponse>({
    queryKey: queryKeys.organizations.detail(organizationId),
    path: `/api/organizations/${organizationId}`,
    enabled: organizationId.length > 0,
  });
  const organizations = useApiQuery<OrganizationListResponse>({
    queryKey: queryKeys.organizations.list(),
    path: '/api/organizations',
  });

  if (organization.isPending) {
    return (
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar p-3 lg:block">
          <Skeleton className="h-12 w-full" />
          <div className="mt-6 space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        </aside>
        <div className="flex-1 p-8">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="mt-6 h-72 w-full" />
        </div>
      </div>
    );
  }

  const current = organization.data?.organization;
  const loadError = organization.error instanceof ApiError ? organization.error.message : undefined;

  if (!current || loadError) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-16">
        <Alert variant="destructive">
          <AlertTitle>Could not open workspace</AlertTitle>
          <AlertDescription>{loadError ?? 'This organization is unavailable.'}</AlertDescription>
        </Alert>
        <Button asChild variant="outline">
          <Link to="/organizations">Back to workspaces</Link>
        </Button>
      </main>
    );
  }

  const listed = organizations.data?.organizations ?? [];
  const switcherOrgs = listed.some((item) => item.id === current.id) ? listed : [current, ...listed];

  const contextValue = {
    organizationId: current.id,
    organization: current,
    organizations: switcherOrgs,
    permissions: current.membership.permissions,
  };

  function openCreateWorkspace(): void {
    setMobileOpen(false);
    setCreateOpen(true);
  }

  return (
    <WorkspaceProvider value={contextValue}>
      <WorkspaceRealtimeProvider>
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-sidebar-border lg:block">
          <WorkspaceSidebar onCreateWorkspace={openCreateWorkspace} />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-2 border-b border-border px-3 py-2 lg:hidden">
            <Button
              aria-label="Open workspace menu"
              onClick={() => {
                setMobileOpen(true);
              }}
              size="icon"
              type="button"
              variant="ghost"
            >
              <Menu />
            </Button>
            <p className="truncate text-sm font-medium">{current.name}</p>
          </header>
          <Dialog onOpenChange={setMobileOpen} open={mobileOpen}>
            <DialogContent className="fixed inset-y-0 left-0 top-0 h-full w-72 max-w-none translate-x-0 translate-y-0 rounded-none border-y-0 border-l-0 p-0">
              <DialogTitle className="sr-only">Workspace navigation</DialogTitle>
              <WorkspaceSidebar
                onCreateWorkspace={openCreateWorkspace}
                onNavigate={() => {
                  setMobileOpen(false);
                }}
              />
            </DialogContent>
          </Dialog>
          <div className="min-w-0 flex-1">
            <Outlet />
          </div>
        </div>
      </div>
      <CreateWorkspaceDialog onOpenChange={setCreateOpen} open={createOpen} />
      </WorkspaceRealtimeProvider>
    </WorkspaceProvider>
  );
}
