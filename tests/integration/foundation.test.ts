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
    expect(example).toContain('GOOGLE_CLIENT_ID=');
    expect(example).toContain('GOOGLE_CLIENT_SECRET=');
    expect(example).toContain('SMTP_URL=');
    expect(example).toContain('AI_SERVICE_URL=');
    expect(example).toContain('LLM_PROVIDER=');
    expect(example).toContain('LLM_API_KEY=');
  });

  it('configures Prisma for PostgreSQL', () => {
    const schema = readFileSync(join(root, 'prisma/schema.prisma'), 'utf8');

    expect(schema).toContain('provider = "postgresql"');
    expect(schema).toContain('env("DATABASE_URL")');
    expect(schema).toContain('model User');
    expect(schema).toContain('model RefreshSession');
    expect(schema).toContain('model IdentityAuditLog');
    expect(schema).toContain('model Organization');
    expect(schema).toContain('model Membership');
    expect(schema).toContain('model Invitation');
    expect(schema).toContain('model OrganizationAuditLog');
  });
});
