import { type FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import type {
  OrganizationAuditLogListResponse,
  OrganizationInvitationsResponse,
  OrganizationMembersResponse,
  OrganizationPermission,
  OrganizationResponse,
  OrganizationRole,
} from '@ai-customer-support/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthStore } from '@/features/identity/auth-store';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { useSessionStore } from '@/stores/session-store';
import { organizationsApi } from '../api';

const inviteRoles: Array<Exclude<OrganizationRole, 'owner'>> = ['admin', 'agent', 'viewer'];

export function OrganizationDetailPage() {
  const { organizationId = '' } = useParams();
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const setTenantId = useSessionStore((state) => state.setTenantId);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Exclude<OrganizationRole, 'owner'>>('agent');

  useEffect(() => {
    if (organizationId) {
      setTenantId(organizationId);
    }
  }, [organizationId, setTenantId]);

  const organization = useApiQuery<OrganizationResponse>({
    queryKey: queryKeys.organizations.detail(organizationId),
    path: `/api/organizations/${organizationId}`,
    enabled: status === 'authenticated' && organizationId.length > 0,
  });
  const members = useApiQuery<OrganizationMembersResponse>({
    queryKey: queryKeys.organizations.members(organizationId),
    path: `/api/organizations/${organizationId}/members`,
    enabled: status === 'authenticated' && organizationId.length > 0,
  });
  const invitations = useApiQuery<OrganizationInvitationsResponse>({
    queryKey: queryKeys.organizations.invitations(organizationId),
    path: `/api/organizations/${organizationId}/invitations`,
    enabled:
      status === 'authenticated' &&
      can(organization.data?.organization.membership.permissions, 'organization.invitations.manage'),
  });
  const auditLogs = useApiQuery<OrganizationAuditLogListResponse>({
    queryKey: queryKeys.organizations.auditLogs(organizationId),
    path: `/api/organizations/${organizationId}/audit-logs`,
    enabled:
      status === 'authenticated' && can(organization.data?.organization.membership.permissions, 'organization.audit.view'),
  });

  const invite = useApiMutation({
    mutationFn: (body: { email: string; role: Exclude<OrganizationRole, 'owner'> }) =>
      organizationsApi.invite(organizationId, body),
    invalidateKeys: [queryKeys.organizations.invitations(organizationId), queryKeys.organizations.auditLogs(organizationId)],
    successMessage: 'Invitation sent',
  });
  const revoke = useApiMutation({
    mutationFn: (invitationId: string) => organizationsApi.revokeInvitation(organizationId, invitationId),
    invalidateKeys: [queryKeys.organizations.invitations(organizationId)],
    successMessage: 'Invitation revoked',
  });
  const removeMember = useApiMutation({
    mutationFn: (membershipId: string) => organizationsApi.removeMember(organizationId, membershipId),
    invalidateKeys: [queryKeys.organizations.members(organizationId)],
    successMessage: 'Member removed',
  });

  if (status === 'idle' || status === 'loading') {
    return <p className="p-8 text-sm text-muted-foreground">Checking session…</p>;
  }

  if (!user) {
    return <Navigate replace to="/login" />;
  }

  const current = organization.data?.organization;
  const permissions = current?.membership.permissions ?? [];

  async function onInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await invite.mutateAsync({ email, role });
    setEmail('');
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <PageHeader
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to={`/organizations/${organizationId}/knowledge`}>Knowledge</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/organizations">All organizations</Link>
            </Button>
          </div>
        }
        description={current ? `Signed in as ${current.membership.role}` : 'Loading workspace…'}
        title={current?.name ?? 'Organization'}
      />

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          {can(permissions, 'organization.invitations.manage') ? (
            <TabsTrigger value="invitations">Invitations</TabsTrigger>
          ) : null}
          {can(permissions, 'organization.audit.view') ? <TabsTrigger value="audit">Audit log</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle>Team</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    {can(permissions, 'organization.members.manage') ? <TableHead /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(members.data?.members ?? []).map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>{member.displayName}</TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{member.role}</Badge>
                      </TableCell>
                      {can(permissions, 'organization.members.manage') ? (
                        <TableCell className="text-right">
                          {member.userId === user.id ? null : (
                            <Button
                              onClick={() => removeMember.mutate(member.id)}
                              size="sm"
                              type="button"
                              variant="ghost"
                            >
                              Remove
                            </Button>
                          )}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {can(permissions, 'organization.invitations.manage') ? (
          <TabsContent value="invitations">
            <Card>
              <CardHeader>
                <CardTitle>Invite a teammate</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <form className="grid gap-3 sm:grid-cols-[1fr_8rem_auto]" onSubmit={(event) => void onInvite(event)}>
                  <div className="space-y-2">
                    <Label htmlFor="invite-email">Email</Label>
                    <Input
                      id="invite-email"
                      onChange={(event) => setEmail(event.target.value)}
                      required
                      type="email"
                      value={email}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-role">Role</Label>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      id="invite-role"
                      onChange={(event) => setRole(event.target.value as Exclude<OrganizationRole, 'owner'>)}
                      value={role}
                    >
                      {inviteRoles.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button className="sm:self-end" disabled={invite.isPending} type="submit">
                    Send invite
                  </Button>
                </form>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(invitations.data?.invitations ?? []).map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell>{invitation.email}</TableCell>
                        <TableCell>{invitation.role}</TableCell>
                        <TableCell>{new Date(invitation.expiresAt).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            onClick={() => revoke.mutate(invitation.id)}
                            size="sm"
                            type="button"
                            variant="ghost"
                          >
                            Revoke
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}

        {can(permissions, 'organization.audit.view') ? (
          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle>Tenant audit log</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(auditLogs.data?.items ?? []).map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.action}</TableCell>
                        <TableCell>{entry.actorId ?? '—'}</TableCell>
                        <TableCell>{new Date(entry.occurredAt).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}
      </Tabs>
    </main>
  );
}

function can(
  permissions: readonly OrganizationPermission[] | undefined,
  permission: OrganizationPermission,
): boolean {
  return permissions?.includes(permission) ?? false;
}
