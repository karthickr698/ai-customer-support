import { type FormEvent, useState } from 'react';
import type { KnowledgeSourceDto, KnowledgeSourceType } from '@ai-customer-support/contracts';
import { KNOWLEDGE_SOURCE_TYPES } from '@ai-customer-support/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { knowledgeSourcePayload, validateKnowledgeSource } from '../validation';
import { sourceTypeLabel } from '../wizard';

const SOURCE_OPTIONS = KNOWLEDGE_SOURCE_TYPES.map((type) => ({
  value: type,
  label: sourceTypeLabel(type),
}));

export function KnowledgeSourcesStep({
  sources,
  canManage,
  pending,
  onAdd,
  onBack,
  onFinish,
}: {
  readonly sources: readonly KnowledgeSourceDto[];
  readonly canManage: boolean;
  readonly pending?: boolean;
  readonly onAdd?: (body: ReturnType<typeof knowledgeSourcePayload>) => Promise<void>;
  readonly onBack?: () => void;
  readonly onFinish?: () => void;
}) {
  const [type, setType] = useState<KnowledgeSourceType>('url');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; url?: string; description?: string }>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateKnowledgeSource({ type, name, url, description });
    setFieldErrors(errors ?? {});
    if (errors) {
      return;
    }
    await onAdd?.(knowledgeSourcePayload({ type, name, url, description }));
    setName('');
    setUrl('');
    setDescription('');
  }

  return (
    <div className="space-y-6">
      {canManage ? (
        <form aria-busy={pending} className="space-y-4" noValidate onSubmit={(event) => void onSubmit(event)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="sourceType" label="Source type" required>
              <Select
                id="sourceType"
                onValueChange={(value) => {
                  setType(value as KnowledgeSourceType);
                }}
                options={SOURCE_OPTIONS}
                searchable={false}
                value={type}
              />
            </Field>
            <Field error={fieldErrors.name} id="sourceName" label="Name" required>
              <Input
                id="sourceName"
                onChange={(event) => {
                  setName(event.target.value);
                  setFieldErrors((current) => ({ ...current, name: undefined }));
                }}
                value={name}
              />
            </Field>
          </div>
          {type === 'text' || type === 'file' ? (
            <Field error={fieldErrors.description} id="sourceDescription" label={type === 'text' ? 'Text' : 'Description'} required={type === 'text'}>
              <Textarea
                id="sourceDescription"
                onChange={(event) => {
                  setDescription(event.target.value);
                  setFieldErrors((current) => ({ ...current, description: undefined }));
                }}
                rows={4}
                value={description}
              />
            </Field>
          ) : (
            <>
              <Field error={fieldErrors.url} id="sourceUrl" label="URL" required>
                <Input
                  id="sourceUrl"
                  onChange={(event) => {
                    setUrl(event.target.value);
                    setFieldErrors((current) => ({ ...current, url: undefined }));
                  }}
                  placeholder="https://help.example.com"
                  type="url"
                  value={url}
                />
              </Field>
              <Field id="sourceDescription" label="Description">
                <Input id="sourceDescription" onChange={(event) => setDescription(event.target.value)} value={description} />
              </Field>
            </>
          )}
          <Button disabled={pending} type="submit">
            {pending ? (
              <>
                <Spinner label="Registering source" />
                Adding source…
              </>
            ) : (
              'Add knowledge source'
            )}
          </Button>
        </form>
      ) : null}

      {sources.length === 0 ? (
        <EmptyState
          description={
            canManage
              ? 'Register a help center, sitemap, or URL so the assistant can answer from your docs.'
              : 'No knowledge sources have been registered yet.'
          }
          title="No knowledge sources yet"
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.map((source) => (
              <TableRow key={source.id}>
                <TableCell>{source.name}</TableCell>
                <TableCell>{sourceTypeLabel(source.type)}</TableCell>
                <TableCell>
                  <Badge variant={source.status === 'failed' ? 'destructive' : 'secondary'}>{source.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="flex flex-wrap gap-2">
        {onBack ? (
          <Button onClick={onBack} type="button" variant="outline">
            Back
          </Button>
        ) : null}
        {onFinish ? (
          <Button onClick={onFinish} type="button">
            Finish setup
          </Button>
        ) : null}
      </div>
    </div>
  );
}

