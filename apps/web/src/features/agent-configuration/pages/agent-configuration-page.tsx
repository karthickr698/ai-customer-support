import { type FormEvent, useEffect, useState } from 'react';
import type {
  AiAgentCitationPolicy,
  AiAgentConfigurationDto,
  AiAgentConfigurationResponse,
  AiAgentFallbackMode,
  AiAgentModelId,
  ToolName,
  UpdateAiAgentConfigurationRequest,
} from '@ai-customer-support/contracts';
import {
  AI_AGENT_CITATION_POLICIES,
  AI_AGENT_FALLBACK_MODES,
  AI_AGENT_MODELS,
  DEFAULT_AI_AGENT_ENABLED_TOOLS,
} from '@ai-customer-support/contracts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { WorkspacePage } from '@/features/organizations/components/workspace-page';
import { hasPermission } from '@/features/organizations/permissions';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { agentConfigurationApi } from '../api';
import {
  citationPolicyLabel,
  fallbackModeDescription,
  fallbackModeLabel,
  modelDescription,
  modelLabel,
  toolDescription,
  toolLabel,
} from '../labels';

type FormValues = {
  model: AiAgentModelId;
  qualityModel: AiAgentModelId;
  temperature: string;
  maxOutputTokens: string;
  maxInputTokens: string;
  systemPrompt: string;
  enabledTools: ToolName[];
  fallbackMode: AiAgentFallbackMode;
  fallbackReply: string;
  fallbackMaxRetries: string;
  citationPolicy: AiAgentCitationPolicy;
  refuseUnknown: boolean;
  refuseOffTopic: boolean;
  languageLock: boolean;
  redactPii: boolean;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

const emptyForm: FormValues = {
  model: 'gpt-4o-mini',
  qualityModel: 'gpt-4o',
  temperature: '0.3',
  maxOutputTokens: '1024',
  maxInputTokens: '8000',
  systemPrompt: '',
  enabledTools: [...DEFAULT_AI_AGENT_ENABLED_TOOLS],
  fallbackMode: 'provider_then_heuristic',
  fallbackReply: "I'm having trouble answering right now. I can connect you with a teammate who can help.",
  fallbackMaxRetries: '3',
  citationPolicy: 'preferred',
  refuseUnknown: true,
  refuseOffTopic: true,
  languageLock: true,
  redactPii: false,
};

function toForm(configuration: AiAgentConfigurationDto): FormValues {
  return {
    model: configuration.model,
    qualityModel: configuration.qualityModel,
    temperature: String(configuration.temperature),
    maxOutputTokens: String(configuration.maxOutputTokens),
    maxInputTokens: String(configuration.maxInputTokens),
    systemPrompt: configuration.systemPrompt,
    enabledTools: [...configuration.enabledTools],
    fallbackMode: configuration.fallbackMode,
    fallbackReply: configuration.fallbackReply ?? '',
    fallbackMaxRetries: String(configuration.fallbackMaxRetries),
    citationPolicy: configuration.citationPolicy,
    refuseUnknown: configuration.refuseUnknown,
    refuseOffTopic: configuration.refuseOffTopic,
    languageLock: configuration.languageLock,
    redactPii: configuration.redactPii,
  };
}

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  const temperature = Number.parseFloat(values.temperature);
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
    errors.temperature = 'Temperature must be between 0 and 2';
  }
  const output = Number.parseInt(values.maxOutputTokens, 10);
  if (!Number.isInteger(output) || output < 64 || output > 4096) {
    errors.maxOutputTokens = 'Output tokens must be between 64 and 4096';
  }
  const input = Number.parseInt(values.maxInputTokens, 10);
  if (!Number.isInteger(input) || input < 512 || input > 32_000) {
    errors.maxInputTokens = 'Input tokens must be between 512 and 32000';
  }
  const retries = Number.parseInt(values.fallbackMaxRetries, 10);
  if (!Number.isInteger(retries) || retries < 1 || retries > 5) {
    errors.fallbackMaxRetries = 'Retries must be between 1 and 5';
  }
  if (values.systemPrompt.length > 8000) {
    errors.systemPrompt = 'Prompt must be at most 8000 characters';
  }
  if (values.fallbackReply.length > 500) {
    errors.fallbackReply = 'Fallback reply must be at most 500 characters';
  }
  return errors;
}

export function AgentConfigurationPage() {
  const { organizationId, permissions } = useWorkspace();
  const canUpdate = hasPermission(permissions, 'organization.update');
  const [values, setValues] = useState<FormValues>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});

  const query = useApiQuery<AiAgentConfigurationResponse>({
    queryKey: queryKeys.agentConfiguration.detail(organizationId),
    path: `/api/organizations/${organizationId}/ai-agent`,
  });

  useEffect(() => {
    if (query.data?.configuration) {
      setValues(toForm(query.data.configuration));
    }
  }, [query.data?.configuration]);

  const save = useApiMutation({
    mutationFn: (body: UpdateAiAgentConfigurationRequest) =>
      agentConfigurationApi.update(organizationId, body),
    invalidateKeys: [queryKeys.agentConfiguration.detail(organizationId)],
    successMessage: 'AI agent configuration saved',
  });

  function patch<K extends keyof FormValues>(key: K, value: FormValues[K]): void {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function toggleTool(name: ToolName, checked: boolean): void {
    setValues((current) => ({
      ...current,
      enabledTools: checked
        ? [...current.enabledTools, name]
        : current.enabledTools.filter((item) => item !== name),
    }));
  }

  async function onSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    await save.mutateAsync({
      model: values.model,
      qualityModel: values.qualityModel,
      temperature: Number.parseFloat(values.temperature),
      maxOutputTokens: Number.parseInt(values.maxOutputTokens, 10),
      maxInputTokens: Number.parseInt(values.maxInputTokens, 10),
      systemPrompt: values.systemPrompt,
      enabledTools: values.enabledTools,
      fallbackMode: values.fallbackMode,
      fallbackReply: values.fallbackReply.trim().length > 0 ? values.fallbackReply.trim() : null,
      fallbackMaxRetries: Number.parseInt(values.fallbackMaxRetries, 10),
      citationPolicy: values.citationPolicy,
      refuseUnknown: values.refuseUnknown,
      refuseOffTopic: values.refuseOffTopic,
      languageLock: values.languageLock,
      redactPii: values.redactPii,
    });
  }

  return (
    <WorkspacePage wide>
      <PageHeader
        description="Model, prompt, generation limits, tools, fallback, and response policies for this workspace AI agent. Python applies these settings when generating replies."
        title="AI agent"
      />

      {query.isPending ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner label="Loading AI agent configuration" />
          Loading AI agent configuration…
        </div>
      ) : null}

      {query.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load AI agent configuration</AlertTitle>
          <AlertDescription>{query.error.message}</AlertDescription>
        </Alert>
      ) : null}

      {query.data ? (
        <form className="space-y-6" noValidate onSubmit={(event) => void onSave(event)}>
          <Card>
            <CardHeader>
              <CardTitle>Model</CardTitle>
              <CardDescription>
                Fast model for everyday turns. Quality model is used for complaints and long messages.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field id="ai-model" label="Primary model" required>
                <Select
                  disabled={!canUpdate}
                  id="ai-model"
                  onValueChange={(value) => {
                    patch('model', value as AiAgentModelId);
                  }}
                  options={AI_AGENT_MODELS.map((model) => ({
                    value: model,
                    label: modelLabel(model),
                    description: modelDescription(model),
                  }))}
                  searchable={false}
                  value={values.model}
                />
              </Field>
              <Field id="ai-quality-model" label="Quality model" required>
                <Select
                  disabled={!canUpdate}
                  id="ai-quality-model"
                  onValueChange={(value) => {
                    patch('qualityModel', value as AiAgentModelId);
                  }}
                  options={AI_AGENT_MODELS.map((model) => ({
                    value: model,
                    label: modelLabel(model),
                    description: modelDescription(model),
                  }))}
                  searchable={false}
                  value={values.qualityModel}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Prompt</CardTitle>
              <CardDescription>
                Operator instructions appended to the onboarding persona. Leave blank to use only AI setup
                instructions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Field error={errors.systemPrompt} id="ai-prompt" label="System prompt">
                <Textarea
                  disabled={!canUpdate}
                  id="ai-prompt"
                  maxLength={8000}
                  onChange={(event) => {
                    patch('systemPrompt', event.target.value);
                  }}
                  rows={8}
                  value={values.systemPrompt}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Temperature and token limits</CardTitle>
              <CardDescription>
                Temperature overrides intent routing. Output tokens cap the model completion.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <Field
                error={errors.temperature}
                hint="0 is deterministic. 2 is highly varied."
                id="ai-temperature"
                label="Temperature"
                required
              >
                <Input
                  disabled={!canUpdate}
                  id="ai-temperature"
                  max={2}
                  min={0}
                  onChange={(event) => {
                    patch('temperature', event.target.value);
                  }}
                  step="0.1"
                  type="number"
                  value={values.temperature}
                />
              </Field>
              <Field error={errors.maxOutputTokens} id="ai-output-tokens" label="Max output tokens" required>
                <Input
                  disabled={!canUpdate}
                  id="ai-output-tokens"
                  max={4096}
                  min={64}
                  onChange={(event) => {
                    patch('maxOutputTokens', event.target.value);
                  }}
                  type="number"
                  value={values.maxOutputTokens}
                />
              </Field>
              <Field error={errors.maxInputTokens} id="ai-input-tokens" label="Max input tokens" required>
                <Input
                  disabled={!canUpdate}
                  id="ai-input-tokens"
                  max={32000}
                  min={512}
                  onChange={(event) => {
                    patch('maxInputTokens', event.target.value);
                  }}
                  type="number"
                  value={values.maxInputTokens}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tools</CardTitle>
              <CardDescription>
                Allowlisted tools the model may propose. TypeScript still authorizes and executes each call.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {DEFAULT_AI_AGENT_ENABLED_TOOLS.map((name) => {
                const id = `ai-tool-${name}`;
                const checked = values.enabledTools.includes(name);
                return (
                  <label
                    className="flex items-start gap-3 rounded-lg border border-border px-3 py-2"
                    htmlFor={id}
                    key={name}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={!canUpdate}
                      id={id}
                      onCheckedChange={(next) => {
                        toggleTool(name, next === true);
                      }}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{toolLabel(name)}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                        {toolDescription(name)}
                      </span>
                    </span>
                  </label>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fallback behavior</CardTitle>
              <CardDescription>What happens when the primary model is unavailable or times out.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup
                disabled={!canUpdate}
                onValueChange={(value) => {
                  patch('fallbackMode', value as AiAgentFallbackMode);
                }}
                value={values.fallbackMode}
              >
                {AI_AGENT_FALLBACK_MODES.map((mode) => (
                  <div className="flex items-start gap-3 rounded-lg border border-border px-3 py-2" key={mode}>
                    <RadioGroupItem id={`ai-fallback-${mode}`} value={mode} />
                    <div className="min-w-0">
                      <Label htmlFor={`ai-fallback-${mode}`}>{fallbackModeLabel(mode)}</Label>
                      <p className="text-xs leading-5 text-muted-foreground">{fallbackModeDescription(mode)}</p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field error={errors.fallbackMaxRetries} id="ai-retries" label="Max retries">
                  <Input
                    disabled={!canUpdate}
                    id="ai-retries"
                    max={5}
                    min={1}
                    onChange={(event) => {
                      patch('fallbackMaxRetries', event.target.value);
                    }}
                    type="number"
                    value={values.fallbackMaxRetries}
                  />
                </Field>
                <Field error={errors.fallbackReply} id="ai-fallback-reply" label="Canned fallback reply">
                  <Textarea
                    disabled={!canUpdate}
                    id="ai-fallback-reply"
                    maxLength={500}
                    onChange={(event) => {
                      patch('fallbackReply', event.target.value);
                    }}
                    rows={3}
                    value={values.fallbackReply}
                  />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Response policies</CardTitle>
              <CardDescription>Guard how the agent answers when knowledge is missing or off-topic.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field id="ai-citations" label="Citations">
                <Select
                  disabled={!canUpdate}
                  id="ai-citations"
                  onValueChange={(value) => {
                    patch('citationPolicy', value as AiAgentCitationPolicy);
                  }}
                  options={AI_AGENT_CITATION_POLICIES.map((policy) => ({
                    value: policy,
                    label: citationPolicyLabel(policy),
                  }))}
                  searchable={false}
                  value={values.citationPolicy}
                />
              </Field>
              <div className="grid gap-3">
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <div>
                    <Label htmlFor="ai-refuse-unknown">Refuse when unknown</Label>
                    <p className="text-xs text-muted-foreground">Do not invent answers when knowledge is missing.</p>
                  </div>
                  <Switch
                    checked={values.refuseUnknown}
                    disabled={!canUpdate}
                    id="ai-refuse-unknown"
                    onCheckedChange={(checked) => {
                      patch('refuseUnknown', checked);
                    }}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <div>
                    <Label htmlFor="ai-refuse-off-topic">Refuse off-topic requests</Label>
                    <p className="text-xs text-muted-foreground">Stay on allowed support topics.</p>
                  </div>
                  <Switch
                    checked={values.refuseOffTopic}
                    disabled={!canUpdate}
                    id="ai-refuse-off-topic"
                    onCheckedChange={(checked) => {
                      patch('refuseOffTopic', checked);
                    }}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <div>
                    <Label htmlFor="ai-language-lock">Lock reply language</Label>
                    <p className="text-xs text-muted-foreground">Reply only in the onboarding language.</p>
                  </div>
                  <Switch
                    checked={values.languageLock}
                    disabled={!canUpdate}
                    id="ai-language-lock"
                    onCheckedChange={(checked) => {
                      patch('languageLock', checked);
                    }}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <div>
                    <Label htmlFor="ai-redact-pii">Redact personal identifiers</Label>
                    <p className="text-xs text-muted-foreground">Strip emails and phone numbers from replies.</p>
                  </div>
                  <Switch
                    checked={values.redactPii}
                    disabled={!canUpdate}
                    id="ai-redact-pii"
                    onCheckedChange={(checked) => {
                      patch('redactPii', checked);
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {canUpdate ? (
            <Button disabled={save.isPending} type="submit">
              {save.isPending ? (
                <>
                  <Spinner label="Saving AI agent configuration" />
                  Saving…
                </>
              ) : (
                'Save configuration'
              )}
            </Button>
          ) : (
            <Alert>
              <AlertTitle>View only</AlertTitle>
              <AlertDescription>You need organization.update to change AI agent settings.</AlertDescription>
            </Alert>
          )}
        </form>
      ) : null}
    </WorkspacePage>
  );
}
