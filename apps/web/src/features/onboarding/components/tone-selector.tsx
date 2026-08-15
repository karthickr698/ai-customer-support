import type { SupportToneId, SupportTonePresetDto } from '@ai-customer-support/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

export function ToneSelector({
  presets,
  selectedToneId,
  pending,
  disabled,
  onChange,
  onContinue,
  onBack,
}: {
  readonly presets: readonly SupportTonePresetDto[];
  readonly selectedToneId: SupportToneId | null;
  readonly pending?: boolean;
  readonly disabled?: boolean;
  readonly onChange: (toneId: SupportToneId) => void;
  readonly onContinue?: () => void;
  readonly onBack?: () => void;
}) {
  return (
    <div className="space-y-4">
      <RadioGroup
        aria-label="Support tone"
        className="grid gap-3"
        disabled={disabled}
        onValueChange={(value) => {
          onChange(value as SupportToneId);
        }}
        value={selectedToneId ?? undefined}
      >
        {presets.map((preset) => {
          const selected = preset.id === selectedToneId;
          return (
            <label
              className={cn(
                'flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors',
                selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/40',
              )}
              htmlFor={`tone-${preset.id}`}
              key={preset.id}
            >
              <RadioGroupItem className="mt-1" id={`tone-${preset.id}`} value={preset.id} />
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{preset.name}</p>
                  {preset.recommended ? <Badge variant="secondary">Recommended</Badge> : null}
                </div>
                <p className="text-sm text-muted-foreground">{preset.description}</p>
                <p className="text-sm leading-6">{preset.voiceGuidelines}</p>
                <blockquote className="border-l-2 border-border pl-3 text-sm text-muted-foreground italic">
                  {preset.exampleReply}
                </blockquote>
              </div>
            </label>
          );
        })}
      </RadioGroup>
      {onContinue || onBack ? (
        <div className="flex flex-wrap gap-2">
          {onBack ? (
            <Button onClick={onBack} type="button" variant="outline">
              Back
            </Button>
          ) : null}
          {onContinue ? (
            <Button disabled={pending || !selectedToneId} onClick={onContinue} type="button">
              {pending ? (
                <>
                  <Spinner label="Generating agent settings" />
                  Generating assistant…
                </>
              ) : (
                'Use this tone'
              )}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
