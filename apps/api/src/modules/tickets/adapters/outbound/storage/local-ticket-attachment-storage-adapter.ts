import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { InvalidAttachmentError } from '../../../domain/errors.js';
import type { AttachmentStoragePort, StoredAttachmentFile } from '../../../application/ports.js';

export class LocalTicketAttachmentStorageAdapter implements AttachmentStoragePort {
  constructor(private readonly rootDir: string) {}

  async save(input: {
    readonly tenantId: string;
    readonly ticketId: string;
    readonly attachmentId: string;
    readonly bytes: Buffer;
  }): Promise<string> {
    const storageKey = path.posix.join(input.tenantId, 'tickets', input.ticketId, input.attachmentId);
    const absolute = this.resolve(storageKey);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, input.bytes);
    return storageKey;
  }

  async read(storageKey: string): Promise<StoredAttachmentFile> {
    const absolute = this.resolve(storageKey);
    try {
      const bytes = await readFile(absolute);
      return { bytes, contentType: 'application/octet-stream' };
    } catch {
      throw new InvalidAttachmentError('Attachment file is not available');
    }
  }

  private resolve(storageKey: string): string {
    const normalized = path.normalize(storageKey).replace(/^(\.\.(\/|\\|$))+/, '');
    const absolute = path.resolve(this.rootDir, normalized);
    const root = path.resolve(this.rootDir);
    if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
      throw new InvalidAttachmentError('Attachment path is invalid');
    }
    return absolute;
  }
}
