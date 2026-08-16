import { type FormEvent, useMemo, useState } from 'react';
import type {
  ConnectorConnectionDto,
  ConnectorDefinitionDto,
  ConnectorHealthDto,
} from '@ai-customer-support/contracts';
import { Check, ExternalLink, HeartPulse, Plug, Shield } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { PasswordInput } from '@/features/identity/components/password-input';
import { formatDateTime } from '@/features/organizations/format';
import { useApiMutation } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { integrationsApi } from '../api';
import {
  connectionStatusLabel,
  connectionStatusVariant,
  healthStatusLabel,
  healthStatusVariant,
} from '../labels';
import {
  emptySetupForm,
  toSetupRequest,
  validateSetupCredentials,
  wizardStepsFor,
  type SetupFormErrors,
  type SetupFormValues,
  type SetupWizardStep,
} from '../validation';

const STEP_LABELS: Record<SetupWizardStep, string> = {
  review: 'Review',
  permissions: 'Permissions',
  credentials: 'Credentials',
  authorize: 'Authorize',
  health: 'Verify',
};

export function SetupWizardDialog({
  organizationId,
  definition,
  onClose,
}: {
  readonly organizationId: string;
  readonly definition: ConnectorDefinitionDto;
  readonly onClose: () => void;
}) {
  const steps = wizardStepsFor(definition);
  const [step, setStep] = useState<SetupWizardStep>('review');
  const [form, setForm] = useState<SetupFormValues>(() => emptySetupForm(definition));
  const [errors, setErrors] = useState<SetupFormErrors>({});
  const [connection, setConnection] = useState<ConnectorConnectionDto>();
  const [authorizationUrl, setAuthorizationUrl] = useState<string>();
  const [completeCode, setCompleteCode] = useState('');
  const [completeState, setCompleteState] = useState('');
  const [health, setHealth] = useState<ConnectorHealthDto>();

  const invalidate = [
    queryKeys.integrations.catalog(organizationId),
    queryKeys.integrations.connections(organizationId),
    queryKeys.tools.oauth(organizationId),
    queryKeys.tools.credentials(organizationId),
    queryKeys.tools.connectorCatalog(organizationId),
  ];

  const setup = useApiMutation({
    mutationFn: () => integrationsApi.setup(organizationId, toSetupRequest(definition, form)),
    invalidateKeys: invalidate,
    successMessage: definition.kind === 'oauth' ? 'OAuth app saved. Continue to authorize.' : 'HTTP connector saved.',
  });
  const startOAuth = useApiMutation({
    mutationFn: (connectionId: string) => integrationsApi.startOAuth(organizationId, connectionId),
    successMessage: 'Authorization URL opened',
  });
  const completeOAuth = useApiMutation({
    mutationFn: (input: { connectionId: string; code: string; state: string }) =>
      integrationsApi.completeOAuth(organizationId, input.connectionId, {
        code: input.code,
        state: input.state,
      }),
    invalidateKeys: invalidate,
    successMessage: 'OAuth connector connected',
  });
  const probe = useApiMutation({
    mutationFn: (connectionId: string) => integrationsApi.probeHealth(organizationId, connectionId),
    invalidateKeys: invalidate,
    successMessage: 'Health check finished',
  });

  const stepIndex = steps.indexOf(step);
  const percent = ((stepIndex + 1) / steps.length) * 100;

  function patch<K extends keyof SetupFormValues>(key: K, value: SetupFormValues[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function togglePermission(id: string, required: boolean): void {
    if (required) {
      return;
    }
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(id)
        ? current.permissions.filter((item) => item !== id)
        : [...current.permissions, id],
    }));
  }

  async function goNext(): Promise<void> {
    if (step === 'review') {
      setStep('permissions');
      return;
    }
    if (step === 'permissions') {
      if (definition.kind === 'http' && !form.toolName) {
        setErrors({ toolName: 'Select the HTTP tool this credential may call' });
        return;
      }
      setStep('credentials');
      return;
    }
    if (step === 'credentials') {
      const nextErrors = validateSetupCredentials(definition, form);
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) {
        return;
      }
      const result = await setup.mutateAsync();
      setConnection(result.connection);
      setStep(definition.kind === 'oauth' ? 'authorize' : 'health');
      return;
    }
    if (step === 'authorize' && connection) {
      setStep('health');
    }
  }

  async function onStartOAuth(): Promise<void> {
    if (!connection) {
      return;
    }
    const result = await startOAuth.mutateAsync(connection.id);
    setAuthorizationUrl(result.authorizationUrl);
    window.open(result.authorizationUrl, '_blank', 'noopener,noreferrer');
  }

  async function onCompleteOAuth(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!connection) {
      return;
    }
    const result = await completeOAuth.mutateAsync({
      connectionId: connection.id,
      code: completeCode.trim(),
      state: completeState.trim(),
    });
    setConnection(result.connection);
    setStep('health');
  }

  async function onProbe(): Promise<void> {
    if (!connection) {
      return;
    }
    const result = await probe.mutateAsync(connection.id);
    setConnection(result.connection);
    setHealth(result.health);
  }

  const lastStep = step === 'health';

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      open
    >
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Connect {definition.name}</DialogTitle>
          <DialogDescription>{definition.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Progress aria-label="Setup progress" value={percent} />
          <ol className="flex flex-wrap gap-2 text-xs">
            {steps.map((item, index) => (
              <li
                className={item === step ? 'font-medium text-foreground' : 'text-muted-foreground'}
                key={item}
              >
                {index + 1}. {STEP_LABELS[item]}
              </li>
            ))}
          </ol>
        </div>

        {step === 'review' ? (
          <div className="space-y-3 text-sm">
            <p>
              This connector uses {definition.authKind === 'oauth' ? 'OAuth 2.1 with PKCE' : 'an encrypted API key or bearer token'}.
              Secrets stay in the API and are never shown again.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {definition.setupSteps.map((item) => (
                <li key={item.id}>
                  <span className="font-medium text-foreground">{item.title}.</span> {item.description}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {step === 'permissions' ? (
          <div className="space-y-3">
            {definition.kind === 'http' ? (
              <Field error={errors.toolName} id="setup-tool" label="HTTP tool" required>
                <Select
                  id="setup-tool"
                  onValueChange={(value) => {
                    patch('toolName', value);
                    patch('permissions', [value]);
                  }}
                  options={definition.permissions.map((item) => ({
                    value: item.id,
                    label: item.label,
                    description: item.description,
                  }))}
                  searchable={false}
                  value={form.toolName}
                />
              </Field>
            ) : definition.permissions.length === 0 ? (
              <Field hint="One scope per line is not needed here. Add scopes as comma-separated values if the provider requires them." id="setup-custom-scopes" label="Scopes">
                <Input
                  id="setup-custom-scopes"
                  onChange={(event) => {
                    patch(
                      'permissions',
                      event.target.value
                        .split(/[\s,]+/)
                        .map((item) => item.trim())
                        .filter(Boolean),
                    );
                  }}
                  placeholder="read_orders, read_customers"
                  value={form.permissions.join(', ')}
                />
              </Field>
            ) : (
              <ul className="space-y-3">
                {definition.permissions.map((item) => {
                  const checked = form.permissions.includes(item.id) || item.required;
                  return (
                    <li className="flex items-start gap-3" key={item.id}>
                      <Checkbox
                        aria-label={item.label}
                        checked={checked}
                        disabled={item.required}
                        id={`perm-${item.id}`}
                        onCheckedChange={() => {
                          togglePermission(item.id, item.required);
                        }}
                      />
                      <div className="space-y-0.5">
                        <label className="text-sm font-medium" htmlFor={`perm-${item.id}`}>
                          {item.label}
                          {item.required ? <span className="ml-1 text-xs text-muted-foreground">(required)</span> : null}
                        </label>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}

        {step === 'credentials' ? (
          <div className="space-y-4">
            <Field error={errors.name} id="setup-name" label="Display name" required>
              <Input
                id="setup-name"
                maxLength={120}
                onChange={(event) => {
                  patch('name', event.target.value);
                }}
                value={form.name}
              />
            </Field>
            {definition.kind === 'oauth' ? (
              <>
                <Field error={errors.clientId} id="setup-client-id" label="Client id" required>
                  <Input
                    autoComplete="off"
                    id="setup-client-id"
                    onChange={(event) => {
                      patch('clientId', event.target.value);
                    }}
                    value={form.clientId}
                  />
                </Field>
                <Field error={errors.clientSecret} id="setup-client-secret" label="Client secret" required>
                  <PasswordInput
                    autoComplete="new-password"
                    id="setup-client-secret"
                    onChange={(event) => {
                      patch('clientSecret', event.target.value);
                    }}
                    spellCheck={false}
                    value={form.clientSecret}
                  />
                </Field>
                <Field error={errors.authorizationUrl} id="setup-auth-url" label="Authorization URL" required>
                  <Input
                    id="setup-auth-url"
                    onChange={(event) => {
                      patch('authorizationUrl', event.target.value);
                    }}
                    value={form.authorizationUrl}
                  />
                </Field>
                <Field error={errors.tokenUrl} id="setup-token-url" label="Token URL" required>
                  <Input
                    id="setup-token-url"
                    onChange={(event) => {
                      patch('tokenUrl', event.target.value);
                    }}
                    value={form.tokenUrl}
                  />
                </Field>
              </>
            ) : (
              <>
                <Field id="setup-kind" label="Credential kind" required>
                  <Select
                    id="setup-kind"
                    onValueChange={(value) => {
                      patch('credentialKind', value as SetupFormValues['credentialKind']);
                    }}
                    options={[
                      { value: 'bearer', label: 'Bearer token' },
                      { value: 'api_key', label: 'API key' },
                    ]}
                    searchable={false}
                    value={form.credentialKind}
                  />
                </Field>
                <Field error={errors.secret} id="setup-secret" label="Secret" required>
                  <PasswordInput
                    autoComplete="new-password"
                    id="setup-secret"
                    onChange={(event) => {
                      patch('secret', event.target.value);
                    }}
                    spellCheck={false}
                    value={form.secret}
                  />
                </Field>
                <Field error={errors.baseUrl} id="setup-base-url" label="HTTPS base URL" required>
                  <Input
                    id="setup-base-url"
                    onChange={(event) => {
                      patch('baseUrl', event.target.value);
                    }}
                    placeholder="https://api.example.com"
                    value={form.baseUrl}
                  />
                </Field>
                <Field id="setup-header" label="Header name">
                  <Input
                    id="setup-header"
                    onChange={(event) => {
                      patch('headerName', event.target.value);
                    }}
                    value={form.headerName}
                  />
                </Field>
              </>
            )}
          </div>
        ) : null}

        {step === 'authorize' && connection ? (
          <form className="space-y-4" onSubmit={(event) => void onCompleteOAuth(event)}>
            <Alert variant="info">
              <AlertTitle>PKCE authorization code</AlertTitle>
              <AlertDescription>
                Open the provider, then paste the <code>code</code> and <code>state</code> from the callback URL.
              </AlertDescription>
            </Alert>
            <Button disabled={startOAuth.isPending} onClick={() => void onStartOAuth()} type="button">
              {startOAuth.isPending ? <Spinner label="Starting OAuth" /> : <ExternalLink className="size-4" />}
              Open provider
            </Button>
            {authorizationUrl ? (
              <p className="break-all text-xs text-muted-foreground">{authorizationUrl}</p>
            ) : null}
            <Field id="setup-code" label="Authorization code" required>
              <Input
                id="setup-code"
                onChange={(event) => {
                  setCompleteCode(event.target.value);
                }}
                value={completeCode}
              />
            </Field>
            <Field id="setup-state" label="State" required>
              <Input
                id="setup-state"
                onChange={(event) => {
                  setCompleteState(event.target.value);
                }}
                value={completeState}
              />
            </Field>
            <Button
              disabled={completeOAuth.isPending || completeCode.trim().length === 0 || completeState.trim().length === 0}
              type="submit"
            >
              {completeOAuth.isPending ? <Spinner label="Completing OAuth" /> : <Plug className="size-4" />}
              Complete OAuth
            </Button>
          </form>
        ) : null}

        {step === 'health' && connection ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={connectionStatusVariant(connection.status)}>
                {connectionStatusLabel(connection.status)}
              </Badge>
              <Badge variant={healthStatusVariant((health ?? connection.health).status)}>
                {healthStatusLabel((health ?? connection.health).status)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{(health ?? connection.health).message}</p>
            <Button disabled={probe.isPending} onClick={() => void onProbe()} type="button" variant="outline">
              {probe.isPending ? <Spinner label="Checking health" /> : <HeartPulse className="size-4" />}
              Check connection health
            </Button>
          </div>
        ) : null}

        <DialogFooter>
          <Button onClick={onClose} type="button" variant="outline">
            {lastStep ? 'Done' : 'Cancel'}
          </Button>
          {!lastStep && step !== 'authorize' ? (
            <Button disabled={setup.isPending} onClick={() => void goNext()} type="button">
              {setup.isPending ? <Spinner label="Saving connector" /> : null}
              {step === 'credentials' ? 'Save and continue' : 'Continue'}
            </Button>
          ) : null}
          {step === 'authorize' ? (
            <Button
              disabled={!connection || connection.status !== 'connected'}
              onClick={() => {
                setStep('health');
              }}
              type="button"
            >
              {connection?.status === 'connected' ? <Check className="size-4" /> : <Shield className="size-4" />}
              Continue
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ConnectionDetailDialog({
  organizationId,
  connection,
  definition,
  onClose,
}: {
  readonly organizationId: string;
  readonly connection: ConnectorConnectionDto;
  readonly definition?: ConnectorDefinitionDto;
  readonly onClose: () => void;
}) {
  const [current, setCurrent] = useState(connection);
  const [permissions, setPermissions] = useState<string[]>([...connection.permissions]);
  const [completeCode, setCompleteCode] = useState('');
  const [completeState, setCompleteState] = useState('');
  const [pendingDisconnect, setPendingDisconnect] = useState(false);

  const invalidate = useMemo(
    () => [
      queryKeys.integrations.connections(organizationId),
      queryKeys.integrations.connection(organizationId, connection.id),
      queryKeys.tools.oauth(organizationId),
      queryKeys.tools.credentials(organizationId),
    ],
    [connection.id, organizationId],
  );

  const startOAuth = useApiMutation({
    mutationFn: () => integrationsApi.startOAuth(organizationId, current.id),
    successMessage: 'Authorization URL opened',
  });
  const completeOAuth = useApiMutation({
    mutationFn: (body: { code: string; state: string }) =>
      integrationsApi.completeOAuth(organizationId, current.id, body),
    invalidateKeys: invalidate,
    successMessage: 'OAuth connector connected',
  });
  const probe = useApiMutation({
    mutationFn: () => integrationsApi.probeHealth(organizationId, current.id),
    invalidateKeys: invalidate,
    successMessage: 'Health check finished',
  });
  const savePermissions = useApiMutation({
    mutationFn: () => integrationsApi.updatePermissions(organizationId, current.id, { permissions }),
    invalidateKeys: invalidate,
    successMessage: 'Permissions updated',
  });
  const disconnect = useApiMutation({
    mutationFn: () => integrationsApi.disconnect(organizationId, current.id),
    invalidateKeys: invalidate,
    successMessage: 'Connector disconnected',
  });

  async function onStart(): Promise<void> {
    const result = await startOAuth.mutateAsync();
    window.open(result.authorizationUrl, '_blank', 'noopener,noreferrer');
  }

  async function onComplete(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const result = await completeOAuth.mutateAsync({
      code: completeCode.trim(),
      state: completeState.trim(),
    });
    setCurrent(result.connection);
    setCompleteCode('');
    setCompleteState('');
  }

  async function onProbe(): Promise<void> {
    const result = await probe.mutateAsync();
    setCurrent(result.connection);
  }

  async function onSavePermissions(): Promise<void> {
    const result = await savePermissions.mutateAsync();
    setCurrent(result.connection);
    setPermissions([...result.connection.permissions]);
  }

  async function onDisconnect(): Promise<void> {
    await disconnect.mutateAsync();
    onClose();
  }

  const catalogPermissions = definition?.permissions ?? [];

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      open
    >
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{current.name}</DialogTitle>
          <DialogDescription>
            {definition?.description ?? `${current.provider} ${current.kind} connector`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Badge variant={connectionStatusVariant(current.status)}>{connectionStatusLabel(current.status)}</Badge>
          <Badge variant={healthStatusVariant(current.health.status)}>{healthStatusLabel(current.health.status)}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{current.health.message}</p>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Updated</dt>
            <dd className="mt-1">{formatDateTime(current.updatedAt)}</dd>
          </div>
          {current.tokenExpiresAt ? (
            <div>
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Token expires</dt>
              <dd className="mt-1">{formatDateTime(current.tokenExpiresAt)}</dd>
            </div>
          ) : null}
          {current.externalAccountId ? (
            <div>
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">External account</dt>
              <dd className="mt-1 break-all">{current.externalAccountId}</dd>
            </div>
          ) : null}
          {current.toolName ? (
            <div>
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Tool</dt>
              <dd className="mt-1">
                <code className="text-xs">{current.toolName}</code>
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="space-y-3">
          <h3 className="text-sm font-medium">Permissions</h3>
          {current.kind === 'http' ? (
            <p className="text-sm text-muted-foreground">
              HTTP connectors are bound to <code>{current.toolName}</code>. Create another connector to grant a
              different tool.
            </p>
          ) : catalogPermissions.length > 0 ? (
            <ul className="space-y-2">
              {catalogPermissions.map((item) => (
                <li className="flex items-start gap-3" key={item.id}>
                  <Checkbox
                    checked={permissions.includes(item.id) || item.required}
                    disabled={item.required || current.status === 'disconnected'}
                    id={`edit-perm-${item.id}`}
                    onCheckedChange={(value) => {
                      setPermissions((currentPermissions) =>
                        value === true
                          ? [...new Set([...currentPermissions, item.id])]
                          : currentPermissions.filter((permission) => permission !== item.id),
                      );
                    }}
                  />
                  <label className="text-sm" htmlFor={`edit-perm-${item.id}`}>
                    {item.label}
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <Field hint="Comma-separated scopes." id="edit-scopes" label="Granted scopes">
              <Input
                id="edit-scopes"
                onChange={(event) => {
                  setPermissions(
                    event.target.value
                      .split(/[\s,]+/)
                      .map((item) => item.trim())
                      .filter(Boolean),
                  );
                }}
                value={permissions.join(', ')}
              />
            </Field>
          )}
          {current.kind === 'oauth' && current.status !== 'disconnected' ? (
            <Button disabled={savePermissions.isPending} onClick={() => void onSavePermissions()} type="button" variant="outline">
              {savePermissions.isPending ? <Spinner label="Saving permissions" /> : null}
              Save permissions
            </Button>
          ) : null}
        </div>

        {current.kind === 'oauth' && current.status !== 'disconnected' ? (
          <form className="space-y-3" onSubmit={(event) => void onComplete(event)}>
            <h3 className="text-sm font-medium">OAuth</h3>
            <div className="flex flex-wrap gap-2">
              <Button disabled={startOAuth.isPending} onClick={() => void onStart()} type="button">
                {startOAuth.isPending ? <Spinner label="Starting OAuth" /> : null}
                Connect
              </Button>
            </div>
            <Field id="manage-code" label="Authorization code">
              <Input
                id="manage-code"
                onChange={(event) => {
                  setCompleteCode(event.target.value);
                }}
                value={completeCode}
              />
            </Field>
            <Field id="manage-state" label="State">
              <Input
                id="manage-state"
                onChange={(event) => {
                  setCompleteState(event.target.value);
                }}
                value={completeState}
              />
            </Field>
            <Button
              disabled={completeOAuth.isPending || completeCode.trim().length === 0 || completeState.trim().length === 0}
              type="submit"
              variant="outline"
            >
              {completeOAuth.isPending ? <Spinner label="Completing OAuth" /> : null}
              Complete OAuth
            </Button>
          </form>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button disabled={probe.isPending || current.status === 'disconnected'} onClick={() => void onProbe()} type="button" variant="outline">
            {probe.isPending ? <Spinner label="Checking health" /> : <HeartPulse className="size-4" />}
            Check health
          </Button>
          {current.status !== 'disconnected' ? (
            pendingDisconnect ? (
              <>
                <Button disabled={disconnect.isPending} onClick={() => void onDisconnect()} type="button" variant="destructive">
                  {disconnect.isPending ? <Spinner label="Disconnecting" /> : null}
                  Confirm disconnect
                </Button>
                <Button
                  onClick={() => {
                    setPendingDisconnect(false);
                  }}
                  type="button"
                  variant="outline"
                >
                  Keep connected
                </Button>
              </>
            ) : (
              <Button
                onClick={() => {
                  setPendingDisconnect(true);
                }}
                type="button"
                variant="destructive"
              >
                Disconnect
              </Button>
            )
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
