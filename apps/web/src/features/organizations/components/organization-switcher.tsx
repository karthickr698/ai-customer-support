import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { OrganizationWithMembershipDto } from '@ai-customer-support/contracts';
import { Check, ChevronsUpDown, Plus, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { initials } from '../format';
import { roleLabel } from '../permissions';
import { switchWorkspacePath } from '../workspace-paths';

type OrganizationSwitcherProps = {
  readonly current: OrganizationWithMembershipDto;
  readonly organizations: readonly OrganizationWithMembershipDto[];
  readonly onCreateWorkspace: () => void;
  readonly onNavigate?: () => void;
};

export function OrganizationSwitcher({
  current,
  organizations,
  onCreateWorkspace,
  onNavigate,
}: OrganizationSwitcherProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') {
      return organizations;
    }

    return organizations.filter(
      (organization) =>
        organization.name.toLowerCase().includes(needle) || organization.slug.toLowerCase().includes(needle),
    );
  }, [organizations, query]);

  function switchTo(organization: OrganizationWithMembershipDto): void {
    setOpen(false);
    setQuery('');
    onNavigate?.();
    if (organization.id === current.id) {
      return;
    }
    void navigate(switchWorkspacePath(location.pathname, current.id, organization.id));
  }

  return (
    <Popover
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery('');
        }
      }}
      open={open}
    >
      <PopoverTrigger asChild>
        <button
          aria-expanded={open}
          aria-haspopup="listbox"
          className={cn(
            'flex w-full items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar px-2 py-2 text-left text-sm',
            'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            'focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
          )}
          type="button"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
            {initials(current.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{current.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{roleLabel(current.membership.role)}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0" side="bottom">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            className="h-8 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder="Search workspaces…"
            value={query}
          />
        </div>
        <ScrollArea className="max-h-64">
          <div className="p-1" role="listbox">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">No workspaces found</p>
            ) : (
              filtered.map((organization) => {
                const selected = organization.id === current.id;
                return (
                  <button
                    aria-selected={selected}
                    className={cn(
                      'flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent',
                      selected && 'bg-accent/60',
                    )}
                    key={organization.id}
                    onClick={() => {
                      switchTo(organization);
                    }}
                    role="option"
                    type="button"
                  >
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                      {selected ? <Check className="size-4 text-primary" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">{organization.name}</span>
                        <Badge variant="secondary">{roleLabel(organization.membership.role)}</Badge>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{organization.slug}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
        <Separator />
        <div className="p-1">
          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
            onClick={() => {
              setOpen(false);
              onNavigate?.();
              onCreateWorkspace();
            }}
            type="button"
          >
            <Plus className="size-4" />
            Create workspace
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
            onClick={() => {
              setOpen(false);
              onNavigate?.();
              void navigate('/organizations');
            }}
            type="button"
          >
            All workspaces
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
