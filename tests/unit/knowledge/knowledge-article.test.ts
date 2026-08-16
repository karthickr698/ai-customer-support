import { describe, expect, it } from 'vitest';
import {
  InvalidKnowledgeArticleError,
  InvalidKnowledgeArticleStateError,
} from '../../../apps/api/src/modules/knowledge/domain/errors.ts';
import { KnowledgeArticle } from '../../../apps/api/src/modules/knowledge/domain/knowledge-article.ts';
import { KnowledgeCategory } from '../../../apps/api/src/modules/knowledge/domain/knowledge-category.ts';

const now = new Date('2026-08-16T12:00:00.000Z');
const later = new Date('2026-08-16T13:00:00.000Z');

function article() {
  return KnowledgeArticle.create({
    organizationId: '11111111-1111-1111-1111-111111111111',
    title: 'Refund policy',
    body: 'Refunds take five business days.',
    tags: ['billing', 'refunds'],
    createdByUserId: 'user-1',
    now,
  });
}

describe('KnowledgeArticle', () => {
  it('creates a draft with version 1 and a slug from the title', () => {
    const created = article();
    expect(created.status).toBe('draft');
    expect(created.currentVersion).toBe(1);
    expect(created.slug).toBe('refund-policy');
    expect(created.drainPendingVersions()).toHaveLength(1);
  });

  it('increments version when content changes and publishes the working copy', () => {
    const created = article();
    created.drainPendingVersions();
    const changed = created.updateContent({
      actorId: 'user-1',
      now: later,
      body: 'Refunds take seven business days.',
    });
    expect(changed).toBe(true);
    expect(created.currentVersion).toBe(2);
    created.publish(later, 'user-1');
    expect(created.status).toBe('published');
    expect(created.publishedVersion).toBe(2);
    expect(created.publishedAt).toEqual(later);
  });

  it('rejects publishing an empty body', () => {
    const created = KnowledgeArticle.create({
      organizationId: 'org-1',
      title: 'Empty',
      createdByUserId: 'user-1',
      now,
    });
    expect(() => created.publish(later, 'user-1')).toThrow(InvalidKnowledgeArticleError);
  });

  it('unpublishes to draft and archives afterwards', () => {
    const created = article();
    created.publish(later, 'user-1');
    created.unpublish(later, 'user-1');
    expect(created.status).toBe('draft');
    created.archive(later, 'user-1');
    expect(created.status).toBe('archived');
    expect(() => created.updateContent({ actorId: 'user-1', now: later, title: 'Nope' })).toThrow(
      InvalidKnowledgeArticleStateError,
    );
  });

  it('restores an older version into a new working copy', () => {
    const created = article();
    const original = created.drainPendingVersions()[0];
    created.updateContent({ actorId: 'user-1', now: later, body: 'Changed' });
    created.drainPendingVersions();
    expect(original).toBeDefined();
    if (!original) {
      return;
    }
    created.restoreVersion(original, later, 'user-2');
    expect(created.body).toBe('Refunds take five business days.');
    expect(created.currentVersion).toBe(3);
    expect(created.updatedByUserId).toBe('user-2');
  });
});

describe('KnowledgeCategory', () => {
  it('slugifies the name when no slug is provided', () => {
    const category = KnowledgeCategory.create({
      organizationId: 'org-1',
      name: 'Order Status',
      now,
    });
    expect(category.slug).toBe('order-status');
  });
});
