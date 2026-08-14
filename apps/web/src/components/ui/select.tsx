import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { useMemo, useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from './badge';
import { Input } from './input';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { ScrollArea } from './scroll-area';
import { Separator } from './separator';

export type SelectOption = {
  readonly value: string;
  readonly label: string;
  readonly description?: string;
  readonly disabled?: boolean;
};

type SelectBaseProps = {
  readonly options: readonly SelectOption[];
  readonly placeholder?: string;
  readonly searchPlaceholder?: string;
  readonly emptyMessage?: string;
  readonly disabled?: boolean;
  readonly invalid?: boolean;
  readonly searchable?: boolean;
  readonly className?: string;
  readonly id?: string;
};

export type SingleSelectProps = SelectBaseProps & {
  readonly multiple?: false;
  readonly value?: string;
  readonly onValueChange?: (value: string) => void;
};

export type MultiSelectProps = SelectBaseProps & {
  readonly multiple: true;
  readonly value?: readonly string[];
  readonly onValueChange?: (value: string[]) => void;
};

export type SelectProps = SingleSelectProps | MultiSelectProps;

function OptionCheck({ checked, multiple }: { readonly checked: boolean; readonly multiple: boolean }) {
  if (!multiple) {
    return (
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
        {checked ? <Check className="size-4 text-primary" /> : null}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border border-primary shadow-sm',
        checked && 'bg-primary text-primary-foreground',
      )}
    >
      {checked ? <Check className="size-3.5" /> : null}
    </span>
  );
}

function optionByValue(options: readonly SelectOption[], value: string): SelectOption | undefined {
  return options.find((option) => option.value === value);
}

export function Select(props: SelectProps) {
  const {
    options,
    placeholder = 'Select…',
    searchPlaceholder = 'Search…',
    emptyMessage = 'No results found',
    disabled = false,
    invalid = false,
    searchable = true,
    className,
    id,
  } = props;

  const multiple = props.multiple === true;
  const selectedValues = useMemo(() => {
    if (props.multiple) {
      return props.value ?? [];
    }

    return props.value ? [props.value] : [];
  }, [props]);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') {
      return options;
    }

    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(needle) ||
        option.value.toLowerCase().includes(needle) ||
        (option.description?.toLowerCase().includes(needle) ?? false),
    );
  }, [options, query]);

  const selectedOptions = selectedValues
    .map((value) => optionByValue(options, value))
    .filter((option): option is SelectOption => option !== undefined);

  function emit(next: string[]): void {
    if (props.multiple) {
      props.onValueChange?.(next);
      return;
    }

    props.onValueChange?.(next[0] ?? '');
  }

  function toggle(value: string): void {
    if (multiple) {
      const exists = selectedValues.includes(value);
      emit(exists ? selectedValues.filter((item) => item !== value) : [...selectedValues, value]);
      return;
    }

    emit([value]);
    setOpen(false);
    setQuery('');
  }

  function clearAll(event?: { stopPropagation: () => void }): void {
    event?.stopPropagation();
    emit([]);
  }

  function removeValue(value: string, event: { stopPropagation: () => void }): void {
    event.stopPropagation();
    emit(selectedValues.filter((item) => item !== value));
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (event.key === 'Backspace' && query === '' && selectedValues.length > 0 && multiple) {
      const last = selectedValues[selectedValues.length - 1];
      if (last) {
        emit(selectedValues.slice(0, -1));
      }
    }
  }

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((option) => option.disabled || selectedValues.includes(option.value));

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery('');
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-expanded={open}
          aria-haspopup="listbox"
          onKeyDown={onTriggerKeyDown}
          className={cn(
            'flex min-h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-2.5 py-1 text-left text-sm shadow-sm transition-colors',
            'hover:bg-accent/40',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'aria-invalid:border-destructive aria-invalid:ring-destructive/30',
            className,
          )}
        >
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {selectedOptions.length === 0 ? (
              <span className="px-0.5 text-muted-foreground">{placeholder}</span>
            ) : multiple ? (
              selectedOptions.map((option) => (
                <Badge key={option.value} variant="secondary" className="gap-1 py-0.5 pr-1 font-medium">
                  {option.label}
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={`Remove ${option.label}`}
                    className="rounded-sm p-0.5 hover:bg-foreground/10"
                    onClick={(event) => {
                      removeValue(option.value, event);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        removeValue(option.value, event);
                      }
                    }}
                  >
                    <X className="size-3" />
                  </span>
                </Badge>
              ))
            ) : (
              <span className="truncate px-0.5">{selectedOptions[0]?.label}</span>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
            {selectedValues.length > 0 ? (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Clear selection"
                className="rounded-sm p-0.5 hover:bg-accent hover:text-foreground"
                onClick={clearAll}
              >
                <X className="size-3.5" />
              </span>
            ) : null}
            <ChevronsUpDown className="size-4 opacity-60" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        onOpenAutoFocus={(event) => {
          if (!searchable) {
            event.preventDefault();
          }
        }}
      >
        {searchable ? (
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder={searchPlaceholder}
              className="h-8 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
        ) : null}
        {multiple && filtered.length > 0 ? (
          <>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                if (allVisibleSelected) {
                  const visible = new Set(filtered.map((option) => option.value));
                  emit(selectedValues.filter((value) => !visible.has(value)));
                  return;
                }

                const merged = new Set(selectedValues);
                for (const option of filtered) {
                  if (!option.disabled) {
                    merged.add(option.value);
                  }
                }
                emit([...merged]);
              }}
            >
              <OptionCheck checked={allVisibleSelected} multiple />
              <span>{allVisibleSelected ? 'Clear visible' : 'Select all visible'}</span>
            </button>
            <Separator />
          </>
        ) : null}
        <ScrollArea className="max-h-64">
          <div role="listbox" aria-multiselectable={multiple} className="p-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
            ) : (
              filtered.map((option) => {
                const selected = selectedValues.includes(option.value);

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={option.disabled}
                    className={cn(
                      'flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm',
                      'hover:bg-accent hover:text-accent-foreground',
                      'disabled:cursor-not-allowed disabled:opacity-50',
                      selected && 'bg-accent/60',
                    )}
                    onClick={() => {
                      toggle(option.value);
                    }}
                  >
                    <OptionCheck checked={selected} multiple={multiple} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{option.label}</span>
                      {option.description ? (
                        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export function MultiSelect(props: Omit<MultiSelectProps, 'multiple'>) {
  return <Select {...props} multiple />;
}
