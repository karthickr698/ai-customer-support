import type { PublicApiVersionResponse } from '@ai-customer-support/contracts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QueryErrorAlert } from '@/components/ui/query-error';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { env } from '@/utils/env';

const EXAMPLE = `curl -sS "${env.publicApiUrl}/api/v1/organizations/$ORGANIZATION_ID" \\
  -H "Authorization: Bearer acs_live_..." \\
  -H "Accept: application/json"`;

export function DeveloperDocsPage() {
  const { organizationId } = useWorkspace();
  const version = useApiQuery<PublicApiVersionResponse>({
    queryKey: queryKeys.developer.version(),
    path: '/api/v1',
  });
  const docsUrl = `${env.publicApiUrl}/api/v1/docs`;
  const openApiUrl = `${env.publicApiUrl}/api/v1/openapi.json`;

  return (
    <div className="space-y-4">
      {version.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : version.isError ? (
        <QueryErrorAlert
          message={version.error.message}
          onRetry={() => {
            void version.refetch();
          }}
          pending={version.isFetching}
          title="Unable to load API version"
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Public API {version.data.apiVersion}</CardTitle>
            <CardDescription>Schema version {String(version.data.schemaVersion)}.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 text-sm">
            <a className="underline" href={docsUrl} rel="noreferrer" target="_blank">
              Open HTML docs
            </a>
            <a className="underline" href={openApiUrl} rel="noreferrer" target="_blank">
              openapi.json
            </a>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Request example</CardTitle>
          <CardDescription>Authenticate with an organization API key against the versioned public API.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs">{EXAMPLE.replace('$ORGANIZATION_ID', organizationId)}</pre>
        </CardContent>
      </Card>
    </div>
  );
}
