import { useState, type FormEvent } from 'react';
import type { CreateTicketRequest, OrganizationMemberDto, TicketPriority } from '@ai-customer-support/contracts';
import { Button } from '@/components/ui/button';
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
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { TICKET_PRIORITY_OPTIONS } from '../labels';

export function CreateTicketDialog({
  open,
  onOpenChange,
  members,
  pending,
  onCreate,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly members: readonly OrganizationMemberDto[];
  readonly pending: boolean;
  readonly onCreate: (body: CreateTicketRequest) => Promise<void>;
}) {
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('normal');
  const [assignedAgentId, setAssignedAgentId] = useState('');
  const [error, setError] = useState<string | undefined>();

  const assignOptions = members
    .filter(
      (member) =>
        member.status === 'active' &&
        (member.role === 'owner' || member.role === 'admin' || member.role === 'agent'),
    )
    .map((member) => ({ value: member.userId, label: member.displayName, description: member.email }));

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!customerName.trim() || !customerEmail.trim() || !subject.trim() || !description.trim()) {
      setError('Name, email, subject, and description are required.');
      return;
    }
    setError(undefined);
    await onCreate({
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      subject: subject.trim(),
      description: description.trim(),
      priority,
      assignedAgentId: assignedAgentId || undefined,
    });
    setCustomerName('');
    setCustomerEmail('');
    setSubject('');
    setDescription('');
    setPriority('normal');
    setAssignedAgentId('');
    onOpenChange(false);
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create ticket</DialogTitle>
          <DialogDescription>Open a tenant-scoped support ticket with SLA timers from the matching policy.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="ticket-customer-name" label="Customer name" required>
              <Input
                onChange={(event) => {
                  setCustomerName(event.target.value);
                }}
                value={customerName}
              />
            </Field>
            <Field id="ticket-customer-email" label="Customer email" required>
              <Input
                onChange={(event) => {
                  setCustomerEmail(event.target.value);
                }}
                type="email"
                value={customerEmail}
              />
            </Field>
          </div>
          <Field id="ticket-subject" label="Subject" required>
            <Input
              onChange={(event) => {
                setSubject(event.target.value);
              }}
              value={subject}
            />
          </Field>
          <Field id="ticket-description" label="Description" required>
            <Textarea
              onChange={(event) => {
                setDescription(event.target.value);
              }}
              value={description}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="ticket-priority" label="Priority">
              <Select
                onValueChange={(value) => {
                  if (value === 'low' || value === 'normal' || value === 'high' || value === 'urgent') {
                    setPriority(value);
                  }
                }}
                options={TICKET_PRIORITY_OPTIONS}
                searchable={false}
                value={priority}
              />
            </Field>
            <Field id="ticket-assignee" label="Assignee">
              <Select
                onValueChange={setAssignedAgentId}
                options={[{ value: '', label: 'Unassigned' }, ...assignOptions]}
                searchable={false}
                value={assignedAgentId}
              />
            </Field>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={pending} type="submit">
              {pending ? <Spinner label="Creating" /> : null}
              Create ticket
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
