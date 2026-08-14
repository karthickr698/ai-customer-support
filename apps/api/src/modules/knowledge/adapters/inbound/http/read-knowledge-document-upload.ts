import type { FastifyRequest } from 'fastify';
import { InvalidKnowledgeDocumentError } from '../../../domain/errors.js';

export async function readKnowledgeDocumentUpload(request: FastifyRequest): Promise<{
  fileName: string;
  contentType: string;
  bytes: Buffer;
  title?: string;
  sourceId?: string;
}> {
  const file = await request.file();
  if (!file) {
    throw new InvalidKnowledgeDocumentError('Choose a PDF or DOCX file to upload');
  }

  const bytes = await file.toBuffer();
  return {
    fileName: file.filename,
    contentType: file.mimetype,
    bytes,
    title: stringField(file.fields, 'title'),
    sourceId: stringField(file.fields, 'sourceId'),
  };
}

function stringField(fields: unknown, name: string): string | undefined {
  if (!fields || typeof fields !== 'object') {
    return undefined;
  }
  const value = (fields as Record<string, { value?: unknown } | Array<{ value?: unknown }>>)[name];
  const field = Array.isArray(value) ? value[0] : value;
  return typeof field?.value === 'string' ? field.value : undefined;
}
