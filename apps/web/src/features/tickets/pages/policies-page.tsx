import { useState, type FormEvent } from 'react';
import type {
  CreateTicketEscalationPolicyRequest,
  CreateTicketSlaPolicyRequest,
  TicketEscalationAction,
  TicketEscalationPolicyListResponse,
  TicketEscalationTriggerType,
  TicketSlaPolicyListResponse,
  SlaPolicyPriority,
} from '@ai-customer-support/contracts';
import {
  SLA_POLICY_PRIORITIES,
  TICKET_ESCALATION_ACTIONS,
  TICKET_ESCALATION_TRIGGER_TYPES,
} from '@ai-customer-support/contracts';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { QueryErrorAlert } from '@/components/ui/query-error';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/features/organizations/components/confirm-dialog';
import { WorkspacePage } from '@/features/organizations/components/workspace-page';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { ticketsApi } from '../api';

export function TicketPoliciesPage() {
  const { organizationId } = useWorkspace();
  const sla = useApiQuery<TicketSlaPolicyListResponse>({
    queryKey: queryKeys.tickets.slaPolicies(organizationId),
    path: `/api/organizations/${organizationId}/ticket-sla-policies`,
  });
  const escalation = useApiQuery<TicketEscalationPolicyListResponse>({
    queryKey: queryKeys.tickets.escalationPolicies(organizationId),
    path: `/api/organizations/${organizationId}/ticket-escalation-policies`,
  });

  const createSla = useApiMutation({
    mutationFn: (body: CreateTicketSlaPolicyRequest) => ticketsApi.createSlaPolicy(organizationId, body),
    invalidateKeys: [queryKeys.tickets.slaPolicies(organizationId)],
    successMessage: 'SLA policy created',
  });
  const updateSla = useApiMutation({
    mutationFn: (input: { id: string; enabled: boolean }) =>
      ticketsApi.updateSlaPolicy(organizationId, input.id, { enabled: input.enabled }),
    invalidateKeys: [queryKeys.tickets.slaPolicies(organizationId)],
    successMessage: 'SLA policy updated',
  });
  const deleteSla = useApiMutation({
    mutationFn: (id: string) => ticketsApi.deleteSlaPolicy(organizationId, id),
    invalidateKeys: [queryKeys.tickets.slaPolicies(organizationId)],
    successMessage: 'SLA policy deleted',
  });
  const createEscalation = useApiMutation({
    mutationFn: (body: CreateTicketEscalationPolicyRequest) =>
      ticketsApi.createEscalationPolicy(organizationId, body),
    invalidateKeys: [queryKeys.tickets.escalationPolicies(organizationId)],
    successMessage: 'Escalation policy created',
  });
  const updateEscalation = useApiMutation({
    mutationFn: (input: { id: string; enabled: boolean }) =>
      ticketsApi.updateEscalationPolicy(organizationId, input.id, { enabled: input.enabled }),
    invalidateKeys: [queryKeys.tickets.escalationPolicies(organizationId)],
    successMessage: 'Escalation policy updated',
  });
  const deleteEscalation = useApiMutation({
    mutationFn: (id: string) => ticketsApi.deleteEscalationPolicy(organizationId, id),
    invalidateKeys: [queryKeys.tickets.escalationPolicies(organizationId)],
    successMessage: 'Escalation policy deleted',
  });
  const evaluate = useApiMutation({
    mutationFn: () => ticketsApi.evaluateEscalation(organizationId),
    invalidateKeys: [queryKeys.tickets.all()],
    successMessage: 'Escalation rules evaluated',
  });

  const [deleteSlaId, setDeleteSlaId] = useState<string | undefined>();
  const [deleteEscalationId, setDeleteEscalationId] = useState<string | undefined>();

  return (
    <WorkspacePage className="overflow-y-auto" wide>
      <PageHeader
        actions={
          <Button
            disabled={evaluate.isPending}
            onClick={() => {
              evaluate.mutate();
            }}
            type="button"
            variant="outline"
          >
            Run escalation now
          </Button>
        }
        description="First-response and resolution timers, plus automatic escalation when a ticket is overdue or unassigned."
        title="SLA & escalation"
      />

      <Card>
        <CardHeader>
          <CardTitle>SLA policies</CardTitle>
          <CardDescription>Applied when a ticket is created, matching priority or the any-priority fallback.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {sla.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : sla.isError ? (
            <QueryErrorAlert
              message={sla.error.message}
              onRetry={() => {
                void sla.refetch();
              }}
              pending={sla.isFetching}
              title="Unable to load SLA policies"
            />
          ) : (sla.data?.items.length ?? 0) === 0 ? (
            <EmptyState description="Create a policy so new tickets receive first-response and resolution due times." title="No SLA policies" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>First response</TableHead>
                  <TableHead>Resolution</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(sla.data?.items ?? []).map((policy) => (
                  <TableRow key={policy.id}>
                    <TableCell className="font-medium">{policy.name}</TableCell>
                    <TableCell className="capitalize">{policy.appliesToPriority}</TableCell>
                    <TableCell>{String(policy.firstResponseMinutes)}m</TableCell>
                    <TableCell>{String(policy.resolutionMinutes)}m</TableCell>
                    <TableCell>
                      <Switch
                        checked={policy.enabled}
                        onCheckedChange={(enabled) => {
                          updateSla.mutate({ id: policy.id, enabled });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Button onClick={() => setDeleteSlaId(policy.id)} size="sm" type="button" variant="ghost">
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <SlaPolicyForm
            onSubmit={async (body) => {
              await createSla.mutateAsync(body);
            }}
            pending={createSla.isPending}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Escalation policies</CardTitle>
          <CardDescription>Triggered by overdue first response, overdue resolution, or time unassigned.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {escalation.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : escalation.isError ? (
            <QueryErrorAlert
              message={escalation.error.message}
              onRetry={() => {
                void escalation.refetch();
              }}
              pending={escalation.isFetching}
              title="Unable to load escalation policies"
            />
          ) : (escalation.data?.items.length ?? 0) === 0 ? (
            <EmptyState description="Add a rule to bump priority, unassign, or mark tickets escalated." title="No escalation policies" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(escalation.data?.items ?? []).map((policy) => (
                  <TableRow key={policy.id}>
                    <TableCell className="font-medium">{policy.name}</TableCell>
                    <TableCell>
                      {policy.triggerType.replaceAll('_', ' ')}
                      {policy.triggerMinutes ? ` (${String(policy.triggerMinutes)}m)` : ''}
                    </TableCell>
                    <TableCell>{policy.action.replaceAll('_', ' ')}</TableCell>
                    <TableCell>
                      <Switch
                        checked={policy.enabled}
                        onCheckedChange={(enabled) => {
                          updateEscalation.mutate({ id: policy.id, enabled });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Button onClick={() => setDeleteEscalationId(policy.id)} size="sm" type="button" variant="ghost">
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <EscalationPolicyForm
            onSubmit={async (body) => {
              await createEscalation.mutateAsync(body);
            }}
            pending={createEscalation.isPending}
          />
        </CardContent>
      </Card>

      <ConfirmDialog
        confirmLabel="Delete policy"
        description="Tickets already using this SLA keep their existing timers."
        onConfirm={() => {
          if (deleteSlaId) {
            deleteSla.mutate(deleteSlaId);
          }
          setDeleteSlaId(undefined);
        }}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteSlaId(undefined);
          }
        }}
        open={Boolean(deleteSlaId)}
        pending={deleteSla.isPending}
        title="Delete SLA policy"
        variant="destructive"
      />
      <ConfirmDialog
        confirmLabel="Delete policy"
        description="This rule will no longer run on overdue or unassigned tickets."
        onConfirm={() => {
          if (deleteEscalationId) {
            deleteEscalation.mutate(deleteEscalationId);
          }
          setDeleteEscalationId(undefined);
        }}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteEscalationId(undefined);
          }
        }}
        open={Boolean(deleteEscalationId)}
        pending={deleteEscalation.isPending}
        title="Delete escalation policy"
        variant="destructive"
      />
    </WorkspacePage>
  );
}

function SlaPolicyForm({
  onSubmit,
  pending,
}: {
  readonly onSubmit: (body: CreateTicketSlaPolicyRequest) => Promise<void>;
  readonly pending: boolean;
}) {
  const [name, setName] = useState('');
  const [appliesToPriority, setAppliesToPriority] = useState<SlaPolicyPriority>('any');
  const [firstResponseMinutes, setFirstResponseMinutes] = useState('30');
  const [resolutionMinutes, setResolutionMinutes] = useState('480');

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await onSubmit({
      name: name.trim(),
      appliesToPriority,
      firstResponseMinutes: Number(firstResponseMinutes),
      resolutionMinutes: Number(resolutionMinutes),
    });
    setName('');
  }

  return (
    <form className="grid gap-3 rounded-lg border border-dashed border-border p-4 sm:grid-cols-2 lg:grid-cols-5" onSubmit={(event) => void submit(event)}>
      <Field className="lg:col-span-2" id="sla-name" label="New SLA policy" required>
        <Input
          onChange={(event) => {
            setName(event.target.value);
          }}
          placeholder="Name"
          value={name}
        />
      </Field>
      <Field id="sla-priority" label="Applies to">
        <Select
          onValueChange={(value) => {
            if ((SLA_POLICY_PRIORITIES as readonly string[]).includes(value)) {
              setAppliesToPriority(value as SlaPolicyPriority);
            }
          }}
          options={SLA_POLICY_PRIORITIES.map((item) => ({ value: item, label: item }))}
          searchable={false}
          value={appliesToPriority}
        />
      </Field>
      <Field id="sla-first" label="First response (min)">
        <Input
          min={1}
          onChange={(event) => {
            setFirstResponseMinutes(event.target.value);
          }}
          type="number"
          value={firstResponseMinutes}
        />
      </Field>
      <div className="flex items-end gap-2">
        <Field className="flex-1" id="sla-resolution" label="Resolution (min)">
          <Input
            min={1}
            onChange={(event) => {
              setResolutionMinutes(event.target.value);
            }}
            type="number"
            value={resolutionMinutes}
          />
        </Field>
        <Button disabled={pending || name.trim() === ''} type="submit">
          <Plus />
          Add
        </Button>
      </div>
    </form>
  );
}

function EscalationPolicyForm({
  onSubmit,
  pending,
}: {
  readonly onSubmit: (body: CreateTicketEscalationPolicyRequest) => Promise<void>;
  readonly pending: boolean;
}) {
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<TicketEscalationTriggerType>('first_response_overdue');
  const [action, setAction] = useState<TicketEscalationAction>('mark_escalated');
  const [triggerMinutes, setTriggerMinutes] = useState('15');

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await onSubmit({
      name: name.trim(),
      triggerType,
      action,
      triggerMinutes: triggerType === 'unassigned_for' ? Number(triggerMinutes) : undefined,
    });
    setName('');
  }

  return (
    <form className="grid gap-3 rounded-lg border border-dashed border-border p-4 sm:grid-cols-2 lg:grid-cols-5" onSubmit={(event) => void submit(event)}>
      <Field className="lg:col-span-2" id="esc-name" label="New escalation policy" required>
        <Input
          onChange={(event) => {
            setName(event.target.value);
          }}
          placeholder="Name"
          value={name}
        />
      </Field>
      <Field id="esc-trigger" label="Trigger">
        <Select
          onValueChange={(value) => {
            if ((TICKET_ESCALATION_TRIGGER_TYPES as readonly string[]).includes(value)) {
              setTriggerType(value as TicketEscalationTriggerType);
            }
          }}
          options={TICKET_ESCALATION_TRIGGER_TYPES.map((item) => ({ value: item, label: item.replaceAll('_', ' ') }))}
          searchable={false}
          value={triggerType}
        />
      </Field>
      <Field id="esc-action" label="Action">
        <Select
          onValueChange={(value) => {
            if ((TICKET_ESCALATION_ACTIONS as readonly string[]).includes(value)) {
              setAction(value as TicketEscalationAction);
            }
          }}
          options={TICKET_ESCALATION_ACTIONS.map((item) => ({ value: item, label: item.replaceAll('_', ' ') }))}
          searchable={false}
          value={action}
        />
      </Field>
      <div className="flex items-end gap-2">
        <Field className="flex-1" id="esc-minutes" label="Unassigned minutes">
          <Input
            disabled={triggerType !== 'unassigned_for'}
            min={1}
            onChange={(event) => {
              setTriggerMinutes(event.target.value);
            }}
            type="number"
            value={triggerMinutes}
          />
        </Field>
        <Button disabled={pending || name.trim() === ''} type="submit">
          <Plus />
          Add
        </Button>
      </div>
    </form>
  );
}
