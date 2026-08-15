import { type FormEvent, useState } from 'react';
import type { OrganizationInvitationDto, OrganizationInvitationsResponse, OrganizationRole } from '@ai-customer-support/contracts';
import { Mail } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { validateEmail } from '@/features/identity/validation';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { organizationsApi } from '../api';
import { ConfirmDialog } from '../components/confirm-dialog';
import { RequireWorkspacePermission } from '../components/require-workspace-permission';
import { WorkspacePage } from '../components/workspace-page';
import { formatDateTime } from '../format';
import { INVITE_ROLES, roleLabel } from '../permissions';
import { useWorkspace } from '../workspace-context';

export function InvitationsPage() {
  return (
    <RequireWorkspacePermission
      description="Owners and admins can send and revoke pending invitations. Ask one of them if you need to add a teammate."
      permission="organization.invitations.manage"
      title="You cannot manage invitations"
    >
      <InvitationsWorkspace />
    </RequireWorkspacePermission>
  );
}

function InvitationsWorkspace() {
  const { organizationId } = useWorkspace();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [role, setRole] = useState<Exclude<OrganizationRole, 'owner'>>('agent');
  const [pendingRevoke, setPendingRevoke] = useState<OrganizationInvitationDto>();

  const invitations = useApiQuery<OrganizationInvitationsResponse>({
    queryKey: queryKeys.organizations.invitations(organizationId),
    path: `/api/organizations/${organizationId}/invitations`,
  });

  const invite = useApiMutation({
    mutationFn: (body: { email: string; role: Exclude<OrganizationRole, 'owner'> }) =>
      organizationsApi.invite(organizationId, body),
    invalidateKeys: [
      queryKeys.organizations.invitations(organizationId),
      queryKeys.organizations.auditLogs(organizationId),
    ],
    successMessage: 'Invitation sent',
  });
  const revoke = useApiMutation({
    mutationFn: (invitationId: string) => organizationsApi.revokeInvitation(organizationId, invitationId),
    invalidateKeys: [
      queryKeys.organizations.invitations(organizationId),
      queryKeys.organizations.auditLogs(organizationId),
    ],
    successMessage: 'Invitation revoked',
  });

  async function onInvite(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const nextError = validateEmail(email);
    setEmailError(nextError);
    if (nextError) {
      return;
    }
    await invite.mutateAsync({ email: email.trim(), role });
    setEmail('');
  }

  const items = invitations.data?.invitations ?? [];

  return (
    <WorkspacePage>
      <PageHeader
        description="Invite people by work email. They must sign in with that address to accept. Invitations cannot grant owner."
        title="Invitations"
      />

      <Card>
        <CardHeader>
          <CardTitle>Invite a teammate</CardTitle>
          <CardDescription>A pending invite is unique per email. Revoke and send again to change the role.</CardDescription>
        </CardHeader>
        <CardContent>
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
                placeholder="alex@company.com"
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
                options={INVITE_ROLES.map((value) => ({ value, label: roleLabel(value) }))}
                searchable={false}
                value={role}
              />
            </Field>
            <Button className="sm:self-end" disabled={invite.isPending} type="submit">
              Send invite
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending invitations</CardTitle>
        </CardHeader>
        <CardContent>
          {invitations.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              description="Send an invite above. Pending invites expire automatically."
              icon={<Mail className="size-8" />}
              title="No pending invitations"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell>{invitation.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{roleLabel(invitation.role)}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(invitation.createdAt)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(invitation.expiresAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        onClick={() => {
                          setPendingRevoke(invitation);
                        }}
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
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        confirmLabel="Revoke invitation"
        description={
          pendingRevoke
            ? `${pendingRevoke.email} will no longer be able to join with this link.`
            : 'This invitation will stop working immediately.'
        }
        onConfirm={() => {
          if (!pendingRevoke) {
            return;
          }
          revoke.mutate(pendingRevoke.id, {
            onSettled: () => {
              setPendingRevoke(undefined);
            },
          });
        }}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRevoke(undefined);
          }
        }}
        open={pendingRevoke !== undefined}
        pending={revoke.isPending}
        title="Revoke invitation"
        variant="destructive"
      />
    </WorkspacePage>
  );
}
