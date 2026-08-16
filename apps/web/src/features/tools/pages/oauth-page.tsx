import { type FormEvent, useMemo, useState } from 'react';
import type {
  ConnectorCatalogResponse,
  OAuthConnectorDto,
  OAuthConnectorListResponse,
  OAuthConnectorProvider,
  UpsertOAuthConnectorRequest,
} from '@ai-customer-support/contracts';
import { OAUTH_CONNECTOR_PROVIDERS } from '@ai-customer-support/contracts';
import { Plug } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { PasswordInput } from '@/features/identity/components/password-input';
import { ConfirmDialog } from '@/features/organizations/components/confirm-dialog';
import { formatDateTime } from '@/features/organizations/format';
import { hasPermission } from '@/features/organizations/permissions';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { toolsApi } from '../api';
import { oauthProviderLabel, oauthStatusLabel, oauthStatusVariant } from '../labels';
import {
  emptyOAuthForm,
  toOAuthRequest,
  validateOAuthForm,
  type OAuthFormErrors,
  type OAuthFormValues,
} from '../validation';

export function ToolsOAuthPage() {
  const { organizationId, permissions } = useWorkspace();
  const canManage = hasPermission(permissions, 'integration.manage');

  if (!canManage) {
    return (
      <EmptyState
        description="You need integration.manage to configure OAuth connectors for this workspace."
        icon={<Plug className="size-8" />}
        title="OAuth connectors are limited to admins"
      />
    );
  }

  return <OAuthWorkspace organizationId={organizationId} />;
}

function OAuthWorkspace({ organizationId }: { readonly organizationId: string }) {
  const [form, setForm] = useState<OAuthFormValues>(emptyOAuthForm());
  const [errors, setErrors] = useState<OAuthFormErrors>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState<OAuthConnectorDto>();
  const [completeCode, setCompleteCode] = useState('');
  const [completeState, setCompleteState] = useState('');
  const [pendingDisconnect, setPendingDisconnect] = useState<OAuthConnectorDto>();

  const catalog = useApiQuery<ConnectorCatalogResponse>({
    queryKey: queryKeys.tools.connectorCatalog(organizationId),
    path: `/api/organizations/${organizationId}/connectors/catalog`,
  });
  const connectors = useApiQuery<OAuthConnectorListResponse>({
    queryKey: queryKeys.tools.oauth(organizationId),
    path: `/api/organizations/${organizationId}/integrations/oauth`,
  });

  const oauthCatalog = useMemo(
    () => (catalog.data?.items ?? []).filter((item) => item.kind === 'oauth'),
    [catalog.data?.items],
  );

  const save = useApiMutation({
    mutationFn: (body: UpsertOAuthConnectorRequest) => toolsApi.upsertOAuth(organizationId, body),
    invalidateKeys: [queryKeys.tools.oauth(organizationId)],
    successMessage: 'OAuth connector saved. The client secret is encrypted and will not be shown again.',
  });
  const start = useApiMutation({
    mutationFn: (connectorId: string) => toolsApi.startOAuth(organizationId, connectorId),
    successMessage: 'Authorization URL opened',
  });
  const complete = useApiMutation({
    mutationFn: (input: { connectorId: string; code: string; state: string }) =>
      toolsApi.completeOAuth(organizationId, input.connectorId, { code: input.code, state: input.state }),
    invalidateKeys: [queryKeys.tools.oauth(organizationId)],
    successMessage: 'OAuth connector connected',
  });
  const disconnect = useApiMutation({
    mutationFn: (connectorId: string) => toolsApi.disconnectOAuth(organizationId, connectorId),
    invalidateKeys: [queryKeys.tools.oauth(organizationId)],
    successMessage: 'OAuth connector disconnected',
  });

  function applyProviderDefaults(provider: OAuthConnectorProvider, current: OAuthFormValues): OAuthFormValues {
    const definition = oauthCatalog.find((item) => item.provider === provider);
    return {
      ...current,
      provider,
      name: current.name || definition?.name || oauthProviderLabel(provider),
      authorizationUrl: definition?.defaultAuthorizationUrl ?? current.authorizationUrl,
      tokenUrl: definition?.defaultTokenUrl ?? current.tokenUrl,
    };
  }

  function openCreate(): void {
    setForm(applyProviderDefaults('custom', emptyOAuthForm()));
    setErrors({});
    setDialogOpen(true);
  }

  function openEdit(connector: OAuthConnectorDto): void {
    setForm({
      provider: connector.provider,
      name: connector.name,
      clientId: connector.clientId,
      clientSecret: '',
      authorizationUrl: connector.authorizationUrl,
      tokenUrl: connector.tokenUrl,
      scopesText: connector.scopes.join('\n'),
    });
    setErrors({});
    setDialogOpen(true);
  }

  function patch<K extends keyof OAuthFormValues>(key: K, value: OAuthFormValues[K]): void {
    setForm((current) => {
      if (key === 'provider') {
        return applyProviderDefaults(value as OAuthConnectorProvider, { ...current, provider: value as OAuthConnectorProvider });
      }
      return { ...current, [key]: value };
    });
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function onSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const nextErrors = validateOAuthForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    await save.mutateAsync(toOAuthRequest(form));
    setForm((current) => ({ ...current, clientSecret: '' }));
    setDialogOpen(false);
  }

  async function onStart(connector: OAuthConnectorDto): Promise<void> {
    const result = await start.mutateAsync(connector.id);
    window.open(result.authorizationUrl, '_blank', 'noopener,noreferrer');
  }

  async function onComplete(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!completeOpen) {
      return;
    }
    await complete.mutateAsync({
      connectorId: completeOpen.id,
      code: completeCode.trim(),
      state: completeState.trim(),
    });
    setCompleteCode('');
    setCompleteState('');
    setCompleteOpen(undefined);
  }

  const items = connectors.data?.items ?? [];

  return (
    <div className="space-y-4">
      <Alert variant="info">
        <AlertTitle>PKCE authorization code</AlertTitle>
        <AlertDescription>
          Client secrets are encrypted at rest and never returned. Connect opens the provider in a new tab. If the
          callback lands on the API JSON response, paste the <code>code</code> and <code>state</code> query values to
          finish.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>OAuth connectors</CardTitle>
            <CardDescription>One connector per provider. Used for HTTP tools when a store is connected.</CardDescription>
          </div>
          <Button onClick={openCreate} type="button">
            Add connector
          </Button>
        </CardHeader>
        <CardContent>
          {connectors.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : connectors.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Unable to load OAuth connectors</AlertTitle>
              <AlertDescription>{connectors.error.message}</AlertDescription>
            </Alert>
          ) : items.length === 0 ? (
            <EmptyState
              action={
                <Button onClick={openCreate} type="button">
                  Add connector
                </Button>
              }
              description="Register Shopify, Stripe, Zendesk, or a custom OAuth app."
              icon={<Plug className="size-8" />}
              title="No OAuth connectors yet"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((connector) => (
                  <TableRow key={connector.id}>
                    <TableCell>
                      <p className="font-medium">{connector.name}</p>
                      <p className="text-xs text-muted-foreground">{oauthProviderLabel(connector.provider)}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={oauthStatusVariant(connector.status)}>{oauthStatusLabel(connector.status)}</Badge>
                    </TableCell>
                    <TableCell>
                      <p className="break-all text-xs">{connector.clientId}</p>
                      {connector.externalAccountId ? (
                        <p className="text-xs text-muted-foreground">{connector.externalAccountId}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(connector.updatedAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button onClick={() => openEdit(connector)} size="sm" type="button" variant="outline">
                          Rotate
                        </Button>
                        <Button
                          disabled={start.isPending}
                          onClick={() => {
                            void onStart(connector);
                          }}
                          size="sm"
                          type="button"
                        >
                          Connect
                        </Button>
                        <Button
                          onClick={() => {
                            setCompleteOpen(connector);
                            setCompleteCode('');
                            setCompleteState('');
                          }}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Complete
                        </Button>
                        <Button
                          onClick={() => {
                            setPendingDisconnect(connector);
                          }}
                          size="sm"
                          type="button"
                          variant="destructive"
                        >
                          Disconnect
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
            setForm((current) => ({ ...current, clientSecret: '' }));
          }
        }}
        open={dialogOpen}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <form autoComplete="off" className="space-y-4" onSubmit={(event) => void onSave(event)}>
            <DialogHeader>
              <DialogTitle>OAuth connector</DialogTitle>
              <DialogDescription>
                Authorization and token URLs must be HTTPS. Saving replaces the stored client secret.
              </DialogDescription>
            </DialogHeader>
            <Field error={errors.provider} id="oauth-provider" label="Provider" required>
              <Select
                id="oauth-provider"
                onValueChange={(value) => {
                  patch('provider', value as OAuthConnectorProvider);
                }}
                options={OAUTH_CONNECTOR_PROVIDERS.map((provider) => ({
                  value: provider,
                  label: oauthProviderLabel(provider),
                }))}
                searchable={false}
                value={form.provider}
              />
            </Field>
            <Field error={errors.name} id="oauth-name" label="Display name" required>
              <Input
                id="oauth-name"
                maxLength={120}
                onChange={(event) => {
                  patch('name', event.target.value);
                }}
                value={form.name}
              />
            </Field>
            <Field error={errors.clientId} id="oauth-client-id" label="Client id" required>
              <Input
                autoComplete="off"
                id="oauth-client-id"
                maxLength={200}
                onChange={(event) => {
                  patch('clientId', event.target.value);
                }}
                value={form.clientId}
              />
            </Field>
            <Field error={errors.clientSecret} id="oauth-client-secret" label="Client secret" required>
              <PasswordInput
                autoComplete="new-password"
                id="oauth-client-secret"
                onChange={(event) => {
                  patch('clientSecret', event.target.value);
                }}
                spellCheck={false}
                toggleLabelHide="Hide client secret"
                toggleLabelShow="Show client secret"
                value={form.clientSecret}
              />
            </Field>
            <Field error={errors.authorizationUrl} id="oauth-authorize-url" label="Authorization URL" required>
              <Input
                autoComplete="off"
                id="oauth-authorize-url"
                onChange={(event) => {
                  patch('authorizationUrl', event.target.value);
                }}
                placeholder="https://auth.example.com/authorize"
                value={form.authorizationUrl}
              />
            </Field>
            <Field error={errors.tokenUrl} id="oauth-token-url" label="Token URL" required>
              <Input
                autoComplete="off"
                id="oauth-token-url"
                onChange={(event) => {
                  patch('tokenUrl', event.target.value);
                }}
                placeholder="https://auth.example.com/token"
                value={form.tokenUrl}
              />
            </Field>
            <Field
              error={errors.scopesText}
              hint="One scope per line, or comma-separated. At most 20."
              id="oauth-scopes"
              label="Scopes"
            >
              <Textarea
                id="oauth-scopes"
                onChange={(event) => {
                  patch('scopesText', event.target.value);
                }}
                rows={3}
                value={form.scopesText}
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
                {save.isPending ? <Spinner label="Saving OAuth connector" /> : null}
                Save connector
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setCompleteOpen(undefined);
            setCompleteCode('');
            setCompleteState('');
          }
        }}
        open={completeOpen !== undefined}
      >
        <DialogContent>
          <form autoComplete="off" className="space-y-4" onSubmit={(event) => void onComplete(event)}>
            <DialogHeader>
              <DialogTitle>Complete OAuth</DialogTitle>
              <DialogDescription>
                Paste the <code>code</code> and <code>state</code> from the callback URL. State is single-use and expires
                in 10 minutes.
              </DialogDescription>
            </DialogHeader>
            <Field id="oauth-code" label="Authorization code" required>
              <Input
                autoComplete="off"
                id="oauth-code"
                onChange={(event) => {
                  setCompleteCode(event.target.value);
                }}
                required
                value={completeCode}
              />
            </Field>
            <Field id="oauth-state" label="State" required>
              <Input
                autoComplete="off"
                id="oauth-state"
                onChange={(event) => {
                  setCompleteState(event.target.value);
                }}
                required
                value={completeState}
              />
            </Field>
            <DialogFooter>
              <Button
                onClick={() => {
                  setCompleteOpen(undefined);
                }}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={complete.isPending || completeCode.trim().length === 0 || completeState.trim().length === 0} type="submit">
                {complete.isPending ? <Spinner label="Completing OAuth" /> : null}
                Complete
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        confirmLabel="Disconnect"
        description="Access and refresh tokens will be dropped. You can connect again after registering the client."
        onConfirm={() => {
          if (!pendingDisconnect) {
            return;
          }
          void disconnect.mutateAsync(pendingDisconnect.id).then(() => {
            setPendingDisconnect(undefined);
          });
        }}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDisconnect(undefined);
          }
        }}
        open={pendingDisconnect !== undefined}
        pending={disconnect.isPending}
        title="Disconnect this OAuth connector?"
        variant="destructive"
      />
    </div>
  );
}
