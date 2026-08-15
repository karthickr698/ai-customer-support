import { useState } from 'react';
import type { OrganizationAuditLogListResponse, OrganizationMembersResponse } from '@ai-customer-support/contracts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { RequireWorkspacePermission } from '../components/require-workspace-permission';
import { WorkspacePage } from '../components/workspace-page';
import { formatDateTime } from '../format';
import { auditActionLabel } from '../permissions';
import { useWorkspace } from '../workspace-context';

const PAGE_SIZE = 20;

export function AuditLogPage() {
  return (
    <RequireWorkspacePermission
      description="Owners and admins can review membership and workspace changes. Ask one of them if you need a record of an action."
      permission="organization.audit.view"
      title="You cannot view the audit log"
    >
      <AuditLogWorkspace />
    </RequireWorkspacePermission>
  );
}

function AuditLogWorkspace() {
  const { organizationId } = useWorkspace();
  const [page, setPage] = useState(1);

  const members = useApiQuery<OrganizationMembersResponse>({
    queryKey: queryKeys.organizations.members(organizationId),
    path: `/api/organizations/${organizationId}/members`,
  });
  const auditLogs = useApiQuery<OrganizationAuditLogListResponse>({
    queryKey: queryKeys.organizations.auditLogPage(organizationId, page),
    path: `/api/organizations/${organizationId}/audit-logs`,
    params: { page, pageSize: PAGE_SIZE },
  });

  const actorName = (actorId: string | null): string => {
    if (!actorId) {
      return 'System';
    }
    const member = members.data?.members.find((item) => item.userId === actorId);
    return member?.displayName ?? actorId;
  };

  const items = auditLogs.data?.items ?? [];
  const total = auditLogs.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <WorkspacePage>
      <PageHeader
        description="Membership, invitation, and workspace setting changes for this tenant. Platform operator actions are not listed here."
        title="Audit log"
      />

      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>{total === 1 ? '1 event' : `${String(total)} events`}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {auditLogs.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState description="Workspace changes will appear here." title="No audit events yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{auditActionLabel(entry.action)}</TableCell>
                    <TableCell>{actorName(entry.actorId)}</TableCell>
                    <TableCell className="max-w-xs text-muted-foreground">
                      {formatMetadata(entry.metadata)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(entry.occurredAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {pageCount > 1 ? <Pagination onPageChange={setPage} page={page} pageCount={pageCount} /> : null}
        </CardContent>
      </Card>
    </WorkspacePage>
  );
}

function formatMetadata(metadata: Record<string, unknown> | null): string {
  if (!metadata || Object.keys(metadata).length === 0) {
    return '—';
  }

  return Object.entries(metadata)
    .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join(' · ');
}
