import { type FormEvent, useMemo, useState } from 'react';
import type {
  KnowledgeDocumentKind,
  KnowledgeDocumentListResponse,
  RagPlaygroundRequest,
  RagPlaygroundResponse,
  RetrievedKnowledgeChunkDto,
} from '@ai-customer-support/contracts';
import { FlaskConical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { hasPermission } from '@/features/organizations/permissions';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { knowledgeApi } from '../api';
import { documentKindLabel, formatRetrievalScore } from '../labels';

const KIND_OPTIONS: readonly KnowledgeDocumentKind[] = ['article', 'url', 'pdf', 'docx'];

export function KnowledgePlaygroundPage() {
  const { organizationId, permissions } = useWorkspace();
  const canManage = hasPermission(permissions, 'knowledge.manage');
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState('5');
  const [generate, setGenerate] = useState(true);
  const [kinds, setKinds] = useState<KnowledgeDocumentKind[]>([]);
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  const [titleContains, setTitleContains] = useState('');
  const [sourceUri, setSourceUri] = useState('');
  const [result, setResult] = useState<RagPlaygroundResponse | null>(null);
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);

  const documents = useApiQuery<KnowledgeDocumentListResponse>({
    queryKey: queryKeys.knowledge.documents(organizationId),
    path: `/api/organizations/${organizationId}/knowledge/documents`,
    enabled: canManage,
  });

  const run = useApiMutation({
    mutationFn: (body: RagPlaygroundRequest) => knowledgeApi.runPlayground(organizationId, body),
    errorMessage: undefined,
    onSuccess: (payload) => {
      setResult(payload);
      setSelectedChunkId(payload.chunks[0]?.id ?? null);
    },
  });

  const documentOptions = useMemo(
    () =>
      (documents.data?.items ?? []).map((document) => ({
        value: document.id,
        label: document.title,
        description: `${documentKindLabel(document.kind)} · ${document.status}`,
      })),
    [documents.data?.items],
  );

  const selectedChunk = result?.chunks.find((chunk) => chunk.id === selectedChunkId) ?? null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedTopK = Number.parseInt(topK, 10);
    await run.mutateAsync({
      query,
      topK: Number.isFinite(parsedTopK) ? parsedTopK : undefined,
      generate,
      filters: {
        documentIds: documentIds.length > 0 ? documentIds : undefined,
        kinds: kinds.length > 0 ? kinds : undefined,
        titleContains: titleContains.trim() || undefined,
        sourceUri: sourceUri.trim() || undefined,
      },
    });
  }

  function toggleKind(kind: KnowledgeDocumentKind): void {
    setKinds((current) => (current.includes(kind) ? current.filter((item) => item !== kind) : [...current, kind]));
  }

  if (!canManage) {
    return (
      <EmptyState
        description="You need knowledge.manage to run retrieval tests against this workspace."
        icon={<FlaskConical className="size-8" />}
        title="Playground is limited to knowledge admins"
      />
    );
  }

  return (
    <>
      <PageHeader
        description="Test a query against the tenant-scoped index. Inspect retrieved chunks, scores, sources, applied filters, and the generated reply."
        title="RAG playground"
      />

      <form className="grid gap-6 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]" onSubmit={onSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Query</CardTitle>
            <CardDescription>Filters are applied in the vector search, not in the prompt.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field id="playground-query" label="Visitor question" required>
              <Textarea
                onChange={(event) => setQuery(event.target.value)}
                placeholder="How long do refunds take?"
                required
                rows={5}
                value={query}
              />
            </Field>
            <Field id="playground-top-k" hint="Clamped to 1–20 by the AI service." label="Top K">
              <Input
                max={20}
                min={1}
                onChange={(event) => setTopK(event.target.value)}
                type="number"
                value={topK}
              />
            </Field>
            <Field label="Document kinds">
              <div className="flex flex-wrap gap-3">
                {KIND_OPTIONS.map((kind) => (
                  <label className="flex items-center gap-2 text-sm" key={kind}>
                    <Checkbox
                      checked={kinds.includes(kind)}
                      onCheckedChange={() => {
                        toggleKind(kind);
                      }}
                    />
                    {documentKindLabel(kind)}
                  </label>
                ))}
              </div>
            </Field>
            <Field id="playground-documents" hint="Leave empty to search the whole tenant index." label="Documents">
              <Select
                emptyMessage="No indexed documents"
                multiple
                onValueChange={setDocumentIds}
                options={documentOptions}
                placeholder="All documents"
                searchPlaceholder="Filter documents"
                value={documentIds}
              />
            </Field>
            <Field id="playground-title" label="Title contains">
              <Input
                onChange={(event) => setTitleContains(event.target.value)}
                placeholder="Refund"
                value={titleContains}
              />
            </Field>
            <Field id="playground-source" label="Source URI">
              <Input
                onChange={(event) => setSourceUri(event.target.value)}
                placeholder="https://help.example.com/refunds"
                value={sourceUri}
              />
            </Field>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                <span className="font-medium">Generate a reply</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Uses the retrieved excerpts as knowledge context.
                </span>
              </span>
              <Switch checked={generate} onCheckedChange={setGenerate} />
            </label>
            <Button disabled={run.isPending || query.trim() === ''} type="submit">
              {run.isPending ? 'Running…' : 'Run query'}
            </Button>
          </CardContent>
        </Card>

        <div className="flex min-w-0 flex-col gap-6">
          {result ? (
            <PlaygroundResult result={result} selectedChunk={selectedChunk} onSelectChunk={setSelectedChunkId} />
          ) : (
            <EmptyState
              description="Run a query to inspect retrieved chunks, hybrid scores, source documents, and the generated answer."
              icon={<FlaskConical className="size-8" />}
              title="No playground run yet"
            />
          )}
        </div>
      </form>
    </>
  );
}

function PlaygroundResult({
  result,
  selectedChunk,
  onSelectChunk,
}: {
  readonly result: RagPlaygroundResponse;
  readonly selectedChunk: RetrievedKnowledgeChunkDto | null;
  readonly onSelectChunk: (chunkId: string) => void;
}) {
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{result.chunks.length} chunks</Badge>
        <Badge variant="secondary">{result.sources.length} sources</Badge>
        <Badge variant="outline">topK {result.topK}</Badge>
        <Badge variant="outline">{result.latencyMs} ms total</Badge>
        <Badge variant="outline">{result.retrieveMs} ms retrieve</Badge>
        {result.generateMs !== null ? <Badge variant="outline">{result.generateMs} ms generate</Badge> : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Applied filters</CardTitle>
          <CardDescription>Echo of the tenant-scoped filters used for this search.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {result.filters.documentIds.length === 0 &&
          result.filters.kinds.length === 0 &&
          !result.filters.sourceUri &&
          !result.filters.titleContains ? (
            <p className="text-sm text-muted-foreground">No metadata filters. Search used the full tenant index.</p>
          ) : (
            <>
              {result.filters.kinds.map((kind) => (
                <Badge key={`kind-${kind}`} variant="secondary">
                  kind: {documentKindLabel(kind)}
                </Badge>
              ))}
              {result.filters.documentIds.map((documentId) => (
                <Badge key={documentId} variant="secondary">
                  document: {documentId.slice(0, 8)}…
                </Badge>
              ))}
              {result.filters.titleContains ? (
                <Badge variant="secondary">title: {result.filters.titleContains}</Badge>
              ) : null}
              {result.filters.sourceUri ? <Badge variant="secondary">source: {result.filters.sourceUri}</Badge> : null}
            </>
          )}
        </CardContent>
      </Card>

      {result.generate ? (
        <Card>
          <CardHeader>
            <CardTitle>Generated response</CardTitle>
            <CardDescription>
              {result.generation
                ? `${result.generation.model} · ${result.generation.promptTokens} prompt / ${result.generation.completionTokens} completion tokens`
                : 'No reply was produced.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {result.generation ? (
              <p className="whitespace-pre-wrap text-sm leading-6">{result.generation.content}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Generation was requested but returned empty.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Sources</CardTitle>
          <CardDescription>Documents that contributed at least one retrieved chunk, ranked by max score.</CardDescription>
        </CardHeader>
        <CardContent>
          {result.sources.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sources matched this query and filter set.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Chunks</TableHead>
                  <TableHead>Max score</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.sources.map((source) => (
                  <TableRow key={source.documentId}>
                    <TableCell className="font-medium">{source.title}</TableCell>
                    <TableCell>{documentKindLabel(source.kind)}</TableCell>
                    <TableCell>{source.chunkCount}</TableCell>
                    <TableCell>{formatRetrievalScore(source.maxScore)}</TableCell>
                    <TableCell className="max-w-56 truncate text-muted-foreground">
                      {source.sourceUri ?? source.documentId}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Retrieved chunks</CardTitle>
          <CardDescription>Hybrid rank plus optional vector and keyword scores after rerank.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {result.chunks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing was retrieved. Try a broader query or fewer filters.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Vector</TableHead>
                  <TableHead>Keyword</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Kind</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.chunks.map((chunk, index) => (
                  <TableRow
                    className="cursor-pointer"
                    data-state={selectedChunk?.id === chunk.id ? 'selected' : undefined}
                    key={chunk.id}
                    onClick={() => onSelectChunk(chunk.id)}
                  >
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{formatRetrievalScore(chunk.score)}</TableCell>
                    <TableCell>{formatRetrievalScore(chunk.vectorScore)}</TableCell>
                    <TableCell>{formatRetrievalScore(chunk.keywordScore)}</TableCell>
                    <TableCell className="font-medium">{chunk.title}</TableCell>
                    <TableCell>{documentKindLabel(chunk.kind)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {selectedChunk ? (
            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>chunk {selectedChunk.chunkIndex ?? '—'}</span>
                <span>v{selectedChunk.version ?? '—'}</span>
                <span>{selectedChunk.documentId}</span>
                {selectedChunk.sourceUri ? <span>{selectedChunk.sourceUri}</span> : null}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6">{selectedChunk.content}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
