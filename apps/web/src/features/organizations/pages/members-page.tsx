import { useState } from 'react';
import type { OrganizationMemberDto, OrganizationMembersResponse, OrganizationRole } from '@ai-customer-support/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuthStore } from '@/features/identity/auth-store';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { organizationsApi } from '../api';
import { ConfirmDialog } from '../components/confirm-dialog';
import { MemberAvatar } from '../components/member-avatar';
import { WorkspacePage } from '../components/workspace-page';
import { formatDateTime } from '../format';
import { hasPermission, memberManagement, ownerCount, roleLabel } from '../permissions';
import { useWorkspace } from '../workspace-context';

type PendingRoleChange = {
  readonly member: OrganizationMemberDto;
  readonly nextRole: OrganizationRole;
};

export function MembersPage() {
  const { organizationId, organization, permissions } = useWorkspace();
  const user = useAuthStore((state) => state.user);
  const [pendingRemove, setPendingRemove] = useState<OrganizationMemberDto>();
  const [pendingRole, setPendingRole] = useState<PendingRoleChange>();

  const members = useApiQuery<OrganizationMembersResponse>({
    queryKey: queryKeys.organizations.members(organizationId),
    path: `/api/organizations/${organizationId}/members`,
  });

  const changeRole = useApiMutation({
    mutationFn: (input: { membershipId: string; role: OrganizationRole }) =>
      organizationsApi.changeRole(organizationId, input.membershipId, { role: input.role }),
    invalidateKeys: [
      queryKeys.organizations.members(organizationId),
      queryKeys.organizations.detail(organizationId),
      queryKeys.organizations.auditLogs(organizationId),
    ],
    successMessage: 'Role updated',
  });
  const removeMember = useApiMutation({
    mutationFn: (membershipId: string) => organizationsApi.removeMember(organizationId, membershipId),
    invalidateKeys: [
      queryKeys.organizations.members(organizationId),
      queryKeys.organizations.auditLogs(organizationId),
    ],
    successMessage: 'Member removed',
  });

  const items = members.data?.members ?? [];
  const owners = ownerCount(items);
  const canManage = hasPermission(permissions, 'organization.members.manage');

  function requestRoleChange(member: OrganizationMemberDto, nextRole: OrganizationRole): void {
    if (nextRole === member.role) {
      return;
    }
    if (nextRole === 'owner' || member.role === 'owner') {
      setPendingRole({ member, nextRole });
      return;
    }
    changeRole.mutate({ membershipId: member.id, role: nextRole });
  }

  return (
    <WorkspacePage>
      <PageHeader
        description="People with access to this workspace. Role changes apply immediately and are recorded in the audit log."
        title="Team members"
      />

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            Signed in as {roleLabel(organization.membership.role)}.
            {canManage
              ? ' Owners can promote others to owner. You cannot change your own role.'
              : ' You can view the team, but only owners and admins can change roles.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {members.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState description="Invite a teammate to start collaborating." title="No members" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((member) => {
                  const isSelf = member.userId === user?.id;
                  const management = memberManagement({
                    actorRole: organization.membership.role,
                    actorUserId: user?.id ?? '',
                    actorPermissions: permissions,
                    target: member,
                    ownerCount: owners,
                  });

                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <MemberAvatar email={member.email} name={member.displayName} />
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 font-medium">
                              <span className="truncate">{member.displayName}</span>
                              {isSelf ? <Badge variant="outline">You</Badge> : null}
                            </p>
                            <p className="truncate text-sm text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {management.changeRole ? (
                          <Select
                            className="w-36"
                            disabled={changeRole.isPending}
                            onValueChange={(value) => {
                              requestRoleChange(member, value as OrganizationRole);
                            }}
                            options={management.assignableRoles.map((role) => ({
                              value: role,
                              label: roleLabel(role),
                            }))}
                            searchable={false}
                            value={member.role}
                          />
                        ) : (
                          <Badge variant="secondary">{roleLabel(member.role)}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={member.status === 'active' ? 'success' : 'secondary'}>{member.status}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDateTime(member.createdAt)}</TableCell>
                      {canManage ? (
                        <TableCell className="text-right">
                          {management.remove ? (
                            <Button
                              onClick={() => {
                                setPendingRemove(member);
                              }}
                              size="sm"
                              type="button"
                              variant="ghost"
                            >
                              Remove
                            </Button>
                          ) : null}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        confirmLabel={pendingRole?.nextRole === 'owner' ? 'Make owner' : 'Change role'}
        description={
          pendingRole?.nextRole === 'owner'
            ? `${pendingRole.member.displayName} will become an owner. You will keep your owner role.`
            : `${pendingRole?.member.displayName ?? 'This member'} will be changed from ${roleLabel(pendingRole?.member.role ?? 'viewer')} to ${roleLabel(pendingRole?.nextRole ?? 'viewer')}.`
        }
        onConfirm={() => {
          if (!pendingRole) {
            return;
          }
          changeRole.mutate(
            { membershipId: pendingRole.member.id, role: pendingRole.nextRole },
            {
              onSettled: () => {
                setPendingRole(undefined);
              },
            },
          );
        }}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRole(undefined);
          }
        }}
        open={pendingRole !== undefined}
        pending={changeRole.isPending}
        title={pendingRole?.nextRole === 'owner' ? 'Grant owner access' : 'Change member role'}
        variant={pendingRole?.member.role === 'owner' ? 'destructive' : 'default'}
      />

      <ConfirmDialog
        confirmLabel="Remove member"
        description={
          pendingRemove
            ? `${pendingRemove.displayName} (${pendingRemove.email}) will lose access to this workspace immediately.`
            : 'This member will lose access to this workspace.'
        }
        onConfirm={() => {
          if (!pendingRemove) {
            return;
          }
          removeMember.mutate(pendingRemove.id, {
            onSettled: () => {
              setPendingRemove(undefined);
            },
          });
        }}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRemove(undefined);
          }
        }}
        open={pendingRemove !== undefined}
        pending={removeMember.isPending}
        title="Remove team member"
        variant="destructive"
      />
    </WorkspacePage>
  );
}
