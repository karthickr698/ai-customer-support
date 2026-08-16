import { Link } from 'react-router-dom';
import type { OrganizationPermission, ToolDefinitionListResponse } from '@ai-customer-support/contracts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { hasPermission, permissionLabel } from '@/features/organizations/permissions';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { workspacePath } from '@/features/organizations/workspace-paths';
import { useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { ToolSchema } from '../components/tool-schema';
import { toolLabel, toolsPath, toolSideLabel } from '../labels';

export function ToolsCatalogPage() {
  const { organizationId, permissions } = useWorkspace();
  const catalog = useApiQuery<ToolDefinitionListResponse>({
    queryKey: queryKeys.tools.catalog(organizationId),
    path: `/api/organizations/${organizationId}/tools`,
  });

  if (catalog.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (catalog.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load tools</AlertTitle>
        <AlertDescription>{catalog.error.message}</AlertDescription>
      </Alert>
    );
  }

  const items = catalog.data?.items ?? [];
  if (items.length === 0) {
    return <EmptyState description="No allowlisted tools are registered for this workspace." title="No tools" />;
  }

  return (
    <div className="space-y-4">
      <Alert variant="info">
        <AlertTitle>Allowlist only</AlertTitle>
        <AlertDescription>
          The model may propose these tools. TypeScript still schema-validates, checks the listed permission, and
          executes the call. Enable tools for the agent in{' '}
          <Link className="underline underline-offset-4" to={workspacePath(organizationId, 'ai-agent')}>
            AI agent
          </Link>
          .
        </AlertDescription>
      </Alert>

      {items.map((tool) => {
        const canExecute = hasPermission(permissions, tool.permission as OrganizationPermission);
        return (
          <Card key={tool.name}>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <CardTitle>{toolLabel(tool.name)}</CardTitle>
                <CardDescription>{tool.description}</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={tool.side === 'write' ? 'warning' : 'secondary'}>{toolSideLabel(tool.side)}</Badge>
                <Badge variant="outline">{tool.executionKind === 'http' ? 'HTTPS connector' : 'Platform'}</Badge>
                {canExecute ? (
                  <Button asChild size="sm">
                    <Link to={`${toolsPath(organizationId, 'test')}?tool=${tool.name}`}>Test call</Link>
                  </Button>
                ) : (
                  <Badge variant="outline">Missing {tool.permission}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Permission</dt>
                  <dd className="mt-1">
                    {permissionLabel(tool.permission as OrganizationPermission)}{' '}
                    <span className="text-muted-foreground">({tool.permission})</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Retry</dt>
                  <dd className="mt-1 text-muted-foreground">
                    {String(tool.retry.maxAttempts)} attempt{tool.retry.maxAttempts === 1 ? '' : 's'} ·{' '}
                    {String(tool.retry.timeoutMs)} ms timeout
                    {tool.retry.backoffMs > 0 ? ` · ${String(tool.retry.backoffMs)} ms backoff` : ''}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Identifier</dt>
                  <dd className="mt-1">
                    <code className="text-xs">{tool.name}</code>
                  </dd>
                </div>
              </dl>
              <ToolSchema schema={tool.argumentSchema} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
