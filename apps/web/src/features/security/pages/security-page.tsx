import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import type {
  OAuthApplicationListResponse,
  OrganizationApiKeyListResponse,
  SecurityAuditLogListResponse,
  SecurityIpAllowlistResponse,
  SecurityPolicyResponse,
  SecurityRateLimitsResponse,
  SecuritySecretListResponse,
} from '@ai-customer-support/contracts';
import { SECURITY_SECRET_PURPOSES } from '@ai-customer-support/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { QueryErrorAlert } from '@/components/ui/query-error';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/features/identity/auth-store';
import { ConfirmDialog } from '@/features/organizations/components/confirm-dialog';
import { RequireWorkspacePermission } from '@/features/organizations/components/require-workspace-permission';
import { WorkspacePage } from '@/features/organizations/components/workspace-page';
import { formatDateTime } from '@/features/organizations/format';
import { hasPermission } from '@/features/organizations/permissions';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { securityApi } from '../api';

export function SecurityPage() {
  return (
    <RequireWorkspacePermission
      description="You need security.read to view sessions, keys, and security activity."
      permission="security.read"
      title="Security is unavailable"
    >
      <SecurityWorkspace />
    </RequireWorkspacePermission>
  );
}

function SecurityWorkspace() {
  const { organizationId, permissions } = useWorkspace();
  const canManage = hasPermission(permissions, 'security.manage');
  const canIntegration = hasPermission(permissions, 'integration.manage');
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') ?? 'sessions';
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);

  const policy = useApiQuery<SecurityPolicyResponse>({
    queryKey: queryKeys.security.policy(organizationId),
    path: `/api/organizations/${organizationId}/security/policy`,
  });
  const limits = useApiQuery<SecurityRateLimitsResponse>({
    queryKey: queryKeys.security.rateLimits(organizationId),
    path: `/api/organizations/${organizationId}/security/rate-limits`,
  });
  const allowlist = useApiQuery<SecurityIpAllowlistResponse>({
    queryKey: queryKeys.security.ipAllowlist(organizationId),
    path: `/api/organizations/${organizationId}/security/ip-allowlist`,
  });
  const secrets = useApiQuery<SecuritySecretListResponse>({
    queryKey: queryKeys.security.secrets(organizationId),
    path: `/api/organizations/${organizationId}/security/secrets`,
  });
  const apiKeys = useApiQuery<OrganizationApiKeyListResponse>({
    queryKey: queryKeys.security.apiKeys(organizationId),
    path: `/api/organizations/${organizationId}/api-keys`,
    enabled: canIntegration,
  });
  const apps = useApiQuery<OAuthApplicationListResponse>({
    queryKey: queryKeys.security.oauthApps(organizationId),
    path: `/api/organizations/${organizationId}/oauth/applications`,
    enabled: canIntegration,
  });
  const audit = useApiQuery<SecurityAuditLogListResponse>({
    queryKey: queryKeys.security.audit(organizationId, page),
    path: `/api/organizations/${organizationId}/security/audit-logs`,
    params: { page, pageSize: 20 },
  });

  const updatePolicy = useApiMutation({
    mutationFn: (body: { mfaRequired?: boolean; ipAllowlistEnabled?: boolean; sessionIdleTimeoutSeconds?: number }) =>
      securityApi.updatePolicy(organizationId, body),
    invalidateKeys: [queryKeys.security.policy(organizationId)],
    successMessage: 'Security policy updated',
  });
  const addIp = useApiMutation({
    mutationFn: (input: { cidr: string; label?: string }) => securityApi.addIp(organizationId, input.cidr, input.label),
    invalidateKeys: [queryKeys.security.ipAllowlist(organizationId)],
    successMessage: 'Allowlist entry added',
  });
  const removeIp = useApiMutation({
    mutationFn: (id: string) => securityApi.removeIp(organizationId, id),
    invalidateKeys: [queryKeys.security.ipAllowlist(organizationId)],
    successMessage: 'Allowlist entry removed',
  });
  const createSecret = useApiMutation({
    mutationFn: (input: { name: string; purpose: string; plaintext: string }) =>
      securityApi.createSecret(organizationId, {
        name: input.name,
        purpose: input.purpose as (typeof SECURITY_SECRET_PURPOSES)[number],
        plaintext: input.plaintext,
      }),
    invalidateKeys: [queryKeys.security.secrets(organizationId)],
    successMessage: 'Secret stored',
  });
  const revokeSecret = useApiMutation({
    mutationFn: (id: string) => securityApi.revokeSecret(organizationId, id),
    invalidateKeys: [queryKeys.security.secrets(organizationId)],
    successMessage: 'Secret revoked',
  });
  const createKey = useApiMutation({
    mutationFn: (name: string) => securityApi.createApiKey(organizationId, { name }),
    invalidateKeys: [queryKeys.security.apiKeys(organizationId)],
    successMessage: 'API key created',
  });
  const revokeKey = useApiMutation({
    mutationFn: (id: string) => securityApi.revokeApiKey(organizationId, id),
    invalidateKeys: [queryKeys.security.apiKeys(organizationId)],
    successMessage: 'API key revoked',
  });
  const createApp = useApiMutation({
    mutationFn: (input: { name: string; redirectUris: string[] }) =>
      securityApi.createOAuthApp(organizationId, input.name, input.redirectUris),
    invalidateKeys: [queryKeys.security.oauthApps(organizationId)],
    successMessage: 'Connected app created',
  });
  const revokeApp = useApiMutation({
    mutationFn: (id: string) => securityApi.revokeOAuthApp(organizationId, id),
    invalidateKeys: [queryKeys.security.oauthApps(organizationId)],
    successMessage: 'App revoked',
  });

  const [revealedToken, setRevealedToken] = useState<string | undefined>();
  const [revokeTarget, setRevokeTarget] = useState<{ kind: 'secret' | 'key' | 'app'; id: string } | undefined>();

  return (
    <WorkspacePage wide>
      <PageHeader
        description="Session policy, API credentials, connected OAuth apps, and security audit activity. Revoke from the same screens."
        title="Security"
      />
      <Tabs
        onValueChange={(value) => {
          const next = new URLSearchParams(searchParams);
          next.set('tab', value);
          next.delete('page');
          setSearchParams(next);
        }}
        value={tab}
      >
        <TabsList>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="keys">API keys</TabsTrigger>
          <TabsTrigger value="apps">Connected apps</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent className="space-y-4" value="sessions">
          {policy.isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : policy.isError ? (
            <QueryErrorAlert
              message={policy.error.message}
              onRetry={() => {
                void policy.refetch();
              }}
              pending={policy.isFetching}
              title="Unable to load security policy"
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Session policy</CardTitle>
                <CardDescription>Idle timeout and MFA are enforced by the API, not only the browser.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border p-4">
                  <p className="font-medium">{user?.displayName}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Current browser session. There is no list-sessions API; sign out revokes the refresh token.</p>
                  <Button className="mt-3" onClick={() => void logout()} type="button" variant="outline">
                    Sign out this session
                  </Button>
                </div>
                <label className="flex items-center justify-between gap-3 text-sm">
                  Require MFA
                  <Switch
                    checked={policy.data.policy.mfaRequired}
                    disabled={!canManage}
                    onCheckedChange={(mfaRequired) => {
                      updatePolicy.mutate({ mfaRequired });
                    }}
                  />
                </label>
                <label className="flex items-center justify-between gap-3 text-sm">
                  Enable IP allowlist
                  <Switch
                    checked={policy.data.policy.ipAllowlistEnabled}
                    disabled={!canManage}
                    onCheckedChange={(ipAllowlistEnabled) => {
                      updatePolicy.mutate({ ipAllowlistEnabled });
                    }}
                  />
                </label>
                <Field id="idle-timeout" label="Idle timeout (seconds)">
                  <Input
                    defaultValue={String(policy.data.policy.sessionIdleTimeoutSeconds)}
                    disabled={!canManage}
                    min={60}
                    onBlur={(event) => {
                      const value = Number(event.target.value);
                      if (Number.isFinite(value) && value !== policy.data.policy.sessionIdleTimeoutSeconds) {
                        updatePolicy.mutate({ sessionIdleTimeoutSeconds: value });
                      }
                    }}
                    type="number"
                  />
                </Field>
                {limits.data ? (
                  <p className="text-sm text-muted-foreground">
                    Tenant rate limit {String(limits.data.tenant.used)}/{String(limits.data.tenant.limit)} this window.
                    IP {String(limits.data.ip.used)}/{String(limits.data.ip.limit)}.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>IP allowlist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {allowlist.isError ? (
                <QueryErrorAlert
                  message={allowlist.error.message}
                  onRetry={() => {
                    void allowlist.refetch();
                  }}
                  title="Unable to load allowlist"
                />
              ) : (allowlist.data?.items.length ?? 0) === 0 ? (
                <EmptyState title="No allowlist entries" />
              ) : (
                <ul className="space-y-2 text-sm">
                  {(allowlist.data?.items ?? []).map((entry) => (
                    <li className="flex items-center justify-between gap-2" key={entry.id}>
                      <span>
                        {entry.cidr} {entry.label ? `· ${entry.label}` : ''}
                      </span>
                      {canManage ? (
                        <Button onClick={() => removeIp.mutate(entry.id)} size="sm" type="button" variant="ghost">
                          Remove
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {canManage ? (
                <form
                  className="flex gap-2"
                  onSubmit={(event: FormEvent<HTMLFormElement>) => {
                    event.preventDefault();
                    const form = event.currentTarget;
                    const cidr = (form.elements.namedItem('cidr') as HTMLInputElement).value.trim();
                    const label = (form.elements.namedItem('label') as HTMLInputElement).value.trim();
                    if (cidr) {
                      addIp.mutate({ cidr, label: label || undefined });
                      form.reset();
                    }
                  }}
                >
                  <Input name="cidr" placeholder="CIDR" />
                  <Input name="label" placeholder="Label" />
                  <Button type="submit">Add</Button>
                </form>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent className="space-y-4" value="keys">
          <Card>
            <CardHeader>
              <CardTitle>Organization API keys</CardTitle>
              <CardDescription>Public API keys. Requires integration.manage to list or revoke.</CardDescription>
            </CardHeader>
            <CardContent>
              {!canIntegration ? (
                <EmptyState description="Ask an admin with integration.manage to issue keys." title="Keys are limited" />
              ) : apiKeys.isPending ? (
                <Skeleton className="h-24 w-full" />
              ) : apiKeys.isError ? (
                <QueryErrorAlert
                  message={apiKeys.error.message}
                  onRetry={() => {
                    void apiKeys.refetch();
                  }}
                  title="Unable to load API keys"
                />
              ) : (apiKeys.data?.items.length ?? 0) === 0 ? (
                <EmptyState title="No API keys" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Prefix</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(apiKeys.data?.items ?? []).map((key) => (
                      <TableRow key={key.id}>
                        <TableCell>{key.name}</TableCell>
                        <TableCell className="font-mono text-xs">{key.prefix}</TableCell>
                        <TableCell>
                          <Badge variant={key.status === 'active' ? 'success' : 'secondary'}>{key.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {key.status === 'active' ? (
                            <Button onClick={() => setRevokeTarget({ kind: 'key', id: key.id })} size="sm" type="button" variant="ghost">
                              Revoke
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {canIntegration ? (
                <form
                  className="mt-4 flex gap-2"
                  onSubmit={(event: FormEvent<HTMLFormElement>) => {
                    event.preventDefault();
                    const name = (event.currentTarget.elements.namedItem('name') as HTMLInputElement).value.trim();
                    if (!name) {
                      return;
                    }
                    void createKey.mutateAsync(name).then((result) => {
                      setRevealedToken(result.token);
                      event.currentTarget.reset();
                    });
                  }}
                >
                  <Input name="name" placeholder="Key name" />
                  <Button type="submit">Create key</Button>
                </form>
              ) : null}
              {revealedToken ? (
                <p className="mt-3 break-all font-mono text-xs">Copy now: {revealedToken}</p>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Encrypted secrets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {secrets.isError ? (
                <QueryErrorAlert message={secrets.error.message} onRetry={() => void secrets.refetch()} title="Unable to load secrets" />
              ) : (secrets.data?.items.length ?? 0) === 0 ? (
                <EmptyState title="No secrets" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Purpose</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(secrets.data?.items ?? []).map((secret) => (
                      <TableRow key={secret.id}>
                        <TableCell>{secret.name}</TableCell>
                        <TableCell>{secret.purpose}</TableCell>
                        <TableCell>
                          {canManage && !secret.revokedAt ? (
                            <Button onClick={() => setRevokeTarget({ kind: 'secret', id: secret.id })} size="sm" type="button" variant="ghost">
                              Revoke
                            </Button>
                          ) : (
                            <Badge variant="secondary">Revoked</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {canManage ? <CreateSecretForm onCreate={(input) => createSecret.mutate(input)} /> : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="apps">
          <Card>
            <CardHeader>
              <CardTitle>Connected OAuth apps</CardTitle>
              <CardDescription>Inbound applications that can request access to this workspace.</CardDescription>
            </CardHeader>
            <CardContent>
              {!canIntegration ? (
                <EmptyState title="Connected apps require integration.manage" />
              ) : apps.isPending ? (
                <Skeleton className="h-24 w-full" />
              ) : apps.isError ? (
                <QueryErrorAlert message={apps.error.message} onRetry={() => void apps.refetch()} title="Unable to load apps" />
              ) : (apps.data?.items.length ?? 0) === 0 ? (
                <EmptyState title="No connected apps" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Client id</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(apps.data?.items ?? []).map((app) => (
                      <TableRow key={app.id}>
                        <TableCell>{app.name}</TableCell>
                        <TableCell className="font-mono text-xs">{app.clientId}</TableCell>
                        <TableCell>
                          <Badge variant={app.status === 'active' ? 'success' : 'secondary'}>{app.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {app.status === 'active' ? (
                            <Button onClick={() => setRevokeTarget({ kind: 'app', id: app.id })} size="sm" type="button" variant="ghost">
                              Revoke
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {canIntegration ? (
                <form
                  className="mt-4 grid gap-2"
                  onSubmit={(event: FormEvent<HTMLFormElement>) => {
                    event.preventDefault();
                    const form = event.currentTarget;
                    const name = (form.elements.namedItem('name') as HTMLInputElement).value.trim();
                    const redirectUris = (form.elements.namedItem('redirectUris') as HTMLInputElement).value
                      .split(',')
                      .map((item) => item.trim())
                      .filter(Boolean);
                    if (name && redirectUris.length > 0) {
                      createApp.mutate({ name, redirectUris });
                      form.reset();
                    }
                  }}
                >
                  <Input name="name" placeholder="App name" />
                  <Input name="redirectUris" placeholder="Redirect URIs, comma separated" />
                  <Button type="submit">Register app</Button>
                </form>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          {audit.isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : audit.isError ? (
            <QueryErrorAlert message={audit.error.message} onRetry={() => void audit.refetch()} title="Unable to load security activity" />
          ) : (audit.data?.items.length ?? 0) === 0 ? (
            <EmptyState title="No security events" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(audit.data?.items ?? []).map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{event.action}</TableCell>
                      <TableCell>
                        <Badge variant={event.outcome === 'success' ? 'success' : 'destructive'}>{event.outcome}</Badge>
                      </TableCell>
                      <TableCell>{formatDateTime(event.occurredAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4">
                <Pagination
                  onPageChange={(nextPage) => {
                    const next = new URLSearchParams(searchParams);
                    next.set('tab', 'activity');
                    next.set('page', String(nextPage));
                    setSearchParams(next);
                  }}
                  page={page}
                  pageCount={Math.max(1, Math.ceil((audit.data?.total ?? 0) / 20))}
                />
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        confirmLabel="Revoke"
        description="This credential will stop working immediately."
        onConfirm={() => {
          if (!revokeTarget) {
            return;
          }
          if (revokeTarget.kind === 'secret') {
            revokeSecret.mutate(revokeTarget.id);
          } else if (revokeTarget.kind === 'key') {
            revokeKey.mutate(revokeTarget.id);
          } else {
            revokeApp.mutate(revokeTarget.id);
          }
          setRevokeTarget(undefined);
        }}
        onOpenChange={(open) => {
          if (!open) {
            setRevokeTarget(undefined);
          }
        }}
        open={Boolean(revokeTarget)}
        title="Revoke credential?"
        variant="destructive"
      />
    </WorkspacePage>
  );
}

function CreateSecretForm({
  onCreate,
}: {
  readonly onCreate: (input: { name: string; purpose: string; plaintext: string }) => void;
}) {
  const [purpose, setPurpose] = useState<(typeof SECURITY_SECRET_PURPOSES)[number]>('api_credential');

  return (
    <form
      className="grid gap-2 sm:grid-cols-3"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = event.currentTarget;
        onCreate({
          name: (form.elements.namedItem('name') as HTMLInputElement).value.trim(),
          purpose,
          plaintext: (form.elements.namedItem('plaintext') as HTMLTextAreaElement).value,
        });
        form.reset();
      }}
    >
      <Input name="name" placeholder="Name" required />
      <Select
        onValueChange={(value) => {
          if ((SECURITY_SECRET_PURPOSES as readonly string[]).includes(value)) {
            setPurpose(value as (typeof SECURITY_SECRET_PURPOSES)[number]);
          }
        }}
        options={SECURITY_SECRET_PURPOSES.map((item) => ({ value: item, label: item }))}
        searchable={false}
        value={purpose}
      />
      <div />
      <Textarea className="sm:col-span-3" name="plaintext" placeholder="Secret value" required />
      <Button className="sm:col-span-3" type="submit">
        Store secret
      </Button>
    </form>
  );
}
