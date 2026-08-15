import { type FormEvent, useEffect, useMemo, useState } from 'react';
import type { UpdateWidgetConfigurationRequest, WidgetConfigurationResponse } from '@ai-customer-support/contracts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/features/organizations/components/confirm-dialog';
import { WorkspacePage } from '@/features/organizations/components/workspace-page';
import { hasPermission } from '@/features/organizations/permissions';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { env } from '@/utils/env';
import { widgetApi } from '../api';
import { WidgetPreview } from '../components/widget-preview';
import {
  parseOrigins,
  validateWidgetForm,
  widgetToForm,
  type WidgetFormErrors,
  type WidgetFormValues,
} from '../validation';

const emptyForm: WidgetFormValues = {
  enabled: true,
  title: 'Chat with us',
  greeting: 'Hi — how can we help today?',
  primaryColor: '#2563eb',
  position: 'right',
  launcherText: 'Help',
  collectEmail: true,
  allowAnonymous: true,
  allowAttachments: true,
  aiEnabled: true,
  offlineMessage: 'We are away right now. Leave a message and we will get back to you.',
  allowedOriginsText: '',
};

export function WidgetSettingsPage() {
  const { organizationId, permissions } = useWorkspace();
  const canUpdate = hasPermission(permissions, 'organization.update');
  const [values, setValues] = useState<WidgetFormValues>(emptyForm);
  const [errors, setErrors] = useState<WidgetFormErrors>({});
  const [copied, setCopied] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);

  const widgetQuery = useApiQuery<WidgetConfigurationResponse>({
    queryKey: queryKeys.widget.detail(organizationId),
    path: `/api/organizations/${organizationId}/widget`,
  });

  useEffect(() => {
    if (widgetQuery.data?.widget) {
      setValues(widgetToForm(widgetQuery.data.widget));
    }
  }, [widgetQuery.data?.widget]);

  const save = useApiMutation({
    mutationFn: (body: UpdateWidgetConfigurationRequest) => widgetApi.update(organizationId, body),
    invalidateKeys: [queryKeys.widget.detail(organizationId)],
    successMessage: 'Widget settings saved',
  });
  const rotate = useApiMutation({
    mutationFn: () => widgetApi.rotateKey(organizationId),
    invalidateKeys: [queryKeys.widget.detail(organizationId)],
    successMessage: 'Public embed key rotated',
  });

  const snippet = useMemo(() => {
    const publicKey = widgetQuery.data?.widget.publicKey ?? 'wk_your_public_key';
    const widgetOrigin = env.widgetOrigin || window.location.origin;
    const publicApiUrl = env.publicApiUrl || env.apiBaseUrl || window.location.origin;
    return `<script src="${widgetOrigin}/widget.js" data-public-key="${publicKey}" data-api-base="${publicApiUrl}" async></script>`;
  }, [widgetQuery.data?.widget.publicKey]);

  async function onSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const nextErrors = validateWidgetForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    await save.mutateAsync({
      enabled: values.enabled,
      title: values.title.trim(),
      greeting: values.greeting.trim(),
      primaryColor: values.primaryColor.trim(),
      position: values.position,
      launcherText: values.launcherText.trim(),
      collectEmail: values.collectEmail,
      allowAnonymous: values.allowAnonymous,
      allowAttachments: values.allowAttachments,
      aiEnabled: values.aiEnabled,
      offlineMessage: values.offlineMessage.trim(),
      allowedOrigins: parseOrigins(values.allowedOriginsText),
    });
  }

  async function copySnippet(): Promise<void> {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    window.setTimeout(() => {
      setCopied(false);
    }, 2000);
  }

  function patch<K extends keyof WidgetFormValues>(key: K, value: WidgetFormValues[K]): void {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  return (
    <WorkspacePage wide>
      <PageHeader
        description="Theme, embed snippet, and visitor options for the public chat widget. The widget talks only to this workspace API."
        title="Chat widget"
      />

      {widgetQuery.isPending ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner label="Loading widget settings" />
          Loading widget settings…
        </div>
      ) : null}

      {widgetQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load widget settings</AlertTitle>
          <AlertDescription>{widgetQuery.error.message}</AlertDescription>
        </Alert>
      ) : null}

      {widgetQuery.data ? (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <form className="space-y-6" noValidate onSubmit={(event) => void onSave(event)}>
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Colors and copy used by the embeddable launcher and chat panel.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2">
                  <div>
                    <Label htmlFor="widget-enabled">Widget enabled</Label>
                    <p className="text-xs text-muted-foreground">When off, visitors see the offline message.</p>
                  </div>
                  <Switch
                    checked={values.enabled}
                    disabled={!canUpdate}
                    id="widget-enabled"
                    onCheckedChange={(checked) => {
                      patch('enabled', checked);
                    }}
                  />
                </div>
                <Field error={errors.title} id="widget-title" label="Title" required>
                  <Input
                    disabled={!canUpdate}
                    id="widget-title"
                    onChange={(event) => {
                      patch('title', event.target.value);
                    }}
                    value={values.title}
                  />
                </Field>
                <Field error={errors.greeting} id="widget-greeting" label="Greeting" required>
                  <Textarea
                    disabled={!canUpdate}
                    id="widget-greeting"
                    onChange={(event) => {
                      patch('greeting', event.target.value);
                    }}
                    value={values.greeting}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field error={errors.primaryColor} id="widget-color" label="Primary color" required>
                    <div className="flex gap-2">
                      <Input
                        aria-label="Color picker"
                        className="h-9 w-12 cursor-pointer p-1"
                        disabled={!canUpdate}
                        onChange={(event) => {
                          patch('primaryColor', event.target.value);
                        }}
                        type="color"
                        value={safeColor(values.primaryColor)}
                      />
                      <Input
                        disabled={!canUpdate}
                        id="widget-color"
                        onChange={(event) => {
                          patch('primaryColor', event.target.value);
                        }}
                        value={values.primaryColor}
                      />
                    </div>
                  </Field>
                  <Field id="widget-position" label="Launcher position">
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                      disabled={!canUpdate}
                      id="widget-position"
                      onChange={(event) => {
                        patch('position', event.target.value === 'left' ? 'left' : 'right');
                      }}
                      value={values.position}
                    >
                      <option value="right">Bottom right</option>
                      <option value="left">Bottom left</option>
                    </select>
                  </Field>
                </div>
                <Field error={errors.launcherText} id="widget-launcher" label="Launcher label" required>
                  <Input
                    disabled={!canUpdate}
                    id="widget-launcher"
                    onChange={(event) => {
                      patch('launcherText', event.target.value);
                    }}
                    value={values.launcherText}
                  />
                </Field>
                <Field error={errors.offlineMessage} id="widget-offline" label="Offline message" required>
                  <Textarea
                    disabled={!canUpdate}
                    id="widget-offline"
                    onChange={(event) => {
                      patch('offlineMessage', event.target.value);
                    }}
                    value={values.offlineMessage}
                  />
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Visitor options</CardTitle>
                <CardDescription>Control identity collection, files, and AI replies in the widget.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <ToggleRow
                  checked={values.collectEmail}
                  description="Show a name and email prompt before or during chat."
                  disabled={!canUpdate}
                  id="widget-collect-email"
                  label="Collect email"
                  onCheckedChange={(checked) => {
                    patch('collectEmail', checked);
                  }}
                />
                <ToggleRow
                  checked={values.allowAnonymous}
                  description="Allow chats without contact details."
                  disabled={!canUpdate}
                  error={errors.allowAnonymous}
                  id="widget-anonymous"
                  label="Allow anonymous visitors"
                  onCheckedChange={(checked) => {
                    patch('allowAnonymous', checked);
                  }}
                />
                <ToggleRow
                  checked={values.allowAttachments}
                  description="PNG, JPEG, WebP, GIF, PDF, or text. 5MB each."
                  disabled={!canUpdate}
                  id="widget-attachments"
                  label="Allow attachments"
                  onCheckedChange={(checked) => {
                    patch('allowAttachments', checked);
                  }}
                />
                <ToggleRow
                  checked={values.aiEnabled}
                  description="Stream assistant replies after each visitor message."
                  disabled={!canUpdate}
                  id="widget-ai"
                  label="AI replies"
                  onCheckedChange={(checked) => {
                    patch('aiEnabled', checked);
                  }}
                />
                <Field
                  error={errors.allowedOriginsText}
                  hint="One origin per line, such as https://example.com. Leave empty to allow any origin during setup."
                  id="widget-origins"
                  label="Allowed origins"
                >
                  <Textarea
                    disabled={!canUpdate}
                    id="widget-origins"
                    onChange={(event) => {
                      patch('allowedOriginsText', event.target.value);
                    }}
                    rows={4}
                    value={values.allowedOriginsText}
                  />
                </Field>
              </CardContent>
            </Card>

            {canUpdate ? (
              <Button disabled={save.isPending} type="submit">
                {save.isPending ? (
                  <>
                    <Spinner label="Saving widget" />
                    Saving…
                  </>
                ) : (
                  'Save widget'
                )}
              </Button>
            ) : (
              <Alert variant="warning">
                <AlertTitle>Read only</AlertTitle>
                <AlertDescription>Owners and admins can change widget settings.</AlertDescription>
              </Alert>
            )}
          </form>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Live preview</CardTitle>
                <CardDescription>Updates as you edit. Publish with Save widget.</CardDescription>
              </CardHeader>
              <CardContent>
                <WidgetPreview values={values} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Embed snippet</CardTitle>
                <CardDescription>Add this script to any site allowed by origin policy.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs leading-5">{snippet}</pre>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void copySnippet()} type="button" variant="outline">
                    {copied ? 'Copied' : 'Copy snippet'}
                  </Button>
                  {canUpdate ? (
                    <Button
                      onClick={() => {
                        setRotateOpen(true);
                      }}
                      type="button"
                      variant="secondary"
                    >
                      Rotate public key
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  Public key {widgetQuery.data.widget.publicKey}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        confirmLabel="Rotate key"
        description="Existing embed snippets stop working until they use the new public key. Active visitor sessions stay valid."
        onConfirm={() => {
          rotate.mutate();
        }}
        onOpenChange={setRotateOpen}
        open={rotateOpen}
        pending={rotate.isPending}
        title="Rotate the widget public key?"
      />
    </WorkspacePage>
  );
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  disabled,
  error,
  onCheckedChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly error?: string;
  readonly onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border px-3 py-2">
      <div>
        <Label htmlFor={id}>{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
        {error ? (
          <p className="mt-1 text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <Switch checked={checked} disabled={disabled} id={id} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function safeColor(value: string): string {
  return /^#(?:[0-9a-fA-F]{6})$/.test(value) ? value : '#2563eb';
}
