import type { JsonSchemaProperty, ToolArgumentSchema } from '@ai-customer-support/contracts';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

type ArgumentFieldsProps = {
  readonly schema: ToolArgumentSchema;
  readonly values: Record<string, string>;
  readonly errors: Record<string, string>;
  readonly disabled?: boolean;
  readonly onChange: (name: string, value: string) => void;
};

function fieldType(property: JsonSchemaProperty): string {
  if (property.format === 'email') {
    return 'email';
  }
  if (property.format === 'uri') {
    return 'url';
  }
  if (property.type === 'integer' || property.type === 'number') {
    return 'number';
  }
  return 'text';
}

export function ArgumentFields({ schema, values, errors, disabled = false, onChange }: ArgumentFieldsProps) {
  const required = new Set(schema.required);
  const entries = Object.entries(schema.properties);

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">This tool takes no arguments.</p>;
  }

  return (
    <div className="grid gap-4">
      {entries.map(([name, property]) => {
        const id = `tool-arg-${name}`;
        const isRequired = required.has(name);
        const value = values[name] ?? '';
        const error = errors[name];

        if (property.type === 'boolean') {
          return (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2" key={name}>
              <div>
                <p className="text-sm font-medium">{name}</p>
                {property.description ? (
                  <p className="text-xs text-muted-foreground">{property.description}</p>
                ) : null}
              </div>
              <Switch
                checked={value === 'true'}
                disabled={disabled}
                id={id}
                onCheckedChange={(checked) => {
                  onChange(name, checked ? 'true' : 'false');
                }}
              />
            </div>
          );
        }

        if (property.enum) {
          return (
            <Field error={error} hint={property.description} id={id} key={name} label={name} required={isRequired}>
              <Select
                disabled={disabled}
                id={id}
                onValueChange={(next) => {
                  onChange(name, next);
                }}
                options={property.enum.map((option) => ({ value: option, label: option }))}
                placeholder="Select…"
                searchable={false}
                value={value}
              />
            </Field>
          );
        }

        const longText = (property.maxLength ?? 0) > 200 || name === 'description' || name === 'note' || name === 'reason';
        if (longText) {
          return (
            <Field error={error} hint={property.description} id={id} key={name} label={name} required={isRequired}>
              <Textarea
                disabled={disabled}
                id={id}
                maxLength={property.maxLength}
                onChange={(event) => {
                  onChange(name, event.target.value);
                }}
                rows={4}
                value={value}
              />
            </Field>
          );
        }

        return (
          <Field error={error} hint={property.description} id={id} key={name} label={name} required={isRequired}>
            <Input
              disabled={disabled}
              id={id}
              max={property.maximum}
              maxLength={property.maxLength}
              min={property.minimum}
              onChange={(event) => {
                onChange(name, event.target.value);
              }}
              step={property.type === 'integer' ? 1 : undefined}
              type={fieldType(property)}
              value={value}
            />
          </Field>
        );
      })}
    </div>
  );
}
