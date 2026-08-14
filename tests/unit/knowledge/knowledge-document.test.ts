import { describe, expect, it } from 'vitest';
import {
  InvalidKnowledgeDocumentError,
  InvalidKnowledgeDocumentStateError,
} from '../../../apps/api/src/modules/knowledge/domain/errors.ts';
import { KnowledgeDocument } from '../../../apps/api/src/modules/knowledge/domain/knowledge-document.ts';

const now = new Date('2026-08-14T12:00:00.000Z');

function article(overrides: Partial<Parameters<typeof KnowledgeDocument.create>[0]> = {}) {
  return KnowledgeDocument.create({
    organizationId: '11111111-1111-1111-1111-111111111111',
    kind: 'article',
    title: 'Refund policy',
    articleText: 'Refunds take five business days.',
    createdByUserId: 'user-1',
    now,
    ...overrides,
  });
}

describe('KnowledgeDocument', () => {
  it('creates an uploaded article with version 1', () => {
    const document = article();
    expect(document.status).toBe('uploaded');
    expect(document.version).toBe(1);
    expect(document.kind).toBe('article');
  });

  it('requires a URL for url documents', () => {
    expect(() =>
      KnowledgeDocument.create({
        organizationId: 'org-1',
        kind: 'url',
        title: 'Help center',
        createdByUserId: 'user-1',
        now,
      }),
    ).toThrow(InvalidKnowledgeDocumentError);
  });

  it('moves uploaded to processing then ready and increments version on reindex', () => {
    const document = article();
    document.markProcessing(now);
    expect(document.status).toBe('processing');
    document.markReady({
      now,
      chunkCount: 3,
      embeddingModel: 'hash-v1',
      parser: 'article',
      checksum: 'abc',
    });
    expect(document.status).toBe('ready');
    expect(document.chunkCount).toBe(3);
    document.startReindex(now);
    expect(document.status).toBe('processing');
    expect(document.version).toBe(2);
  });

  it('rejects reindex while processing', () => {
    const document = article();
    document.markProcessing(now);
    expect(() => document.startReindex(now)).toThrow(InvalidKnowledgeDocumentStateError);
  });
});
