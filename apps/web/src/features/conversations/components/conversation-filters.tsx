import type { FormEvent } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  CHANNEL_OPTIONS,
  INBOX_STATUS_FILTERS,
  PRIORITY_OPTIONS,
} from '../labels';

export type InboxFilters = {
  readonly q: string;
  readonly status: string;
  readonly priority: string;
  readonly assignedAgentId: string;
  readonly channel: string;
  readonly tag: string;
};

export function ConversationFilters({
  filters,
  assignmentOptions,
  onChange,
  onReset,
}: {
  readonly filters: InboxFilters;
  readonly assignmentOptions: ReadonlyArray<{ value: string; label: string }>;
  readonly onChange: (patch: Partial<InboxFilters>) => void;
  readonly onReset: () => void;
}) {
  const hasActiveFilters =
    filters.q !== '' ||
    filters.status !== '' ||
    filters.priority !== '' ||
    filters.assignedAgentId !== '' ||
    filters.channel !== '' ||
    filters.tag !== '';

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
          aria-label="Search conversations"
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
          placeholder="Search customer, subject, or message"
        />
      </form>
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Status">
        {INBOX_STATUS_FILTERS.map((item) => (
          <button
            aria-selected={filters.status === item.value}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium',
              filters.status === item.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
            key={item.value || 'all'}
            onClick={() => {
              onChange({ status: item.value });
            }}
            role="tab"
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Select
          onValueChange={(value) => {
            onChange({ priority: value });
          }}
          options={[...PRIORITY_OPTIONS]}
          placeholder="Any priority"
          searchable={false}
          value={filters.priority}
        />
        <Select
          onValueChange={(value) => {
            onChange({ assignedAgentId: value });
          }}
          options={assignmentOptions}
          placeholder="Anyone"
          searchable
          value={filters.assignedAgentId}
        />
        <Select
          onValueChange={(value) => {
            onChange({ channel: value });
          }}
          options={[...CHANNEL_OPTIONS]}
          placeholder="Any channel"
          searchable={false}
          value={filters.channel}
        />
        <Input
          aria-label="Filter by tag"
          onBlur={(event) => {
            onChange({ tag: event.target.value.trim().toLowerCase() });
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onChange({ tag: event.currentTarget.value.trim().toLowerCase() });
            }
          }}
          placeholder="Tag"
          defaultValue={filters.tag}
          key={filters.tag}
        />
      </div>
      {hasActiveFilters ? (
        <Button
          className="self-start"
          onClick={onReset}
          size="sm"
          type="button"
          variant="ghost"
        >
          <X />
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}
