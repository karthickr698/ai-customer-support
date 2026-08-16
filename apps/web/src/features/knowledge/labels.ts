import type { KnowledgeArticleStatus, KnowledgeDocumentKind } from '@ai-customer-support/contracts';

export function articleStatusLabel(status: KnowledgeArticleStatus): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'published':
      return 'Published';
    case 'archived':
      return 'Archived';
  }
}

export function articleStatusVariant(status: KnowledgeArticleStatus): 'secondary' | 'success' | 'outline' {
  switch (status) {
    case 'draft':
      return 'secondary';
    case 'published':
      return 'success';
    case 'archived':
      return 'outline';
  }
}

export function formatKnowledgeDate(value: string): string {
  return new Date(value).toLocaleString();
}

export function knowledgePath(organizationId: string, segment = ''): string {
  const base = `/organizations/${organizationId}/knowledge`;
  return segment ? `${base}/${segment}` : base;
}

export function documentKindLabel(kind: KnowledgeDocumentKind | string | null): string {
  switch (kind) {
    case 'article':
      return 'Article';
    case 'url':
      return 'URL';
    case 'pdf':
      return 'PDF';
    case 'docx':
      return 'DOCX';
    default:
      return kind ?? 'Unknown';
  }
}

export function formatRetrievalScore(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return value.toFixed(4);
}
