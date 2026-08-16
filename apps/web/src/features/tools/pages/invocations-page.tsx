import { useState } from 'react';
import type { ToolInvocationDto, ToolInvocationListResponse } from '@ai-customer-support/contracts';
import { ScrollText } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime } from '@/features/organizations/format';
import { hasPermission } from '@/features/organizations/permissions';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { JsonPreview } from '../components/json-preview';
import { invocationStatusLabel, invocationStatusVariant, toolLabel } from '../labels';

const PAGE_SIZE = 20;

export function ToolsInvocationsPage() {
  const { permissions } = useWorkspace();
  const canAudit =
    hasPermission(permissions, 'organization.audit.view') || hasPermission(permissions, 'integration.manage');

  if (!canAudit) {
    return (
      <EmptyState
        description="You need organization.audit.view or integration.manage to inspect tool invocations."
        icon={<ScrollText className="size-8" />}
        title="Invocation history is limited"
      />
    );
  }

  return <InvocationsWorkspace />;
}

function InvocationsWorkspace() {
  const { organizationId } = useWorkspace();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ToolInvocationDto>();

  const invocations = useApiQuery<ToolInvocationListResponse>({
    queryKey: queryKeys.tools.invocations(organizationId, page),
    path: `/api/organizations/${organizationId}/tools/invocations`,
    params: { page, pageSize: PAGE_SIZE },
  });

  const items = invocations.data?.items ?? [];
  const total = invocations.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invocation audit</CardTitle>
        <CardDescription>
          Tenant-scoped execution history. Secrets are not stored on these records.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {invocations.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : invocations.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Unable to load invocations</AlertTitle>
            <AlertDescription>{invocations.error.message}</AlertDescription>
          </Alert>
        ) : items.length === 0 ? (
          <EmptyState description="Test calls and AI tool executions will appear here." title="No invocations yet" />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tool</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow
                    className="cursor-pointer"
                    key={item.id}
                    onClick={() => {
                      setSelected(item);
                    }}
                  >
                    <TableCell>
                      <p className="font-medium">{toolLabel(item.toolName)}</p>
                      <p className="text-xs text-muted-foreground">{item.id}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={invocationStatusVariant(item.status)}>
                        {invocationStatusLabel(item.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.actorType}
                      {item.conversationId ? ` · ${item.conversationId.slice(0, 8)}` : ''}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{String(item.durationMs)} ms</TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(item.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination onPageChange={setPage} page={page} pageCount={pageCount} />
          </>
        )}
      </CardContent>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setSelected(undefined);
          }
        }}
        open={selected !== undefined}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected ? toolLabel(selected.toolName) : 'Invocation'}</DialogTitle>
            <DialogDescription>
              {selected
                ? `${invocationStatusLabel(selected.status)} · ${String(selected.durationMs)} ms · ${String(selected.attemptCount)} attempt(s)`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {selected ? <JsonPreview label="Invocation detail" value={selected} /> : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
