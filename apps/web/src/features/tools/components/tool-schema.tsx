import type { JsonSchemaProperty, ToolArgumentSchema } from '@ai-customer-support/contracts';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { JsonPreview } from './json-preview';

function propertyType(property: JsonSchemaProperty): string {
  const parts: string[] = [property.type];
  if (property.format) {
    parts.push(property.format);
  }
  if (property.enum) {
    parts.push(`enum: ${property.enum.join(', ')}`);
  }
  return parts.join(' · ');
}

export function ToolSchema({ schema }: { readonly schema: ToolArgumentSchema }) {
  const required = new Set(schema.required);
  const entries = Object.entries(schema.properties);

  return (
    <div className="space-y-3">
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">This tool takes no arguments.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Argument</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Rules</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map(([name, property]) => (
              <TableRow key={name}>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="text-xs">{name}</code>
                    {required.has(name) ? <Badge variant="secondary">Required</Badge> : null}
                  </div>
                  {property.description ? (
                    <p className="mt-1 text-xs text-muted-foreground">{property.description}</p>
                  ) : null}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{propertyType(property)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {[
                    property.minLength !== undefined ? `min ${String(property.minLength)}` : null,
                    property.maxLength !== undefined ? `max ${String(property.maxLength)}` : null,
                    property.minimum !== undefined ? `≥ ${String(property.minimum)}` : null,
                    property.maximum !== undefined ? `≤ ${String(property.maximum)}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <JsonPreview label="JSON schema" value={schema} />
    </div>
  );
}
