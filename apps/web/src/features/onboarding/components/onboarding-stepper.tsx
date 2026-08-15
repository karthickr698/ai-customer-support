import type { ReactNode } from 'react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { STEP_LABELS, WIZARD_STEPS, stepIndex, type WizardStep } from '../wizard';

export function OnboardingStepper({
  current,
  completedThrough,
  onSelect,
}: {
  readonly current: WizardStep;
  readonly completedThrough?: WizardStep;
  readonly onSelect?: (step: WizardStep) => void;
}) {
  const currentIndex = stepIndex(current);
  const unlockedIndex = completedThrough ? Math.max(currentIndex, stepIndex(completedThrough)) : currentIndex;
  const percent = ((currentIndex + 1) / WIZARD_STEPS.length) * 100;

  return (
    <div className="space-y-3">
      <Progress aria-label="Onboarding progress" value={percent} />
      <ol className="grid grid-cols-3 gap-1 text-center text-xs">
        {WIZARD_STEPS.map((step, index) => {
          const active = step === current;
          const reached = index <= unlockedIndex;
          const clickable = Boolean(onSelect) && reached && !active;

          return (
            <li key={step}>
              {clickable ? (
                <button
                  className="w-full truncate font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  onClick={() => {
                    onSelect?.(step);
                  }}
                  type="button"
                >
                  {STEP_LABELS[step]}
                </button>
              ) : (
                <span
                  aria-current={active ? 'step' : undefined}
                  className={cn(
                    'block truncate font-medium',
                    active ? 'text-foreground' : reached ? 'text-muted-foreground' : 'text-muted-foreground/60',
                  )}
                >
                  <span className="sr-only">
                    {active ? 'Current step: ' : reached ? 'Completed step: ' : 'Upcoming step: '}
                  </span>
                  {STEP_LABELS[step]}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function StringList({ items, empty = 'None listed' }: { readonly items: readonly string[]; readonly empty?: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground" key={item}>
          {item}
        </li>
      ))}
    </ul>
  );
}

export function Definition({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm leading-6">{children}</dd>
    </div>
  );
}
