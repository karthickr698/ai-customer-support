import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { OrganizationMembersResponse } from '@ai-customer-support/contracts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Spinner } from '@/components/ui/spinner';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { organizationsApi } from '../api';
import { ConfirmDialog } from '../components/confirm-dialog';
import { WorkspacePage } from '../components/workspace-page';
import { formatDateTime } from '../format';
import { canLeaveWorkspace, hasPermission, ownerCount, roleLabel } from '../permissions';
import { validateOrganizationName, validateOrganizationSlug } from '../validation';
import { useWorkspace } from '../workspace-context';

export function WorkspaceSettingsPage() {
  const navigate = useNavigate();
  const { organizationId, organization, permissions } = useWorkspace();
  const canUpdate = hasPermission(permissions, 'organization.update');
  const [name, setName] = useState(organization.name);
  const [slug, setSlug] = useState(organization.slug);
  const [nameError, setNameError] = useState<string>();
  const [slugError, setSlugError] = useState<string>();
  const [leaveOpen, setLeaveOpen] = useState(false);

  useEffect(() => {
    setName(organization.name);
    setSlug(organization.slug);
  }, [organization.name, organization.slug]);

  const members = useApiQuery<OrganizationMembersResponse>({
    queryKey: queryKeys.organizations.members(organizationId),
    path: `/api/organizations/${organizationId}/members`,
  });

  const update = useApiMutation({
    mutationFn: (body: { name?: string; slug?: string }) => organizationsApi.update(organizationId, body),
    invalidateKeys: [queryKeys.organizations.detail(organizationId), queryKeys.organizations.list()],
    successMessage: 'Workspace updated',
  });
  const leave = useApiMutation({
    mutationFn: () => organizationsApi.leave(organizationId),
    invalidateKeys: [queryKeys.organizations.all()],
    successMessage: 'You left the workspace',
    onSuccess: () => {
      void navigate('/organizations');
    },
  });

  const owners = ownerCount(members.data?.members ?? []);
  const mayLeave = canLeaveWorkspace({ role: organization.membership.role, ownerCount: owners });

  async function onSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const nextNameError = validateOrganizationName(name);
    const nextSlugError = validateOrganizationSlug(slug);
    setNameError(nextNameError);
    setSlugError(nextSlugError);
    if (nextNameError || nextSlugError) {
      return;
    }

    const body: { name?: string; slug?: string } = {};
    if (name.trim() !== organization.name) {
      body.name = name.trim();
    }
    if (slug.trim().toLowerCase() !== organization.slug) {
      body.slug = slug.trim().toLowerCase();
    }
    if (body.name === undefined && body.slug === undefined) {
      return;
    }
    await update.mutateAsync(body);
  }

  return (
    <WorkspacePage>
      <PageHeader
        description="Workspace identity is unique across the platform. Changing the slug does not change the workspace ID used in URLs."
        title="Workspace settings"
      />

      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>
            {canUpdate
              ? 'Update the display name and public slug for this workspace.'
              : 'You can view workspace details. Owners and admins can rename it.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid max-w-xl gap-4" noValidate onSubmit={(event) => void onSave(event)}>
            <Field error={nameError} id="workspace-name" label="Name" required>
              <Input
                disabled={!canUpdate}
                id="workspace-name"
                onChange={(event) => {
                  setName(event.target.value);
                  setNameError(undefined);
                }}
                value={name}
              />
            </Field>
            <Field
              error={slugError}
              hint="3–48 lowercase letters, numbers, and hyphens."
              id="workspace-slug"
              label="Slug"
              required
            >
              <Input
                disabled={!canUpdate}
                id="workspace-slug"
                onChange={(event) => {
                  setSlug(event.target.value.toLowerCase());
                  setSlugError(undefined);
                }}
                value={slug}
              />
            </Field>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>
                Status <Badge variant={organization.status === 'active' ? 'success' : 'secondary'}>{organization.status}</Badge>
              </span>
              <span>Created {formatDateTime(organization.createdAt)}</span>
              <span>Your role {roleLabel(organization.membership.role)}</span>
            </div>
            {canUpdate ? (
              <div>
                <Button disabled={update.isPending} type="submit">
                  {update.isPending ? (
                    <>
                      <Spinner label="Saving workspace" />
                      Saving…
                    </>
                  ) : (
                    'Save changes'
                  )}
                </Button>
              </div>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle>Leave workspace</CardTitle>
          <CardDescription>
            You will lose access until someone invites you again. The last owner cannot leave.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mayLeave ? (
            <Button
              onClick={() => {
                setLeaveOpen(true);
              }}
              type="button"
              variant="destructive"
            >
              Leave {organization.name}
            </Button>
          ) : (
            <Alert variant="warning">
              <AlertTitle>You are the last owner</AlertTitle>
              <AlertDescription>
                Promote another member to owner before leaving, or keep managing this workspace.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        confirmLabel="Leave workspace"
        description={`You will be removed from ${organization.name}. Conversations and knowledge stay with the workspace.`}
        onConfirm={() => {
          leave.mutate();
        }}
        onOpenChange={setLeaveOpen}
        open={leaveOpen}
        pending={leave.isPending}
        title="Leave this workspace?"
        variant="destructive"
      />
    </WorkspacePage>
  );
}
