import type { KnowledgeSourceStatus, KnowledgeSourceType } from '@ai-customer-support/contracts';
import { InvalidKnowledgeSourceError } from './errors.js';
import { createKnowledgeSourceId, type KnowledgeSourceId } from './knowledge-source-id.js';
import { parseKnowledgeSourceType } from './knowledge-source-type.js';

const MAX_NAME = 200;
const MAX_DESCRIPTION = 4000;
const MAX_URL = 2000;

export type KnowledgeSourceSnapshot = {
  readonly id: KnowledgeSourceId;
  readonly organizationId: string;
  readonly type: KnowledgeSourceType;
  readonly name: string;
  readonly url?: string;
  readonly description?: string;
  readonly status: KnowledgeSourceStatus;
  readonly createdByUserId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export class KnowledgeSource {
  private constructor(
    readonly id: KnowledgeSourceId,
    readonly organizationId: string,
    readonly type: KnowledgeSourceType,
    readonly name: string,
    readonly url: string | undefined,
    readonly description: string | undefined,
    readonly status: KnowledgeSourceStatus,
    readonly createdByUserId: string,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  static create(input: {
    readonly organizationId: string;
    readonly type: string;
    readonly name: string;
    readonly url?: string;
    readonly description?: string;
    readonly createdByUserId: string;
    readonly now: Date;
    readonly id?: KnowledgeSourceId;
  }): KnowledgeSource {
    const type = parseKnowledgeSourceType(input.type);
    const name = normalizeName(input.name);
    const url = normalizeUrl(input.url, type);
    const description = normalizeDescription(input.description, type);

    return new KnowledgeSource(
      input.id ?? createKnowledgeSourceId(),
      input.organizationId,
      type,
      name,
      url,
      description,
      'registered',
      input.createdByUserId,
      input.now,
      input.now,
    );
  }

  static reconstitute(snapshot: KnowledgeSourceSnapshot): KnowledgeSource {
    return new KnowledgeSource(
      snapshot.id,
      snapshot.organizationId,
      snapshot.type,
      snapshot.name,
      snapshot.url,
      snapshot.description,
      snapshot.status,
      snapshot.createdByUserId,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  toSnapshot(): KnowledgeSourceSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      type: this.type,
      name: this.name,
      url: this.url,
      description: this.description,
      status: this.status,
      createdByUserId: this.createdByUserId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

function normalizeName(raw: string): string {
  const name = raw.trim();
  if (name.length < 1 || name.length > MAX_NAME) {
    throw new InvalidKnowledgeSourceError(`Name must be between 1 and ${MAX_NAME} characters`);
  }
  return name;
}

function normalizeDescription(raw: string | undefined, type: KnowledgeSourceType): string | undefined {
  const description = raw?.trim();
  if (!description) {
    if (type === 'text') {
      throw new InvalidKnowledgeSourceError('Text knowledge sources require a description');
    }
    return undefined;
  }
  if (description.length > MAX_DESCRIPTION) {
    throw new InvalidKnowledgeSourceError(`Description must be at most ${MAX_DESCRIPTION} characters`);
  }
  return description;
}

function normalizeUrl(raw: string | undefined, type: KnowledgeSourceType): string | undefined {
  const url = raw?.trim();
  const requiresUrl = type === 'url' || type === 'help_center' || type === 'sitemap';
  if (!url) {
    if (requiresUrl) {
      throw new InvalidKnowledgeSourceError('A URL is required for this knowledge source type');
    }
    return undefined;
  }
  if (url.length > MAX_URL) {
    throw new InvalidKnowledgeSourceError('URL is too long');
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new InvalidKnowledgeSourceError('URL must start with http or https');
    }
  } catch (error: unknown) {
    if (error instanceof InvalidKnowledgeSourceError) {
      throw error;
    }
    throw new InvalidKnowledgeSourceError('Enter a valid URL');
  }
  return url;
}
