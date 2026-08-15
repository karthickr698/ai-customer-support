import { Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PASSWORD_MIN_LENGTH, passwordRequirements } from '../validation';

export function PasswordRequirements({ value }: { readonly value: string }) {
  const requirements = passwordRequirements(value);
  const items = [
    { key: 'length', met: requirements.length, label: `At least ${String(PASSWORD_MIN_LENGTH)} characters` },
    { key: 'letter', met: requirements.letter, label: 'Includes a letter' },
    { key: 'number', met: requirements.number, label: 'Includes a number' },
  ] as const;

  return (
    <ul aria-label="Password requirements" className="space-y-1">
      {items.map((item) => (
        <li
          className={cn(
            'flex items-center gap-2 text-xs',
            item.met ? 'text-success' : 'text-muted-foreground',
          )}
          key={item.key}
        >
          {item.met ? <Check className="size-3.5" aria-hidden="true" /> : <Circle className="size-3.5" aria-hidden="true" />}
          <span>
            {item.label}
            <span className="sr-only">{item.met ? ' — met' : ' — not met'}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
