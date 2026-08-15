import { InvalidAttachmentError } from '../../../domain/errors.js';
import type { FastifyRequest } from 'fastify';

export async function readUploadedFile(request: FastifyRequest): Promise<{
  fileName: string;
  contentType: string;
  bytes: Buffer;
}> {
  const file = await request.file();
  if (!file) {
    throw new InvalidAttachmentError('Choose a file to upload');
  }
  const bytes = await file.toBuffer();
  return {
    fileName: file.filename,
    contentType: file.mimetype,
    bytes,
  };
}
