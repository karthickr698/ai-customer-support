import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type {
  ExecuteToolCallRequest,
  OrganizationPermission,
  ToolDefinitionDto,
  ToolDefinitionListResponse,
  ToolInvocationDto,
  ToolName,
} from '@ai-customer-support/contracts';
import { FlaskConical } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { ConfirmDialog } from '@/features/organizations/components/confirm-dialog';
import { hasPermission, permissionLabel } from '@/features/organizations/permissions';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { ApiError } from '@/services/api-error';
import { queryKeys } from '@/services/query-keys';
import { toolsApi } from '../api';
import { ArgumentFields } from '../components/argument-fields';
import { JsonPreview } from '../components/json-preview';
import { toolLabel, toolsPath, toolSideLabel } from '../labels';
import { buildToolArguments, conversationIdError, validateToolSpecificRules } from '../validation';

export function ToolsTesterPage() {
  const { organizationId, permissions } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTool = searchParams.get('tool');
  const [argumentValues, setArgumentValues] = useState<Record<string, string>>({});
  const [argumentErrors, setArgumentErrors] = useState<Record<string, string>>({});
  const [conversationId, setConversationId] = useState('');
  const [conversationError, setConversationError] = useState<string>();
  const [result, setResult] = useState<ToolInvocationDto | null>(null);
  const [pendingWrite, setPendingWrite] = useState<ExecuteToolCallRequest | null>(null);

  const catalog = useApiQuery<ToolDefinitionListResponse>({
    queryKey: queryKeys.tools.catalog(organizationId),
    path: `/api/organizations/${organizationId}/tools`,
  });

  const executable = useMemo(
    () =>
      (catalog.data?.items ?? []).filter((tool) =>
        hasPermission(permissions, tool.permission as OrganizationPermission),
      ),
    [catalog.data?.items, permissions],
  );

  const selected =
    executable.find((tool) => tool.name === requestedTool) ?? executable[0] ?? null;

  const execute = useApiMutation({
    mutationFn: (body: ExecuteToolCallRequest) => toolsApi.execute(organizationId, body),
    invalidateKeys: [queryKeys.tools.all()],
    successMessage: 'Tool call executed',
    errorMessage: undefined,
    onSuccess: (payload) => {
      setResult(payload.invocation);
    },
  });
  const resetExecute = execute.reset;

  useEffect(() => {
    setArgumentValues({});
    setArgumentErrors({});
    setResult(null);
    resetExecute();
  }, [selected?.name, resetExecute]);

  function setTool(name: ToolName): void {
    setSearchParams({ tool: name }, { replace: true });
  }

  function runCall(body: ExecuteToolCallRequest): void {
    setResult(null);
    void execute.mutateAsync(body).catch(() => undefined);
  }

  function submitSelected(): void {
    if (!selected) {
      return;
    }
    const built = buildToolArguments(selected.argumentSchema, argumentValues);
    const specific = validateToolSpecificRules(selected.name, built.arguments);
    const nextErrors = { ...built.errors, ...specific };
    const conversation = conversationIdError(conversationId);
    setArgumentErrors(nextErrors);
    setConversationError(conversation);
    if (Object.keys(nextErrors).length > 0 || conversation) {
      return;
    }

    const body: ExecuteToolCallRequest = {
      name: selected.name,
      arguments: built.arguments,
      actorType: 'user',
      conversationId: conversationId.trim() || undefined,
    };

    if (selected.side === 'write') {
      setPendingWrite(body);
      return;
    }

    runCall(body);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    submitSelected();
  }

  if (catalog.isPending) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (catalog.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load tools</AlertTitle>
        <AlertDescription>{catalog.error.message}</AlertDescription>
      </Alert>
    );
  }

  if (!selected) {
    return (
      <EmptyState
        description="Your role does not include any tool permissions. Ask an admin to change your role, or review the catalog."
        icon={<FlaskConical className="size-8" />}
        title="No executable tools"
      />
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Test a tool call</CardTitle>
          <CardDescription>
            Arguments are validated against the allowlisted schema before TypeScript executes the call.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
            <Field id="test-tool" label="Tool" required>
              <Select
                id="test-tool"
                onValueChange={(value) => {
                  setTool(value as ToolName);
                }}
                options={executable.map((tool) => ({
                  value: tool.name,
                  label: toolLabel(tool.name),
                  description: `${toolSideLabel(tool.side)} · ${permissionLabel(tool.permission as OrganizationPermission)}`,
                }))}
                searchable={false}
                value={selected.name}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Badge variant={selected.side === 'write' ? 'warning' : 'secondary'}>
                {toolSideLabel(selected.side)}
              </Badge>
              <Badge variant="outline">{selected.executionKind === 'http' ? 'HTTPS connector' : 'Platform'}</Badge>
              <Badge variant="outline">{selected.permission}</Badge>
            </div>
            {selected.side === 'write' ? (
              <Alert variant="warning">
                <AlertTitle>Live mutation</AlertTitle>
                <AlertDescription>
                  Write tools change tickets or conversations in this workspace. Confirm before running.
                </AlertDescription>
              </Alert>
            ) : null}
            {selected.executionKind === 'http' ? (
              <Alert>
                <AlertTitle>Connector required</AlertTitle>
                <AlertDescription>
                  This tool needs a credential or connected OAuth app.{' '}
                  <Link className="underline underline-offset-4" to={toolsPath(organizationId, 'credentials')}>
                    Manage credentials
                  </Link>
                  .
                </AlertDescription>
              </Alert>
            ) : null}
            <ArgumentFields
              disabled={execute.isPending}
              errors={argumentErrors}
              onChange={(name, value) => {
                setArgumentValues((current) => ({ ...current, [name]: value }));
                setArgumentErrors((current) => {
                  const next = { ...current };
                  delete next[name];
                  return next;
                });
              }}
              schema={selected.argumentSchema}
              values={argumentValues}
            />
            <Field
              error={conversationError}
              hint="Optional. Attached to the audit record when the tool is conversation-scoped."
              id="test-conversation"
              label="Conversation id"
            >
              <Input
                id="test-conversation"
                onChange={(event) => {
                  setConversationId(event.target.value);
                  setConversationError(undefined);
                }}
                placeholder="UUID"
                value={conversationId}
              />
            </Field>
            <Button disabled={execute.isPending} type="submit">
              {execute.isPending ? <Spinner label="Executing tool" /> : null}
              {selected.side === 'write' ? 'Review and run' : 'Run tool'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <ResultPanel error={execute.error} selected={selected} result={result} />

      <ConfirmDialog
        confirmLabel="Run write tool"
        description={`${toolLabel(selected.name)} will mutate live workspace data. This is audited.`}
        onConfirm={() => {
          if (!pendingWrite) {
            return;
          }
          runCall(pendingWrite);
          setPendingWrite(null);
        }}
        onOpenChange={(open) => {
          if (!open) {
            setPendingWrite(null);
          }
        }}
        open={pendingWrite !== null}
        pending={execute.isPending}
        title="Run this write tool?"
        variant="destructive"
      />
    </div>
  );
}

function ResultPanel({
  selected,
  result,
  error,
}: {
  readonly selected: ToolDefinitionDto;
  readonly result: ToolInvocationDto | null;
  readonly error: ApiError | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Result</CardTitle>
        <CardDescription>
          {selected.description} Authorization uses {permissionLabel(selected.permission as OrganizationPermission)}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>{error.code === 'TOOL_CREDENTIAL_REQUIRED' ? 'Connector required' : 'Call failed'}</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ) : null}
        {result ? (
          <div className="space-y-3">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Status</dt>
                <dd className="mt-1">{result.status}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Duration</dt>
                <dd className="mt-1">{String(result.durationMs)} ms · {String(result.attemptCount)} attempt(s)</dd>
              </div>
            </dl>
            {result.errorMessage ? (
              <Alert variant="destructive">
                <AlertTitle>{result.errorCode ?? 'Error'}</AlertTitle>
                <AlertDescription>{result.errorMessage}</AlertDescription>
              </Alert>
            ) : null}
            <JsonPreview label="Invocation" value={result} />
          </div>
        ) : !error ? (
          <p className="text-sm text-muted-foreground">Run a call to inspect the audited invocation payload.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
