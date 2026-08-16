import type { FormEvent } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { QUEUE_VIEWS, TICKET_PRIORITY_OPTIONS } from '../labels';

export type TicketQueueFilters = {
  readonly q: string;
  readonly view: string;
  readonly priority: string;
  readonly assignedAgentId: string;
};

export function TicketFilters({
  filters,
  assignmentOptions,
  onChange,
  onReset,
}: {
  readonly filters: TicketQueueFilters;
  readonly assignmentOptions: ReadonlyArray<{ value: string; label: string }>;
  readonly onChange: (patch: Partial<TicketQueueFilters>) => void;
  readonly onReset: () => void;
}) {
  const hasActive =
    filters.q !== '' || filters.view !== 'all' || filters.priority !== '' || filters.assignedAgentId !== '';

  function onSearchSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem('q') as HTMLInputElement | null;
    onChange({ q: input?.value.trim() ?? '' });
  }

  return (
    <div className="flex flex-col gap-3 border-b border-border p-3">
      <form className="relative" onSubmit={onSearchSubmit}>
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search tickets"
          className="pl-8"
          defaultValue={filters.q}
          key={filters.q}
          name="q"
          onBlur={(event) => {
            const next = event.target.value.trim();
            if (next !== filters.q) {
              onChange({ q: next });
            }
          }}
          placeholder="Search subject, customer, or description"
        />
      </form>
      <div aria-label="Queue" className="flex flex-wrap gap-1" role="tablist">
        {QUEUE_VIEWS.map((item) => (
          <button
            aria-selected={filters.view === item.value}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium',
              filters.view === item.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
            key={item.value}
            onClick={() => {
              onChange({ view: item.value });
            }}
            role="tab"
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select
          onValueChange={(value) => {
            onChange({ priority: value });
          }}
          options={[{ value: '', label: 'Any priority' }, ...TICKET_PRIORITY_OPTIONS]}
          placeholder="Priority"
          searchable={false}
          value={filters.priority}
        />
        <Select
          onValueChange={(value) => {
            onChange({ assignedAgentId: value });
          }}
          options={[{ value: '', label: 'Any assignee' }, ...assignmentOptions]}
          placeholder="Assignee"
          searchable={false}
          value={filters.assignedAgentId}
        />
      </div>
      {hasActive ? (
        <Button
          onClick={onReset}
          size="sm"
          type="button"
          variant="ghost"
        >
          <X className="size-3.5" />
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}
