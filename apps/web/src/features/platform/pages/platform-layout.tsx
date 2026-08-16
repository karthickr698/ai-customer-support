import { NavLink, Outlet } from 'react-router-dom';
import type { PlatformMeResponse } from '@ai-customer-support/contracts';
import {
  Activity,
  Building2,
  Flag,
  HeartPulse,
  ScrollText,
  Shield,
  Users,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { QueryErrorAlert } from '@/components/ui/query-error';
import { Skeleton } from '@/components/ui/skeleton';
import { RequireAuth } from '@/features/identity/components/require-auth';
import { cn } from '@/lib/utils';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { ApiError } from '@/services/api-error';
import { queryKeys } from '@/services/query-keys';
import { platformApi } from '../api';
import { PlatformOperatorProvider } from '../platform-context';

export function PlatformLayout() {
  return (
    <RequireAuth>
      <PlatformShell />
    </RequireAuth>
  );
}

function PlatformShell() {
  const me = useApiQuery<PlatformMeResponse>({
    queryKey: queryKeys.platform.me(),
    path: '/api/platform/me',
    retry: (count, error) => !(error instanceof ApiError && error.status === 403) && count < 2,
  });
  const bootstrap = useApiMutation({
    mutationFn: () => platformApi.bootstrap(),
    invalidateKeys: [queryKeys.platform.me()],
    successMessage: 'Platform owner bootstrapped',
  });

  if (me.isPending) {
    return (
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-10">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </main>
    );
  }

  if (me.isError && me.error.status !== 403) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <QueryErrorAlert
          message={me.error.message}
          onRetry={() => {
            void me.refetch();
          }}
          requestId={me.error.requestId}
          title="Unable to load platform console"
        />
      </main>
    );
  }

  const operator = me.data?.operator;
  if (!operator) {
    return (
      <main className="mx-auto max-w-lg space-y-4 px-4 py-16">
        <Alert variant="warning">
          <AlertTitle>Not a platform operator</AlertTitle>
          <AlertDescription>
            {me.data?.bootstrapAvailable
              ? 'Bootstrap the first platform owner from this account.'
              : 'If this is a fresh install and PLATFORM_BOOTSTRAP_EMAIL matches your account, you can bootstrap. Otherwise ask an existing operator to grant access.'}
          </AlertDescription>
        </Alert>
        <Button disabled={bootstrap.isPending} onClick={() => bootstrap.mutate()} type="button">
          Bootstrap platform owner
        </Button>
      </main>
    );
  }

  const items = [
    { to: '/platform', label: 'Health', icon: HeartPulse, end: true },
    { to: '/platform/tenants', label: 'Tenants', icon: Building2, end: true },
    { to: '/platform/operators', label: 'Users', icon: Users, end: true },
    { to: '/platform/plans', label: 'Plans & flags', icon: Flag, end: true },
    { to: '/platform/incidents', label: 'Incidents', icon: Activity, end: true },
    { to: '/platform/usage', label: 'Usage', icon: Shield, end: true },
    { to: '/platform/audit', label: 'Audit', icon: ScrollText, end: true },
  ];

  return (
    <PlatformOperatorProvider operator={operator}>
      <div className="flex min-h-screen">
        <aside className="hidden w-56 shrink-0 border-r border-sidebar-border bg-sidebar p-3 lg:block">
          <p className="px-2 py-3 text-sm font-semibold">Platform</p>
          <nav className="flex flex-col gap-1">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 rounded-md px-2 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent',
                      isActive && 'bg-sidebar-accent',
                    )
                  }
                  end={item.end}
                  key={item.to}
                  to={item.to}
                >
                  <Icon className="size-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </aside>
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
          <PageHeader
            description={`Signed in as ${operator.displayName} (${operator.role}).`}
            title="Platform administration"
          />
          <nav className="flex flex-wrap gap-1 rounded-lg bg-muted p-1 lg:hidden">
            {items.map((item) => (
              <NavLink
                className={({ isActive }) =>
                  cn('rounded-md px-3 py-1.5 text-sm', isActive && 'bg-background shadow-sm')
                }
                end={item.end}
                key={item.to}
                to={item.to}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <Outlet />
        </main>
      </div>
    </PlatformOperatorProvider>
  );
}
