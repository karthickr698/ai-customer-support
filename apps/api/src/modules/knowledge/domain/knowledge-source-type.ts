import { KNOWLEDGE_SOURCE_TYPES, type KnowledgeSourceType } from '@ai-customer-support/contracts';
import { InvalidKnowledgeSourceError } from './errors.js';

export { KNOWLEDGE_SOURCE_TYPES, type KnowledgeSourceType };

export const MAX_KNOWLEDGE_SOURCES_PER_TENANT = 50;

export function parseKnowledgeSourceType(value: string): KnowledgeSourceType {
  if ((KNOWLEDGE_SOURCE_TYPES as readonly string[]).includes(value)) {
    return value as KnowledgeSourceType;
  }
  throw new InvalidKnowledgeSourceError('Knowledge source type is invalid');
}
