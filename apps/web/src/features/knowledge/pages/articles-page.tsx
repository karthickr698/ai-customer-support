import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type {
  KnowledgeArticleListResponse,
  KnowledgeArticleStatus,
  KnowledgeCategoryListResponse,
  KnowledgeTagListResponse,
} from '@ai-customer-support/contracts';
import { FolderTree, Plus, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { hasPermission } from '@/features/organizations/permissions';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { CategoryManager } from '../components/category-manager';
import { articleStatusLabel, articleStatusVariant, formatKnowledgeDate, knowledgePath } from '../labels';

const PAGE_SIZE = 20;
const STATUS_OPTIONS = [
  { value: 'draft', label: 'Drafts' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

export function KnowledgeArticlesPage() {
  const { organizationId, permissions } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const canManage = hasPermission(permissions, 'knowledge.manage');

  const q = searchParams.get('q') ?? '';
  const status = (searchParams.get('status') ?? '') as KnowledgeArticleStatus | '';
  const categoryId = searchParams.get('categoryId') ?? '';
  const tag = searchParams.get('tag') ?? '';
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);

  const filters = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      q: q || undefined,
      status: status || undefined,
      categoryId: categoryId || undefined,
      tag: tag || undefined,
    }),
    [categoryId, page, q, status, tag],
  );

  const categories = useApiQuery<KnowledgeCategoryListResponse>({
    queryKey: queryKeys.knowledge.categories(organizationId),
    path: `/api/organizations/${organizationId}/knowledge/categories`,
  });
  const tags = useApiQuery<KnowledgeTagListResponse>({
    queryKey: queryKeys.knowledge.tags(organizationId),
    path: `/api/organizations/${organizationId}/knowledge/tags`,
  });
  const articles = useApiQuery<KnowledgeArticleListResponse>({
    queryKey: queryKeys.knowledge.articles(organizationId, filters),
    path: `/api/organizations/${organizationId}/knowledge/articles`,
    params: filters,
  });

  function updateParams(next: Record<string, string | undefined>): void {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(next)) {
      if (!value) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    if (!('page' in next)) {
      params.delete('page');
    }
    setSearchParams(params);
  }

  const items = articles.data?.items ?? [];
  const total = articles.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const categoryOptions = (categories.data?.items ?? []).map((category) => ({
    value: category.id,
    label: category.name,
  }));
  const tagOptions = (tags.data?.items ?? []).map((item) => ({ value: item, label: item }));

  return (
    <>
      <PageHeader
        actions={
          <>
            <Button onClick={() => setCategoriesOpen(true)} type="button" variant="outline">
              <FolderTree />
              Categories
            </Button>
            {canManage ? (
              <Button asChild>
                <Link to={knowledgePath(organizationId, 'articles/new')}>
                  <Plus />
                  New article
                </Link>
              </Button>
            ) : null}
          </>
        }
        description="Write, categorize, and publish support articles. Publishing indexes the article for AI answers."
        title="Knowledge base"
      />

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="relative md:col-span-1">
              <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
              <Input
                className="pl-8"
                onChange={(event) => updateParams({ q: event.target.value || undefined })}
                placeholder="Search articles"
                value={q}
              />
            </div>
            <Select
              onValueChange={(value) => updateParams({ status: value || undefined })}
              options={STATUS_OPTIONS}
              placeholder="All statuses"
              searchable={false}
              value={status || undefined}
            />
            <Select
              onValueChange={(value) => updateParams({ categoryId: value || undefined })}
              options={categoryOptions}
              placeholder="All categories"
              value={categoryId || undefined}
            />
            <Select
              onValueChange={(value) => updateParams({ tag: value || undefined })}
              options={tagOptions}
              placeholder="All tags"
              value={tag || undefined}
            />
          </div>

          {articles.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              action={
                canManage ? (
                  <Button asChild>
                    <Link to={knowledgePath(organizationId, 'articles/new')}>Write an article</Link>
                  </Button>
                ) : undefined
              }
              description="Draft help content, assign a category and tags, then publish it into the AI knowledge index."
              title="No articles match these filters"
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((article) => (
                    <TableRow key={article.id}>
                      <TableCell>
                        <Link
                          className="font-medium hover:underline"
                          to={knowledgePath(organizationId, `articles/${article.id}`)}
                        >
                          {article.title}
                        </Link>
                        {article.excerpt ? (
                          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{article.excerpt}</p>
                        ) : null}
                      </TableCell>
                      <TableCell>{article.categoryName ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={articleStatusVariant(article.status)}>
                          {articleStatusLabel(article.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {article.tags.length === 0
                            ? '—'
                            : article.tags.map((item) => (
                                <Badge key={item} variant="outline">
                                  {item}
                                </Badge>
                              ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatKnowledgeDate(article.updatedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination onPageChange={(next) => updateParams({ page: String(next) })} page={page} pageCount={pageCount} />
            </>
          )}
        </CardContent>
      </Card>

      <CategoryManager
        canManage={canManage}
        categories={categories.data?.items ?? []}
        onOpenChange={setCategoriesOpen}
        open={categoriesOpen}
        organizationId={organizationId}
      />
    </>
  );
}
