import { FONT_CHOICES, PRIMARY_CHOICES, SECONDARY_CHOICES, SKIN_CHOICES } from '@/theme/tokens';
import type { FontId, SkinId, ThemeMode } from '@/theme/types';
import { useThemeStore } from '@/theme/theme-store';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const MODE_OPTIONS = [
  { value: 'light', label: 'Light', description: 'Always use the light skin' },
  { value: 'dark', label: 'Dark', description: 'Always use the dark skin' },
  { value: 'system', label: 'System', description: 'Follow the operating system' },
] as const;

function SwatchGrid<T extends string>({
  value,
  choices,
  onChange,
}: {
  readonly value: T;
  readonly choices: ReadonlyArray<{ readonly id: T; readonly label: string; readonly swatch?: string }>;
  readonly onChange: (id: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {choices.map((choice) => {
        const selected = choice.id === value;

        return (
          <button
            key={choice.id}
            type="button"
            title={choice.label}
            onClick={() => {
              onChange(choice.id);
            }}
            className={cn(
              'flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm transition-colors',
              selected
                ? 'border-primary bg-primary/10 text-foreground ring-2 ring-ring/40'
                : 'border-input bg-background hover:bg-accent',
            )}
          >
            {choice.swatch ? (
              <span className="size-3.5 rounded-full border border-black/10" style={{ background: choice.swatch }} />
            ) : null}
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}

export function ThemeCustomizer() {
  const primary = useThemeStore((state) => state.primary);
  const secondary = useThemeStore((state) => state.secondary);
  const font = useThemeStore((state) => state.font);
  const skin = useThemeStore((state) => state.skin);
  const mode = useThemeStore((state) => state.mode);
  const setPrimary = useThemeStore((state) => state.setPrimary);
  const setSecondary = useThemeStore((state) => state.setSecondary);
  const setFont = useThemeStore((state) => state.setFont);
  const setSkin = useThemeStore((state) => state.setSkin);
  const setMode = useThemeStore((state) => state.setMode);
  const resetTheme = useThemeStore((state) => state.resetTheme);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Field label="Primary color" hint="Used for buttons, focus rings, and brand emphasis.">
        <SwatchGrid value={primary} choices={PRIMARY_CHOICES} onChange={setPrimary} />
      </Field>
      <Field label="Secondary color" hint="Used for chips, muted surfaces, and secondary actions.">
        <SwatchGrid value={secondary} choices={SECONDARY_CHOICES} onChange={setSecondary} />
      </Field>
      <Field id="theme-font" label="Font" hint="Applied globally to the product UI.">
        <Select
          id="theme-font"
          value={font}
          placeholder="Choose a font"
          options={FONT_CHOICES.map((choice) => ({
            value: choice.id,
            label: choice.label,
            description: choice.description,
          }))}
          onValueChange={(value) => {
            setFont(value as FontId);
          }}
        />
      </Field>
      <Field id="theme-skin" label="Skin" hint="Controls radius, chrome, and surface tint.">
        <Select
          id="theme-skin"
          value={skin}
          placeholder="Choose a skin"
          options={SKIN_CHOICES.map((choice) => ({
            value: choice.id,
            label: choice.label,
            description: choice.description,
          }))}
          onValueChange={(value) => {
            setSkin(value as SkinId);
          }}
        />
      </Field>
      <Field id="theme-mode" label="Color mode">
        <Select
          id="theme-mode"
          value={mode}
          placeholder="Choose a mode"
          options={[...MODE_OPTIONS]}
          onValueChange={(value) => {
            setMode(value as ThemeMode);
          }}
        />
      </Field>
      <div className="flex items-end">
        <button
          type="button"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          onClick={() => {
            resetTheme();
          }}
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}
