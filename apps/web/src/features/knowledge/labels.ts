import type { KnowledgeArticleStatus } from '@ai-customer-support/contracts';

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
