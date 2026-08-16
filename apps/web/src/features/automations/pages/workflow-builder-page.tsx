import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type {
  AutomationActionConfigDto,
  AutomationActionType,
  AutomationConditionDto,
  AutomationConditionOperator,
  AutomationMatchMode,
  AutomationRuleResponse,
  AutomationSourceEvent,
  AutomationTriggerType,
  CreateAutomationRuleRequest,
} from '@ai-customer-support/contracts';
import { AUTOMATION_HTTP_METHODS, AUTOMATION_SOURCE_EVENTS } from '@ai-customer-support/contracts';
import { Play, Plus, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { QueryErrorAlert } from '@/components/ui/query-error';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/features/organizations/components/confirm-dialog';
import { hasPermission } from '@/features/organizations/permissions';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { automationsApi } from '../api';
import { ACTION_OPTIONS, EVENT_OPTIONS, OPERATOR_OPTIONS, automationsPath } from '../labels';

type Draft = {
  name: string;
  description: string;
  enabled: boolean;
  triggerType: AutomationTriggerType;
  eventName: AutomationSourceEvent | '';
  schedule: string;
  match: AutomationMatchMode;
  conditions: AutomationConditionDto[];
  actionType: AutomationActionType;
  actionMessage: string;
  actionUrl: string;
  actionMethod: string;
  actionBody: string;
  maxAttempts: string;
};

const EMPTY_DRAFT: Draft = {
  name: '',
  description: '',
  enabled: true,
  triggerType: 'event',
  eventName: 'TicketCreated',
  schedule: '0 * * * *',
  match: 'all',
  conditions: [],
  actionType: 'record',
  actionMessage: 'Workflow recorded',
  actionUrl: '',
  actionMethod: 'POST',
  actionBody: '{}',
  maxAttempts: '3',
};

export function WorkflowBuilderPage() {
  const { organizationId, permissions } = useWorkspace();
  const { ruleId } = useParams();
  const navigate = useNavigate();
  const canManage = hasPermission(permissions, 'automation.manage');
  const isNew = !ruleId;

  const rule = useApiQuery<AutomationRuleResponse>({
    queryKey: queryKeys.automations.rule(organizationId, ruleId ?? ''),
    path: `/api/organizations/${organizationId}/automations/${ruleId ?? ''}`,
    enabled: Boolean(ruleId),
  });

  const [draft, setDraft] = useState<Draft | undefined>(isNew ? EMPTY_DRAFT : undefined);
  const [testPayload, setTestPayload] = useState('{\n  "example": true\n}');
  const [validation, setValidation] = useState<string[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const resolved = useMemo(() => {
    if (draft) {
      return draft;
    }
    const item = rule.data?.rule;
    if (!item) {
      return undefined;
    }
    return {
      name: item.name,
      description: item.description ?? '',
      enabled: item.enabled,
      triggerType: item.triggerType,
      eventName: item.eventName ?? '',
      schedule: item.schedule ?? '0 * * * *',
      match: item.match,
      conditions: [...item.conditions],
      actionType: item.actionType,
      actionMessage: item.action.message ?? '',
      actionUrl: item.action.url ?? '',
      actionMethod: item.action.method ?? 'POST',
      actionBody: JSON.stringify(item.action.body ?? item.action.data ?? {}, null, 2),
      maxAttempts: String(item.maxAttempts),
    } satisfies Draft;
  }, [draft, rule.data?.rule]);

  const createRule = useApiMutation({
    mutationFn: (body: CreateAutomationRuleRequest) => automationsApi.createRule(organizationId, body),
    invalidateKeys: [queryKeys.automations.rules(organizationId)],
    successMessage: 'Workflow created',
  });
  const updateRule = useApiMutation({
    mutationFn: (body: CreateAutomationRuleRequest) =>
      automationsApi.updateRule(organizationId, ruleId ?? '', body),
    invalidateKeys: [queryKeys.automations.all()],
    successMessage: 'Workflow saved',
  });
  const deleteRule = useApiMutation({
    mutationFn: () => automationsApi.deleteRule(organizationId, ruleId ?? ''),
    invalidateKeys: [queryKeys.automations.rules(organizationId)],
    successMessage: 'Workflow deleted',
  });
  const runRule = useApiMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      automationsApi.run(organizationId, ruleId ?? '', { payload }),
    invalidateKeys: [queryKeys.automations.jobs(organizationId)],
    successMessage: 'Test run queued',
  });

  function patch(next: Partial<Draft>): void {
    const base = resolved ?? EMPTY_DRAFT;
    setDraft({ ...base, ...next });
  }

  function validate(current: Draft): string[] {
    const errors: string[] = [];
    if (current.name.trim().length === 0) {
      errors.push('Name is required.');
    }
    if (current.triggerType === 'event' && !current.eventName) {
      errors.push('Choose a source event.');
    }
    if (current.triggerType === 'schedule' && current.schedule.trim().length === 0) {
      errors.push('Schedule (cron) is required.');
    }
    if (current.actionType === 'http_request' && !current.actionUrl.trim()) {
      errors.push('HTTP action needs a URL.');
    }
    if (current.actionType === 'record' && !current.actionMessage.trim()) {
      errors.push('Record action needs a message.');
    }
    try {
      JSON.parse(current.actionBody || '{}');
    } catch {
      errors.push('Action JSON body is invalid.');
    }
    return errors;
  }

  function toRequest(current: Draft): CreateAutomationRuleRequest {
    let parsed: Record<string, unknown> = {};
    try {
      const value: unknown = JSON.parse(current.actionBody || '{}');
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        parsed = value as Record<string, unknown>;
      }
    } catch {
      parsed = {};
    }
    const action: AutomationActionConfigDto =
      current.actionType === 'http_request'
        ? {
            url: current.actionUrl.trim(),
            method: (AUTOMATION_HTTP_METHODS as readonly string[]).includes(current.actionMethod)
              ? (current.actionMethod as (typeof AUTOMATION_HTTP_METHODS)[number])
              : 'POST',
            body: parsed,
          }
        : current.actionType === 'emit_event'
          ? { data: parsed }
          : { message: current.actionMessage.trim(), data: parsed };

    return {
      name: current.name.trim(),
      description: current.description.trim() || undefined,
      enabled: current.enabled,
      triggerType: current.triggerType,
      eventName: current.triggerType === 'event' ? (current.eventName || undefined) : undefined,
      schedule: current.triggerType === 'schedule' ? current.schedule.trim() : undefined,
      match: current.match,
      conditions: current.conditions,
      actionType: current.actionType,
      action,
      maxAttempts: Number(current.maxAttempts) || 3,
    };
  }

  async function onSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!resolved || !canManage) {
      return;
    }
    const errors = validate(resolved);
    setValidation(errors);
    if (errors.length > 0) {
      return;
    }
    const body = toRequest(resolved);
    if (isNew) {
      const created = await createRule.mutateAsync(body);
      navigate(automationsPath(organizationId, created.rule.id));
      return;
    }
    await updateRule.mutateAsync(body);
  }

  async function onTest(): Promise<void> {
    if (!ruleId) {
      return;
    }
    let payload: Record<string, unknown> = {};
    try {
      const value: unknown = JSON.parse(testPayload);
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        payload = value as Record<string, unknown>;
      }
    } catch {
      setValidation(['Test payload must be a JSON object.']);
      return;
    }
    setValidation([]);
    await runRule.mutateAsync(payload);
  }

  if (!isNew && rule.isPending && !resolved) {
    return <Skeleton className="h-96 w-full" />;
  }
  if (!isNew && rule.isError) {
    return (
      <QueryErrorAlert
        message={rule.error.message}
        onRetry={() => {
          void rule.refetch();
        }}
        pending={rule.isFetching}
        title="Unable to load workflow"
      />
    );
  }
  if (!resolved) {
    return null;
  }

  return (
    <form className="space-y-6" onSubmit={(event) => void onSave(event)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild type="button" variant="ghost">
          <Link to={automationsPath(organizationId)}>Back to rules</Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          {!isNew ? (
            <Button asChild type="button" variant="outline">
              <Link to={automationsPath(organizationId, `${ruleId}/history`)}>Execution history</Link>
            </Button>
          ) : null}
          {canManage && !isNew ? (
            <Button onClick={() => setDeleteOpen(true)} type="button" variant="destructive">
              Delete
            </Button>
          ) : null}
          {canManage ? (
            <Button disabled={createRule.isPending || updateRule.isPending} type="submit">
              {createRule.isPending || updateRule.isPending ? <Spinner label="Saving" /> : null}
              {isNew ? 'Create workflow' : 'Save'}
            </Button>
          ) : null}
        </div>
      </div>

      {validation.length > 0 ? (
        <Alert variant="destructive">
          <AlertTitle>Fix validation before saving</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {validation.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <WorkflowStep title="1. Trigger" description="When this workflow starts.">
          <Field id="wf-name" label="Name" required>
            <Input
              disabled={!canManage}
              onChange={(event) => {
                patch({ name: event.target.value });
              }}
              value={resolved.name}
            />
          </Field>
          <Field id="wf-description" label="Description">
            <Textarea
              disabled={!canManage}
              onChange={(event) => {
                patch({ description: event.target.value });
              }}
              value={resolved.description}
            />
          </Field>
          <Field id="wf-trigger" label="Trigger type">
            <Select
              disabled={!canManage}
              onValueChange={(value) => {
                if (value === 'event' || value === 'schedule') {
                  patch({ triggerType: value });
                }
              }}
              options={[
                { value: 'event', label: 'Event' },
                { value: 'schedule', label: 'Schedule' },
              ]}
              searchable={false}
              value={resolved.triggerType}
            />
          </Field>
          {resolved.triggerType === 'event' ? (
            <Field id="wf-event" label="Source event">
              <Select
                disabled={!canManage}
                onValueChange={(value) => {
                  if ((AUTOMATION_SOURCE_EVENTS as readonly string[]).includes(value)) {
                    patch({ eventName: value as AutomationSourceEvent });
                  }
                }}
                options={EVENT_OPTIONS}
                value={resolved.eventName}
              />
            </Field>
          ) : (
            <Field hint="Five-field cron expression." id="wf-schedule" label="Cron schedule">
              <Input
                disabled={!canManage}
                onChange={(event) => {
                  patch({ schedule: event.target.value });
                }}
                value={resolved.schedule}
              />
            </Field>
          )}
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={resolved.enabled}
              disabled={!canManage}
              onCheckedChange={(enabled) => {
                patch({ enabled });
              }}
            />
            Enabled
          </label>
        </WorkflowStep>

        <WorkflowStep title="2. Conditions" description="All or any conditions must match.">
          <Field id="wf-match" label="Match">
            <Select
              disabled={!canManage}
              onValueChange={(value) => {
                if (value === 'all' || value === 'any') {
                  patch({ match: value });
                }
              }}
              options={[
                { value: 'all', label: 'Match all' },
                { value: 'any', label: 'Match any' },
              ]}
              searchable={false}
              value={resolved.match}
            />
          </Field>
          <ul className="space-y-3">
            {resolved.conditions.map((condition, index) => (
              <li className="grid gap-2 rounded-md border border-border p-3" key={`${condition.field}-${String(index)}`}>
                <Input
                  disabled={!canManage}
                  onChange={(event) => {
                    const next = [...resolved.conditions];
                    const current = next[index];
                    if (!current) {
                      return;
                    }
                    next[index] = { ...current, field: event.target.value };
                    patch({ conditions: next });
                  }}
                  placeholder="Field path, e.g. ticket.status"
                  value={condition.field}
                />
                <Select
                  disabled={!canManage}
                  onValueChange={(value) => {
                    const next = [...resolved.conditions];
                    const current = next[index];
                    if (!current) {
                      return;
                    }
                    next[index] = { ...current, operator: value as AutomationConditionOperator };
                    patch({ conditions: next });
                  }}
                  options={OPERATOR_OPTIONS}
                  searchable={false}
                  value={condition.operator}
                />
                {condition.operator !== 'exists' ? (
                  <Input
                    disabled={!canManage}
                    onChange={(event) => {
                      const next = [...resolved.conditions];
                      const current = next[index];
                      if (!current) {
                        return;
                      }
                      next[index] = { ...current, value: event.target.value };
                      patch({ conditions: next });
                    }}
                    placeholder="Value"
                    value={typeof condition.value === 'string' ? condition.value : JSON.stringify(condition.value ?? '')}
                  />
                ) : null}
                {canManage ? (
                  <Button
                    onClick={() => {
                      patch({ conditions: resolved.conditions.filter((_, i) => i !== index) });
                    }}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 />
                    Remove
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          {canManage ? (
            <Button
              onClick={() => {
                patch({
                  conditions: [...resolved.conditions, { field: 'status', operator: 'eq', value: 'open' }],
                });
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              <Plus />
              Add condition
            </Button>
          ) : null}
        </WorkflowStep>

        <WorkflowStep title="3. Action" description="What runs when conditions pass.">
          <Field id="wf-action" label="Action type">
            <Select
              disabled={!canManage}
              onValueChange={(value) => {
                if (value === 'record' || value === 'http_request' || value === 'emit_event') {
                  patch({ actionType: value });
                }
              }}
              options={ACTION_OPTIONS}
              searchable={false}
              value={resolved.actionType}
            />
          </Field>
          {resolved.actionType === 'record' ? (
            <Field id="wf-message" label="Message">
              <Input
                disabled={!canManage}
                onChange={(event) => {
                  patch({ actionMessage: event.target.value });
                }}
                value={resolved.actionMessage}
              />
            </Field>
          ) : null}
          {resolved.actionType === 'http_request' ? (
            <>
              <Field id="wf-url" label="URL">
                <Input
                  disabled={!canManage}
                  onChange={(event) => {
                    patch({ actionUrl: event.target.value });
                  }}
                  value={resolved.actionUrl}
                />
              </Field>
              <Field id="wf-method" label="Method">
                <Select
                  disabled={!canManage}
                  onValueChange={(value) => {
                    patch({ actionMethod: value });
                  }}
                  options={AUTOMATION_HTTP_METHODS.map((method) => ({ value: method, label: method }))}
                  searchable={false}
                  value={resolved.actionMethod}
                />
              </Field>
            </>
          ) : null}
          <Field id="wf-body" label="JSON payload">
            <Textarea
              className="font-mono text-xs"
              disabled={!canManage}
              onChange={(event) => {
                patch({ actionBody: event.target.value });
              }}
              rows={6}
              value={resolved.actionBody}
            />
          </Field>
          <Field id="wf-attempts" label="Max attempts">
            <Input
              disabled={!canManage}
              min={1}
              onChange={(event) => {
                patch({ maxAttempts: event.target.value });
              }}
              type="number"
              value={resolved.maxAttempts}
            />
          </Field>
        </WorkflowStep>
      </div>

      {!isNew && canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Test mode</CardTitle>
            <CardDescription>
              Runs this rule immediately with a JSON payload. The job appears in execution history.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              aria-label="Test payload"
              className="font-mono text-xs"
              onChange={(event) => {
                setTestPayload(event.target.value);
              }}
              rows={8}
              value={testPayload}
            />
            <Button
              disabled={runRule.isPending}
              onClick={() => {
                void onTest();
              }}
              type="button"
            >
              {runRule.isPending ? <Spinner label="Running" /> : <Play />}
              Run test
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <ConfirmDialog
        confirmLabel="Delete workflow"
        description="Jobs already queued keep running; the rule will no longer match new events."
        onConfirm={() => {
          void deleteRule.mutateAsync().then(() => {
            navigate(automationsPath(organizationId));
          });
        }}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        pending={deleteRule.isPending}
        title="Delete this workflow?"
        variant="destructive"
      />
    </form>
  );
}

function WorkflowStep({
  title,
  description,
  children,
  className,
}: {
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}
