import { type FormEvent, useMemo, useState } from 'react';
import type {
  IntegrationCredentialDto,
  IntegrationCredentialKind,
  IntegrationCredentialListResponse,
  ToolDefinitionListResponse,
  ToolName,
  UpsertIntegrationCredentialRequest,
} from '@ai-customer-support/contracts';
import { KeyRound } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PasswordInput } from '@/features/identity/components/password-input';
import { ConfirmDialog } from '@/features/organizations/components/confirm-dialog';
import { formatDateTime } from '@/features/organizations/format';
import { hasPermission } from '@/features/organizations/permissions';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { toolsApi } from '../api';
import { credentialKindLabel, secretHint, toolLabel } from '../labels';
import {
  emptyCredentialForm,
  httpTools,
  toCredentialRequest,
  validateCredentialForm,
  type CredentialFormErrors,
  type CredentialFormValues,
} from '../validation';

const PROVIDER_OPTIONS = [
  { value: 'custom', label: 'Custom' },
  { value: 'shopify', label: 'Shopify' },
  { value: 'stripe', label: 'Stripe' },
];

export function ToolsCredentialsPage() {
  const { permissions } = useWorkspace();
  const canManage = hasPermission(permissions, 'integration.manage');

  if (!canManage) {
    return (
      <EmptyState
        description="You need integration.manage to store encrypted HTTPS credentials for connector tools."
        icon={<KeyRound className="size-8" />}
        title="Credentials are limited to admins"
      />
    );
  }

  return <CredentialsWorkspace />;
}

function CredentialsWorkspace() {
  const { organizationId } = useWorkspace();
  const [form, setForm] = useState<CredentialFormValues>(emptyCredentialForm());
  const [errors, setErrors] = useState<CredentialFormErrors>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingRevoke, setPendingRevoke] = useState<IntegrationCredentialDto>();

  const catalog = useApiQuery<ToolDefinitionListResponse>({
    queryKey: queryKeys.tools.catalog(organizationId),
    path: `/api/organizations/${organizationId}/tools`,
  });
  const credentials = useApiQuery<IntegrationCredentialListResponse>({
    queryKey: queryKeys.tools.credentials(organizationId),
    path: `/api/organizations/${organizationId}/integrations/credentials`,
  });

  const connectorTools = useMemo(() => httpTools(catalog.data?.items ?? []), [catalog.data?.items]);

  const save = useApiMutation({
    mutationFn: (body: UpsertIntegrationCredentialRequest) => toolsApi.upsertCredential(organizationId, body),
    invalidateKeys: [queryKeys.tools.credentials(organizationId)],
    successMessage: 'Credential saved. The secret is encrypted and will not be shown again.',
  });
  const revoke = useApiMutation({
    mutationFn: (credentialId: string) => toolsApi.revokeCredential(organizationId, credentialId),
    invalidateKeys: [queryKeys.tools.credentials(organizationId)],
    successMessage: 'Credential revoked',
  });

  function openCreate(): void {
    setForm(emptyCredentialForm(connectorTools[0]?.name ?? ''));
    setErrors({});
    setDialogOpen(true);
  }

  function openRotate(credential: IntegrationCredentialDto): void {
    setForm({
      toolName: credential.toolName,
      name: credential.name,
      kind: credential.kind,
      secret: '',
      baseUrl: credential.baseUrl,
      headerName: credential.headerName,
      provider: credential.provider ?? 'custom',
    });
    setErrors({});
    setDialogOpen(true);
  }

  function patch<K extends keyof CredentialFormValues>(key: K, value: CredentialFormValues[K]): void {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'kind' && !current.headerName.trim()) {
        next.headerName = value === 'bearer' ? 'Authorization' : 'X-API-Key';
      }
      return next;
    });
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function onSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const nextErrors = validateCredentialForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    await save.mutateAsync(toCredentialRequest(form));
    setForm((current) => ({ ...current, secret: '' }));
    setDialogOpen(false);
  }

  const items = credentials.data?.items ?? [];

  return (
    <div className="space-y-4">
      <Alert variant="info">
        <AlertTitle>Secrets stay on the server</AlertTitle>
        <AlertDescription>
          API keys and bearer tokens are encrypted with AES-256-GCM. Only the last four characters are returned. HTTPS
          base URLs cannot include credentials or private hosts. Saving always replaces the stored secret.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>HTTPS credentials</CardTitle>
            <CardDescription>
              One credential per HTTP tool. Platform tools such as tickets do not use these connectors.
            </CardDescription>
          </div>
          <Button disabled={connectorTools.length === 0} onClick={openCreate} type="button">
            Add credential
          </Button>
        </CardHeader>
        <CardContent>
          {credentials.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : credentials.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Unable to load credentials</AlertTitle>
              <AlertDescription>{credentials.error.message}</AlertDescription>
            </Alert>
          ) : items.length === 0 ? (
            <EmptyState
              action={
                <Button onClick={openCreate} type="button">
                  Add credential
                </Button>
              }
              description="Connect a commerce HTTPS API for order lookup and refund status."
              icon={<KeyRound className="size-8" />}
              title="No credentials yet"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tool</TableHead>
                  <TableHead>API</TableHead>
                  <TableHead>Secret</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((credential) => (
                  <TableRow key={credential.id}>
                    <TableCell>
                      <p className="font-medium">{toolLabel(credential.toolName)}</p>
                      <p className="text-xs text-muted-foreground">{credential.name}</p>
                    </TableCell>
                    <TableCell>
                      <p className="break-all text-xs">{credential.baseUrl}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge variant="secondary">{credentialKindLabel(credential.kind)}</Badge>
                        <Badge variant="outline">{credential.headerName}</Badge>
                        {credential.provider ? <Badge variant="outline">{credential.provider}</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs">{secretHint(credential.secretLastFour)}</code>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(credential.updatedAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button onClick={() => openRotate(credential)} size="sm" type="button" variant="outline">
                          Rotate
                        </Button>
                        <Button
                          onClick={() => {
                            setPendingRevoke(credential);
                          }}
                          size="sm"
                          type="button"
                          variant="destructive"
                        >
                          Revoke
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setForm((current) => ({ ...current, secret: '' }));
          }
        }}
        open={dialogOpen}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <form autoComplete="off" className="space-y-4" onSubmit={(event) => void onSave(event)}>
            <DialogHeader>
              <DialogTitle>
                {form.toolName ? `Credential for ${toolLabel(form.toolName)}` : 'Add credential'}
              </DialogTitle>
              <DialogDescription>
                The secret is sent once and stored encrypted. It will not appear in this form after save.
              </DialogDescription>
            </DialogHeader>
            <Field error={errors.toolName} id="credential-tool" label="HTTP tool" required>
              <Select
                id="credential-tool"
                onValueChange={(value) => {
                  patch('toolName', value as ToolName);
                }}
                options={connectorTools.map((tool) => ({
                  value: tool.name,
                  label: toolLabel(tool.name),
                  description: tool.description,
                }))}
                placeholder="Select a connector tool"
                searchable={false}
                value={form.toolName}
              />
            </Field>
            <Field error={errors.name} id="credential-name" label="Display name" required>
              <Input
                id="credential-name"
                maxLength={120}
                onChange={(event) => {
                  patch('name', event.target.value);
                }}
                value={form.name}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field error={errors.kind} id="credential-kind" label="Kind" required>
                <Select
                  id="credential-kind"
                  onValueChange={(value) => {
                    patch('kind', value as IntegrationCredentialKind);
                  }}
                  options={[
                    { value: 'bearer', label: 'Bearer token', description: 'Authorization: Bearer <secret>' },
                    { value: 'api_key', label: 'API key', description: 'Sent as the configured header value' },
                  ]}
                  searchable={false}
                  value={form.kind}
                />
              </Field>
              <Field error={errors.headerName} hint="Letters, numbers, and hyphens." id="credential-header" label="Header name">
                <Input
                  autoComplete="off"
                  id="credential-header"
                  maxLength={80}
                  onChange={(event) => {
                    patch('headerName', event.target.value);
                  }}
                  value={form.headerName}
                />
              </Field>
            </div>
            <Field
              error={errors.baseUrl}
              hint="Public HTTPS origin only. Local and metadata hosts are blocked."
              id="credential-base-url"
              label="Base URL"
              required
            >
              <Input
                autoComplete="off"
                id="credential-base-url"
                onChange={(event) => {
                  patch('baseUrl', event.target.value);
                }}
                placeholder="https://api.example.com"
                value={form.baseUrl}
              />
            </Field>
            <Field error={errors.provider} id="credential-provider" label="Provider">
              <Select
                id="credential-provider"
                onValueChange={(value) => {
                  patch('provider', value);
                }}
                options={PROVIDER_OPTIONS}
                searchable={false}
                value={form.provider}
              />
            </Field>
            <Field error={errors.secret} id="credential-secret" label="Secret" required>
              <PasswordInput
                autoComplete="new-password"
                id="credential-secret"
                onChange={(event) => {
                  patch('secret', event.target.value);
                }}
                spellCheck={false}
                toggleLabelHide="Hide secret"
                toggleLabelShow="Show secret"
                value={form.secret}
              />
            </Field>
            <DialogFooter>
              <Button
                onClick={() => {
                  setDialogOpen(false);
                }}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={save.isPending} type="submit">
                {save.isPending ? <Spinner label="Saving credential" /> : null}
                Save credential
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        confirmLabel="Revoke"
        description="The connector will stop authenticating until you add a new secret. Existing audit records are kept."
        onConfirm={() => {
          if (!pendingRevoke) {
            return;
          }
          void revoke.mutateAsync(pendingRevoke.id).then(() => {
            setPendingRevoke(undefined);
          });
        }}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRevoke(undefined);
          }
        }}
        open={pendingRevoke !== undefined}
        pending={revoke.isPending}
        title="Revoke this credential?"
        variant="destructive"
      />
    </div>
  );
}
