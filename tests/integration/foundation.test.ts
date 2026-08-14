import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('foundation configuration', () => {
  it('documents the required environment variables', () => {
    const example = readFileSync(join(root, '.env.example'), 'utf8');

    expect(example).toContain('DATABASE_URL=');
    expect(example).toContain('REDIS_URL=');
    expect(example).toContain('JWT_SECRET=');
    expect(example).toContain('LLM_PROVIDER=');
    expect(example).toContain('LLM_API_KEY=');
  });

  it('configures Prisma for PostgreSQL', () => {
    const schema = readFileSync(join(root, 'prisma/schema.prisma'), 'utf8');

    expect(schema).toContain('provider = "postgresql"');
    expect(schema).toContain('env("DATABASE_URL")');
  });
});
