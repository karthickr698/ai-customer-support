import { type FormEvent, useState } from 'react';
import type { KnowledgeDocumentKind, KnowledgeDocumentListResponse } from '@ai-customer-support/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { hasPermission } from '@/features/organizations/permissions';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { knowledgeApi } from '../api';

type AddKind = Extract<KnowledgeDocumentKind, 'url' | 'article'>;

export function KnowledgeSourcesPage() {
  const { organizationId, permissions } = useWorkspace();
  const [kind, setKind] = useState<AddKind>('url');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [articleText, setArticleText] = useState('');
  const [fileTitle, setFileTitle] = useState('');
  const canManage = hasPermission(permissions, 'knowledge.manage');

  const documents = useApiQuery<KnowledgeDocumentListResponse>({
    queryKey: queryKeys.knowledge.documents(organizationId),
    path: `/api/organizations/${organizationId}/knowledge/documents`,
  });

  const register = useApiMutation({
    mutationFn: () =>
      knowledgeApi.registerDocument(organizationId, {
        kind,
        title,
        url: kind === 'url' ? url : undefined,
        articleText: kind === 'article' ? articleText : undefined,
      }),
    invalidateKeys: [queryKeys.knowledge.documents(organizationId)],
    successMessage: 'Document queued for ingestion',
  });
  const upload = useApiMutation({
    mutationFn: (file: File) => knowledgeApi.uploadDocument(organizationId, file, fileTitle || undefined),
    invalidateKeys: [queryKeys.knowledge.documents(organizationId)],
    successMessage: 'File queued for ingestion',
  });
  const reindex = useApiMutation({
    mutationFn: (documentId: string) => knowledgeApi.reindexDocument(organizationId, documentId),
    invalidateKeys: [queryKeys.knowledge.documents(organizationId)],
    successMessage: 'Re-index started',
  });
  const remove = useApiMutation({
    mutationFn: (documentId: string) => knowledgeApi.deleteDocument(organizationId, documentId),
    invalidateKeys: [queryKeys.knowledge.documents(organizationId)],
    successMessage: 'Document removed',
  });

  async function onRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await register.mutateAsync();
    setTitle('');
    setUrl('');
    setArticleText('');
  }

  async function onUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem('file') as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      return;
    }
    await upload.mutateAsync(file);
    form.reset();
    setFileTitle('');
  }

  const items = documents.data?.items ?? [];

  return (
    <>
      <PageHeader
        description="Ingest PDFs, DOCX files, URLs, and pasted text. Parsing, chunking, and embeddings run in the AI service."
        title="Knowledge sources"
      />

      {canManage ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Add URL or pasted article</CardTitle>
              <CardDescription>Use the Articles tab for drafted, categorized knowledge-base content.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="flex flex-col gap-4" onSubmit={onRegister}>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input checked={kind === 'url'} onChange={() => setKind('url')} type="radio" />
                    URL
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input checked={kind === 'article'} onChange={() => setKind('article')} type="radio" />
                    Pasted text
                  </label>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" onChange={(event) => setTitle(event.target.value)} required value={title} />
                </div>
                {kind === 'url' ? (
                  <div className="grid gap-2">
                    <Label htmlFor="url">URL</Label>
                    <Input
                      id="url"
                      onChange={(event) => setUrl(event.target.value)}
                      placeholder="https://example.com/help"
                      required
                      type="url"
                      value={url}
                    />
                  </div>
                ) : (
                  <div className="grid gap-2">
                    <Label htmlFor="article">Article text</Label>
                    <Textarea id="article" onChange={(event) => setArticleText(event.target.value)} required value={articleText} />
                  </div>
                )}
                <Button disabled={register.isPending} type="submit">
                  Ingest
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upload PDF or DOCX</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="flex flex-col gap-4" onSubmit={onUpload}>
                <div className="grid gap-2">
                  <Label htmlFor="fileTitle">Title (optional)</Label>
                  <Input id="fileTitle" onChange={(event) => setFileTitle(event.target.value)} value={fileTitle} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="file">File</Label>
                  <Input
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    id="file"
                    name="file"
                    required
                    type="file"
                  />
                </div>
                <Button disabled={upload.isPending} type="submit">
                  Upload and ingest
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Indexed documents</CardTitle>
          <CardDescription>Published articles also appear here after they are queued for RAG.</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState
              description="Add a URL, file, or publish an article to start the ingestion pipeline."
              title="No knowledge documents yet"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Chunks</TableHead>
                  {canManage ? <TableHead /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((document) => (
                  <TableRow key={document.id}>
                    <TableCell>{document.title}</TableCell>
                    <TableCell>{document.kind}</TableCell>
                    <TableCell>
                      <Badge variant={document.status === 'failed' ? 'destructive' : 'secondary'}>
                        {document.status}
                      </Badge>
                    </TableCell>
                    <TableCell>v{document.version}</TableCell>
                    <TableCell>{document.chunkCount}</TableCell>
                    {canManage ? (
                      <TableCell className="text-right">
                        <Button
                          disabled={document.status === 'processing' || reindex.isPending}
                          onClick={() => reindex.mutate(document.id)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Re-index
                        </Button>
                        <Button
                          onClick={() => remove.mutate(document.id)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Delete
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
