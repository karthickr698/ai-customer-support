import { type KeyboardEvent, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

type TagInputProps = {
  readonly id?: string;
  readonly value: readonly string[];
  readonly suggestions?: readonly string[];
  readonly disabled?: boolean;
  readonly onChange: (tags: string[]) => void;
};

export function TagInput({ id, value, suggestions = [], disabled, onChange }: TagInputProps) {
  const [draft, setDraft] = useState('');
  const available = useMemo(
    () => suggestions.filter((tag) => !value.includes(tag) && tag.includes(draft.trim().toLowerCase())),
    [draft, suggestions, value],
  );

  function addTag(raw: string): void {
    const tag = raw.trim().toLowerCase();
    if (!tag || value.includes(tag) || value.length >= 12) {
      return;
    }
    onChange([...value, tag]);
    setDraft('');
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addTag(draft);
    }
    if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1">
        {value.map((tag) => (
          <Badge className="gap-1 pr-1" key={tag} variant="secondary">
            {tag}
            {disabled ? null : (
              <button
                aria-label={`Remove ${tag}`}
                className="rounded-sm p-0.5 hover:bg-foreground/10"
                onClick={() => onChange(value.filter((item) => item !== tag))}
                type="button"
              >
                <X className="size-3" />
              </button>
            )}
          </Badge>
        ))}
        <Input
          className="h-7 min-w-32 flex-1 border-0 p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          disabled={disabled}
          id={id}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={value.length === 0 ? 'Add a tag and press Enter' : ''}
          value={draft}
        />
      </div>
      {available.length > 0 && draft.trim() ? (
        <div className="flex flex-wrap gap-1">
          {available.slice(0, 8).map((tag) => (
            <ButtonLikeTag key={tag} onSelect={() => addTag(tag)} tag={tag} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ButtonLikeTag({ tag, onSelect }: { readonly tag: string; readonly onSelect: () => void }) {
  return (
    <button
      className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      onClick={onSelect}
      type="button"
    >
      {tag}
    </button>
  );
}
