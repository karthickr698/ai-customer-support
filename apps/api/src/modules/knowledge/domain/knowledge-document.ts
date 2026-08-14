import type { KnowledgeDocumentKind, KnowledgeDocumentStatus } from '@ai-customer-support/contracts';
import {
  InvalidKnowledgeDocumentError,
  InvalidKnowledgeDocumentStateError,
} from './errors.js';
import { createKnowledgeDocumentId, type KnowledgeDocumentId } from './knowledge-document-id.js';
import {
  MAX_ARTICLE_CHARS,
  MAX_DOCUMENT_TITLE,
  MAX_KNOWLEDGE_DOCUMENT_BYTES,
  parseKnowledgeDocumentKind,
} from './knowledge-document-kind.js';

const MAX_URL = 2000;

export type KnowledgeDocumentSnapshot = {
  readonly id: KnowledgeDocumentId;
  readonly organizationId: string;
  readonly sourceId?: string;
  readonly kind: KnowledgeDocumentKind;
  readonly title: string;
  readonly sourceUri?: string;
  readonly mediaType?: string;
  readonly fileName?: string;
  readonly storageKey?: string;
  readonly articleText?: string;
  readonly checksum?: string;
  readonly status: KnowledgeDocumentStatus;
  readonly version: number;
  readonly chunkCount: number;
  readonly embeddingModel?: string;
  readonly parser?: string;
  readonly failureCode?: string;
  readonly failureMessage?: string;
  readonly indexedAt?: Date;
  readonly createdByUserId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export class KnowledgeDocument {
  private constructor(
    readonly id: KnowledgeDocumentId,
    readonly organizationId: string,
    readonly sourceId: string | undefined,
    readonly kind: KnowledgeDocumentKind,
    readonly title: string,
    readonly sourceUri: string | undefined,
    readonly mediaType: string | undefined,
    readonly fileName: string | undefined,
    readonly storageKey: string | undefined,
    readonly articleText: string | undefined,
    private checksumValue: string | undefined,
    private statusValue: KnowledgeDocumentStatus,
    private versionValue: number,
    private chunkCountValue: number,
    private embeddingModelValue: string | undefined,
    private parserValue: string | undefined,
    private failureCodeValue: string | undefined,
    private failureMessageValue: string | undefined,
    private indexedAtValue: Date | undefined,
    readonly createdByUserId: string,
    readonly createdAt: Date,
    private updatedAtValue: Date,
  ) {}

  get checksum(): string | undefined {
    return this.checksumValue;
  }

  get status(): KnowledgeDocumentStatus {
    return this.statusValue;
  }

  get version(): number {
    return this.versionValue;
  }

  get chunkCount(): number {
    return this.chunkCountValue;
  }

  get embeddingModel(): string | undefined {
    return this.embeddingModelValue;
  }

  get parser(): string | undefined {
    return this.parserValue;
  }

  get failureCode(): string | undefined {
    return this.failureCodeValue;
  }

  get failureMessage(): string | undefined {
    return this.failureMessageValue;
  }

  get indexedAt(): Date | undefined {
    return this.indexedAtValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  static create(input: {
    readonly organizationId: string;
    readonly kind: string;
    readonly title: string;
    readonly createdByUserId: string;
    readonly now: Date;
    readonly sourceId?: string;
    readonly sourceUri?: string;
    readonly mediaType?: string;
    readonly fileName?: string;
    readonly storageKey?: string;
    readonly articleText?: string;
    readonly checksum?: string;
    readonly byteSize?: number;
    readonly id?: KnowledgeDocumentId;
  }): KnowledgeDocument {
    const kind = parseKnowledgeDocumentKind(input.kind);
    const title = normalizeTitle(input.title);
    const sourceUri = normalizeUrl(input.sourceUri, kind);
    const articleText = normalizeArticleText(input.articleText, kind);
    if ((kind === 'pdf' || kind === 'docx') && !input.storageKey) {
      throw new InvalidKnowledgeDocumentError('A file is required for this document kind');
    }
    if (typeof input.byteSize === 'number' && input.byteSize > MAX_KNOWLEDGE_DOCUMENT_BYTES) {
      throw new InvalidKnowledgeDocumentError('The document is too large');
    }

    return new KnowledgeDocument(
      input.id ?? createKnowledgeDocumentId(),
      input.organizationId,
      input.sourceId,
      kind,
      title,
      sourceUri,
      input.mediaType,
      input.fileName,
      input.storageKey,
      articleText,
      input.checksum,
      'uploaded',
      1,
      0,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      input.createdByUserId,
      input.now,
      input.now,
    );
  }

  static reconstitute(snapshot: KnowledgeDocumentSnapshot): KnowledgeDocument {
    return new KnowledgeDocument(
      snapshot.id,
      snapshot.organizationId,
      snapshot.sourceId,
      snapshot.kind,
      snapshot.title,
      snapshot.sourceUri,
      snapshot.mediaType,
      snapshot.fileName,
      snapshot.storageKey,
      snapshot.articleText,
      snapshot.checksum,
      snapshot.status,
      snapshot.version,
      snapshot.chunkCount,
      snapshot.embeddingModel,
      snapshot.parser,
      snapshot.failureCode,
      snapshot.failureMessage,
      snapshot.indexedAt,
      snapshot.createdByUserId,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  markProcessing(now: Date): void {
    if (this.statusValue === 'processing') {
      return;
    }
    this.statusValue = 'processing';
    this.failureCodeValue = undefined;
    this.failureMessageValue = undefined;
    this.updatedAtValue = now;
  }

  markReady(input: {
    readonly now: Date;
    readonly chunkCount: number;
    readonly embeddingModel: string;
    readonly parser: string;
    readonly checksum: string;
  }): void {
    if (this.statusValue !== 'processing') {
      throw new InvalidKnowledgeDocumentStateError('Only processing documents can be marked ready');
    }
    this.statusValue = 'ready';
    this.chunkCountValue = input.chunkCount;
    this.embeddingModelValue = input.embeddingModel;
    this.parserValue = input.parser;
    this.checksumValue = input.checksum || this.checksumValue;
    this.failureCodeValue = undefined;
    this.failureMessageValue = undefined;
    this.indexedAtValue = input.now;
    this.updatedAtValue = input.now;
  }

  markFailed(input: { readonly now: Date; readonly code: string; readonly message: string }): void {
    this.statusValue = 'failed';
    this.failureCodeValue = input.code;
    this.failureMessageValue = input.message;
    this.updatedAtValue = input.now;
  }

  startReindex(now: Date): void {
    if (this.statusValue === 'processing') {
      throw new InvalidKnowledgeDocumentStateError('This document is already being processed');
    }
    this.versionValue += 1;
    this.statusValue = 'processing';
    this.failureCodeValue = undefined;
    this.failureMessageValue = undefined;
    this.updatedAtValue = now;
  }

  toSnapshot(): KnowledgeDocumentSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      sourceId: this.sourceId,
      kind: this.kind,
      title: this.title,
      sourceUri: this.sourceUri,
      mediaType: this.mediaType,
      fileName: this.fileName,
      storageKey: this.storageKey,
      articleText: this.articleText,
      checksum: this.checksumValue,
      status: this.statusValue,
      version: this.versionValue,
      chunkCount: this.chunkCountValue,
      embeddingModel: this.embeddingModelValue,
      parser: this.parserValue,
      failureCode: this.failureCodeValue,
      failureMessage: this.failureMessageValue,
      indexedAt: this.indexedAtValue,
      createdByUserId: this.createdByUserId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAtValue,
    };
  }
}

function normalizeTitle(raw: string): string {
  const title = raw.trim();
  if (title.length < 1 || title.length > MAX_DOCUMENT_TITLE) {
    throw new InvalidKnowledgeDocumentError(`Title must be between 1 and ${MAX_DOCUMENT_TITLE} characters`);
  }
  return title;
}

function normalizeArticleText(raw: string | undefined, kind: KnowledgeDocumentKind): string | undefined {
  const text = raw?.trim();
  if (!text) {
    if (kind === 'article') {
      throw new InvalidKnowledgeDocumentError('Article text is required');
    }
    return undefined;
  }
  if (text.length > MAX_ARTICLE_CHARS) {
    throw new InvalidKnowledgeDocumentError('Article text is too long');
  }
  return text;
}

function normalizeUrl(raw: string | undefined, kind: KnowledgeDocumentKind): string | undefined {
  const url = raw?.trim();
  if (!url) {
    if (kind === 'url') {
      throw new InvalidKnowledgeDocumentError('A URL is required for URL documents');
    }
    return undefined;
  }
  if (url.length > MAX_URL) {
    throw new InvalidKnowledgeDocumentError('URL is too long');
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new InvalidKnowledgeDocumentError('URL must start with http or https');
    }
  } catch (error: unknown) {
    if (error instanceof InvalidKnowledgeDocumentError) {
      throw error;
    }
    throw new InvalidKnowledgeDocumentError('Enter a valid URL');
  }
  return url;
}
