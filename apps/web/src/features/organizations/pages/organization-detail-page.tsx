import { type FormEvent, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type {
  OrganizationAuditLogListResponse,
  OrganizationInvitationsResponse,
  OrganizationMembersResponse,
  OrganizationResponse,
  OrganizationRole,
} from '@ai-customer-support/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthStore } from '@/features/identity/auth-store';
import { RequireAuth } from '@/features/identity/components/require-auth';
import { validateEmail } from '@/features/identity/validation';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { organizationsApi } from '../api';
import { hasPermission, roleLabel } from '../permissions';
import { useTenantScope } from '../use-tenant-scope';

const inviteRoles: Array<Exclude<OrganizationRole, 'owner'>> = ['admin', 'agent', 'viewer'];

export function OrganizationDetailPage() {
  return (
    <RequireAuth>
      <OrganizationDetailWorkspace />
    </RequireAuth>
  );
}

function OrganizationDetailWorkspace() {
  const { organizationId = '' } = useParams();
  const user = useAuthStore((state) => state.user);
  useTenantScope(organizationId);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [role, setRole] = useState<Exclude<OrganizationRole, 'owner'>>('agent');

  const organization = useApiQuery<OrganizationResponse>({
    queryKey: queryKeys.organizations.detail(organizationId),
    path: `/api/organizations/${organizationId}`,
    enabled: organizationId.length > 0,
  });
  const members = useApiQuery<OrganizationMembersResponse>({
    queryKey: queryKeys.organizations.members(organizationId),
    path: `/api/organizations/${organizationId}/members`,
    enabled: organizationId.length > 0,
  });
  const invitations = useApiQuery<OrganizationInvitationsResponse>({
    queryKey: queryKeys.organizations.invitations(organizationId),
    path: `/api/organizations/${organizationId}/invitations`,
    enabled: hasPermission(organization.data?.organization.membership.permissions, 'organization.invitations.manage'),
  });
  const auditLogs = useApiQuery<OrganizationAuditLogListResponse>({
    queryKey: queryKeys.organizations.auditLogs(organizationId),
    path: `/api/organizations/${organizationId}/audit-logs`,
    enabled: hasPermission(organization.data?.organization.membership.permissions, 'organization.audit.view'),
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

  if (organization.isPending) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-72 w-full" />
      </main>
    );
  }

  const current = organization.data?.organization;
  const permissions = current?.membership.permissions ?? [];

  async function onInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextError = validateEmail(email);
    setEmailError(nextError);
    if (nextError) {
      return;
    }
    await invite.mutateAsync({ email: email.trim(), role });
    setEmail('');
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <PageHeader
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to={`/organizations/${organizationId}/onboarding`}>AI setup</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={`/organizations/${organizationId}/knowledge`}>Knowledge</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/organizations">All organizations</Link>
            </Button>
          </div>
        }
        description={current ? `Signed in as ${roleLabel(current.membership.role)}` : 'Loading workspace…'}
        title={current?.name ?? 'Organization'}
      />

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          {hasPermission(permissions, 'organization.invitations.manage') ? (
            <TabsTrigger value="invitations">Invitations</TabsTrigger>
          ) : null}
          {hasPermission(permissions, 'organization.audit.view') ? (
            <TabsTrigger value="audit">Audit log</TabsTrigger>
          ) : null}
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
                    {hasPermission(permissions, 'organization.members.manage') ? <TableHead /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(members.data?.members ?? []).map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>{member.displayName}</TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{roleLabel(member.role)}</Badge>
                      </TableCell>
                      {hasPermission(permissions, 'organization.members.manage') ? (
                        <TableCell className="text-right">
                          {member.userId === user?.id ? null : (
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

        {hasPermission(permissions, 'organization.invitations.manage') ? (
          <TabsContent value="invitations">
            <Card>
              <CardHeader>
                <CardTitle>Invite a teammate</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <form
                  className="grid gap-3 sm:grid-cols-[1fr_10rem_auto]"
                  noValidate
                  onSubmit={(event) => void onInvite(event)}
                >
                  <Field error={emailError} id="invite-email" label="Work email" required>
                    <Input
                      id="invite-email"
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setEmailError(undefined);
                      }}
                      type="email"
                      value={email}
                    />
                  </Field>
                  <Field id="invite-role" label="Role" required>
                    <Select
                      id="invite-role"
                      onValueChange={(value) => {
                        setRole(value as Exclude<OrganizationRole, 'owner'>);
                      }}
                      options={inviteRoles.map((value) => ({ value, label: roleLabel(value) }))}
                      searchable={false}
                      value={role}
                    />
                  </Field>
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
                        <TableCell>{roleLabel(invitation.role)}</TableCell>
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

        {hasPermission(permissions, 'organization.audit.view') ? (
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
