import {
  KNOWLEDGE_DOCUMENT_KINDS,
  type KnowledgeDocumentKind,
} from '@ai-customer-support/contracts';
import { InvalidKnowledgeDocumentError } from './errors.js';

export { KNOWLEDGE_DOCUMENT_KINDS, type KnowledgeDocumentKind };

export const MAX_KNOWLEDGE_DOCUMENTS_PER_TENANT = 200;
export const MAX_KNOWLEDGE_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ARTICLE_CHARS = 200_000;
export const MAX_DOCUMENT_TITLE = 200;

export const KNOWLEDGE_DOCUMENT_MEDIA_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
} as const;

export function parseKnowledgeDocumentKind(value: string): KnowledgeDocumentKind {
  if ((KNOWLEDGE_DOCUMENT_KINDS as readonly string[]).includes(value)) {
    return value as KnowledgeDocumentKind;
  }
  throw new InvalidKnowledgeDocumentError('Knowledge document kind is invalid');
}

export function kindFromFile(fileName: string, contentType: string): KnowledgeDocumentKind {
  const loweredName = fileName.toLowerCase();
  const loweredType = contentType.toLowerCase();
  if (loweredType === KNOWLEDGE_DOCUMENT_MEDIA_TYPES.pdf || loweredName.endsWith('.pdf')) {
    return 'pdf';
  }
  if (
    loweredType === KNOWLEDGE_DOCUMENT_MEDIA_TYPES.docx ||
    loweredName.endsWith('.docx')
  ) {
    return 'docx';
  }
  throw new InvalidKnowledgeDocumentError('Only PDF and DOCX files can be uploaded');
}
