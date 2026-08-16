import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type {
  KnowledgeArticleResponse,
  KnowledgeArticleVersionDto,
  KnowledgeArticleVersionListResponse,
  KnowledgeCategoryListResponse,
  KnowledgeTagListResponse,
  UpdateKnowledgeArticleRequest,
} from '@ai-customer-support/contracts';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/features/organizations/components/confirm-dialog';
import { hasPermission } from '@/features/organizations/permissions';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { knowledgeApi } from '../api';
import { TagInput } from '../components/tag-input';
import { VersionHistory } from '../components/version-history';
import { articleStatusLabel, articleStatusVariant, knowledgePath } from '../labels';

type DraftState = {
  title: string;
  slug: string;
  summary: string;
  body: string;
  categoryId: string;
  tags: string[];
};

const EMPTY_DRAFT: DraftState = {
  title: '',
  slug: '',
  summary: '',
  body: '',
  categoryId: '',
  tags: [],
};

export function KnowledgeArticleEditorPage() {
  const { articleId } = useParams();
  const isNew = !articleId;
  const navigate = useNavigate();
  const { organizationId, permissions } = useWorkspace();
  const canManage = hasPermission(permissions, 'knowledge.manage');
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [previewVersion, setPreviewVersion] = useState<KnowledgeArticleVersionDto>();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const articleQuery = useApiQuery<KnowledgeArticleResponse>({
    queryKey: queryKeys.knowledge.article(organizationId, articleId ?? ''),
    path: `/api/organizations/${organizationId}/knowledge/articles/${articleId ?? ''}`,
    enabled: Boolean(articleId),
  });
  const versions = useApiQuery<KnowledgeArticleVersionListResponse>({
    queryKey: queryKeys.knowledge.articleVersions(organizationId, articleId ?? ''),
    path: `/api/organizations/${organizationId}/knowledge/articles/${articleId ?? ''}/versions`,
    enabled: Boolean(articleId),
  });
  const categories = useApiQuery<KnowledgeCategoryListResponse>({
    queryKey: queryKeys.knowledge.categories(organizationId),
    path: `/api/organizations/${organizationId}/knowledge/categories`,
  });
  const tags = useApiQuery<KnowledgeTagListResponse>({
    queryKey: queryKeys.knowledge.tags(organizationId),
    path: `/api/organizations/${organizationId}/knowledge/tags`,
  });

  const article = articleQuery.data?.article;
  const invalidate = [
    queryKeys.knowledge.articles(organizationId),
    queryKeys.knowledge.article(organizationId, articleId ?? ''),
    queryKeys.knowledge.articleVersions(organizationId, articleId ?? ''),
    queryKeys.knowledge.tags(organizationId),
    queryKeys.knowledge.categories(organizationId),
    queryKeys.knowledge.documents(organizationId),
  ];

  useEffect(() => {
    if (!article) {
      return;
    }
    setDraft({
      title: article.title,
      slug: article.slug,
      summary: article.summary ?? '',
      body: article.body,
      categoryId: article.categoryId ?? '',
      tags: [...article.tags],
    });
  }, [article]);

  const create = useApiMutation({
    mutationFn: () =>
      knowledgeApi.createArticle(organizationId, {
        title: draft.title,
        slug: draft.slug || undefined,
        summary: draft.summary || undefined,
        body: draft.body,
        categoryId: draft.categoryId || undefined,
        tags: draft.tags,
      }),
    invalidateKeys: invalidate,
    successMessage: 'Draft saved',
    onSuccess: (result) => {
      void navigate(knowledgePath(organizationId, `articles/${result.article.id}`), { replace: true });
    },
  });
  const update = useApiMutation({
    mutationFn: (body: UpdateKnowledgeArticleRequest) =>
      knowledgeApi.updateArticle(organizationId, articleId ?? '', body),
    invalidateKeys: invalidate,
    successMessage: 'Draft saved',
  });
  const publish = useApiMutation({
    mutationFn: async () => {
      if (articleId) {
        await knowledgeApi.updateArticle(organizationId, articleId, toUpdateBody(draft));
        return knowledgeApi.publishArticle(organizationId, articleId);
      }
      const created = await knowledgeApi.createArticle(organizationId, {
        title: draft.title,
        slug: draft.slug || undefined,
        summary: draft.summary || undefined,
        body: draft.body,
        categoryId: draft.categoryId || undefined,
        tags: draft.tags,
      });
      const published = await knowledgeApi.publishArticle(organizationId, created.article.id);
      void navigate(knowledgePath(organizationId, `articles/${created.article.id}`), { replace: true });
      return published;
    },
    invalidateKeys: invalidate,
    successMessage: 'Article published',
  });
  const unpublish = useApiMutation({
    mutationFn: () => knowledgeApi.unpublishArticle(organizationId, articleId ?? ''),
    invalidateKeys: invalidate,
    successMessage: 'Article unpublished',
  });
  const archive = useApiMutation({
    mutationFn: () => knowledgeApi.archiveArticle(organizationId, articleId ?? ''),
    invalidateKeys: invalidate,
    successMessage: 'Article archived',
  });
  const remove = useApiMutation({
    mutationFn: () => knowledgeApi.deleteArticle(organizationId, articleId ?? ''),
    invalidateKeys: [queryKeys.knowledge.all()],
    successMessage: 'Article deleted',
    onSuccess: () => {
      void navigate(knowledgePath(organizationId));
    },
  });
  const restore = useApiMutation({
    mutationFn: (version: number) => knowledgeApi.restoreArticleVersion(organizationId, articleId ?? '', version),
    invalidateKeys: invalidate,
    successMessage: 'Version restored into the editor',
  });

  const pending =
    create.isPending ||
    update.isPending ||
    publish.isPending ||
    unpublish.isPending ||
    archive.isPending ||
    restore.isPending;
  const archived = article?.status === 'archived';
  const readOnly = !canManage || archived;

  async function onSaveDraft(): Promise<void> {
    if (isNew) {
      await create.mutateAsync();
      return;
    }
    await update.mutateAsync(toUpdateBody(draft));
  }

  if (articleId && articleQuery.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Knowledge', href: knowledgePath(organizationId) },
          { label: isNew ? 'New article' : (article?.title ?? 'Article') },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{isNew ? 'New article' : article?.title}</h1>
            {article ? (
              <Badge variant={articleStatusVariant(article.status)}>{articleStatusLabel(article.status)}</Badge>
            ) : (
              <Badge variant="secondary">Draft</Badge>
            )}
          </div>
          {article ? (
            <p className="text-sm text-muted-foreground">
              Version {article.currentVersion}
              {article.publishedVersion ? ` · published v${article.publishedVersion}` : ''}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Save a draft first, then publish to index it for AI answers.</p>
          )}
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button disabled={pending || archived || !draft.title.trim()} onClick={() => void onSaveDraft()} type="button" variant="outline">
              Save draft
            </Button>
            {article?.status === 'published' ? (
              <Button disabled={pending} onClick={() => unpublish.mutate()} type="button" variant="outline">
                Unpublish
              </Button>
            ) : null}
            <Button
              disabled={pending || archived || !draft.title.trim() || !draft.body.trim()}
              onClick={() => publish.mutate()}
              type="button"
            >
              Publish
            </Button>
            {article && article.status !== 'archived' ? (
              <Button disabled={pending} onClick={() => setArchiveOpen(true)} type="button" variant="ghost">
                Archive
              </Button>
            ) : null}
            {article ? (
              <Button disabled={pending} onClick={() => setDeleteOpen(true)} type="button" variant="ghost">
                Delete
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-4">
          <Field id="article-title" label="Title" required>
            <Input
              disabled={readOnly}
              id="article-title"
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              value={draft.title}
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field hint="Generated from the title if left blank." id="article-slug" label="Slug">
              <Input
                disabled={readOnly}
                id="article-slug"
                onChange={(event) => setDraft((current) => ({ ...current, slug: event.target.value }))}
                value={draft.slug}
              />
            </Field>
            <Field id="article-category" label="Category">
              <Select
                disabled={readOnly}
                id="article-category"
                onValueChange={(value) => setDraft((current) => ({ ...current, categoryId: value }))}
                options={(categories.data?.items ?? []).map((category) => ({
                  value: category.id,
                  label: category.name,
                }))}
                placeholder="Uncategorized"
                searchable
                value={draft.categoryId || undefined}
              />
            </Field>
          </div>
          <Field id="article-summary" label="Summary">
            <Textarea
              disabled={readOnly}
              id="article-summary"
              onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))}
              rows={3}
              value={draft.summary}
            />
          </Field>
          <Field id="article-tags" label="Tags">
            <TagInput
              disabled={readOnly}
              id="article-tags"
              onChange={(next) => setDraft((current) => ({ ...current, tags: next }))}
              suggestions={tags.data?.items ?? []}
              value={draft.tags}
            />
          </Field>
          <Tabs defaultValue="write">
            <TabsList>
              <TabsTrigger value="write">Write</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
            <TabsContent value="write">
              <Textarea
                className="min-h-[28rem] font-mono text-[0.9375rem] leading-7"
                disabled={readOnly}
                id="article-body"
                onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
                placeholder="Write the article body. Use headings, lists, and short paragraphs."
                value={draft.body}
              />
            </TabsContent>
            <TabsContent value="preview">
              <ArticlePreview body={draft.body} summary={draft.summary} title={draft.title} />
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Publishing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Drafts stay out of AI answers until you publish.</p>
              <p>Publishing snapshots this version and queues it for RAG indexing.</p>
              <p>Unpublish or archive to remove it from the index.</p>
              {article?.indexedDocumentId ? (
                <p>
                  Indexed document:{' '}
                  <Link className="text-foreground underline" to={knowledgePath(organizationId, 'sources')}>
                    view sources
                  </Link>
                </p>
              ) : null}
            </CardContent>
          </Card>
          {articleId ? (
            <VersionHistory
              canManage={canManage}
              currentVersion={article?.currentVersion ?? 1}
              onPreview={setPreviewVersion}
              onRestore={(version) => restore.mutate(version)}
              pending={restore.isPending}
              versions={versions.data?.items ?? []}
            />
          ) : null}
        </div>
      </div>

      <Dialog onOpenChange={(open) => !open && setPreviewVersion(undefined)} open={Boolean(previewVersion)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              v{previewVersion?.version} · {previewVersion?.title}
            </DialogTitle>
            <DialogDescription>
              {previewVersion ? articleStatusLabel(previewVersion.status) : ''}
            </DialogDescription>
          </DialogHeader>
          {previewVersion ? (
            <ArticlePreview body={previewVersion.body} summary={previewVersion.summary ?? ''} title={previewVersion.title} />
          ) : null}
          <DialogFooter>
            {canManage && previewVersion && previewVersion.version !== article?.currentVersion ? (
              <Button
                onClick={() => {
                  restore.mutate(previewVersion.version);
                  setPreviewVersion(undefined);
                }}
                type="button"
              >
                Restore this version
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        confirmLabel="Archive"
        description="Archived articles leave the AI index and cannot be edited. Restore a version from history to turn the article back into a draft."
        onConfirm={() => {
          archive.mutate();
          setArchiveOpen(false);
        }}
        onOpenChange={setArchiveOpen}
        open={archiveOpen}
        pending={archive.isPending}
        title="Archive this article?"
      />
      <ConfirmDialog
        confirmLabel="Delete"
        description="This permanently deletes the article, its version history, and the indexed copy."
        onConfirm={() => remove.mutate()}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        pending={remove.isPending}
        title="Delete this article?"
        variant="destructive"
      />
    </>
  );
}

function toUpdateBody(draft: DraftState): UpdateKnowledgeArticleRequest {
  return {
    title: draft.title,
    slug: draft.slug || undefined,
    summary: draft.summary || null,
    body: draft.body,
    categoryId: draft.categoryId || null,
    tags: draft.tags,
  };
}

function ArticlePreview({ title, summary, body }: { readonly title: string; readonly summary: string; readonly body: string }) {
  const paragraphs = body.split(/\n{2,}/).filter((block) => block.trim().length > 0);
  return (
    <div className="min-h-48 rounded-lg border border-border bg-card p-6">
      <h2 className="text-xl font-semibold tracking-tight">{title || 'Untitled'}</h2>
      {summary ? <p className="mt-2 text-sm text-muted-foreground">{summary}</p> : null}
      <div className="mt-4 space-y-3 text-sm leading-6">
        {paragraphs.length === 0 ? (
          <p className="text-muted-foreground">Nothing to preview yet.</p>
        ) : (
          paragraphs.map((block, index) => {
            const trimmed = block.trim();
            if (trimmed.startsWith('### ')) {
              return (
                <h4 className="font-semibold" key={index}>
                  {trimmed.slice(4)}
                </h4>
              );
            }
            if (trimmed.startsWith('## ')) {
              return (
                <h3 className="text-base font-semibold" key={index}>
                  {trimmed.slice(3)}
                </h3>
              );
            }
            if (trimmed.startsWith('# ')) {
              return (
                <h2 className="text-lg font-semibold" key={index}>
                  {trimmed.slice(2)}
                </h2>
              );
            }
            return (
              <p className="whitespace-pre-wrap" key={index}>
                {trimmed}
              </p>
            );
          })
        )}
      </div>
    </div>
  );
}
