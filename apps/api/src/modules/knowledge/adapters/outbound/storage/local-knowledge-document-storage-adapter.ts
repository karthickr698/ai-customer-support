import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { InvalidKnowledgeDocumentError } from '../../../domain/errors.js';
import type {
  KnowledgeDocumentStoragePort,
  StoredKnowledgeFile,
} from '../../../application/ports/knowledge-document-storage-port.js';

export class LocalKnowledgeDocumentStorageAdapter implements KnowledgeDocumentStoragePort {
  constructor(private readonly rootDir: string) {}

  async save(input: {
    readonly tenantId: string;
    readonly documentId: string;
    readonly bytes: Buffer;
  }): Promise<string> {
    const storageKey = path.posix.join(input.tenantId, input.documentId);
    const absolute = this.resolve(storageKey);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, input.bytes);
    return storageKey;
  }

  async read(storageKey: string): Promise<StoredKnowledgeFile> {
    const absolute = this.resolve(storageKey);
    try {
      const bytes = await readFile(absolute);
      return { bytes };
    } catch {
      throw new InvalidKnowledgeDocumentError('Document file is not available');
    }
  }

  async delete(storageKey: string): Promise<void> {
    const absolute = this.resolve(storageKey);
    try {
      await unlink(absolute);
    } catch {
      return;
    }
  }

  private resolve(storageKey: string): string {
    const normalized = path.normalize(storageKey).replace(/^(\.\.(\/|\\|$))+/, '');
    const absolute = path.resolve(this.rootDir, normalized);
    const root = path.resolve(this.rootDir);
    if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
      throw new InvalidKnowledgeDocumentError('Document path is invalid');
    }
    return absolute;
  }
}
