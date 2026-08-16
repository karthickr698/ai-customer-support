import { describe, expect, it } from 'vitest';
import type { RagPlaygroundResponse } from '@ai-customer-support/contracts';
import type { AICallContext, AIServicePort } from '../../../apps/api/src/modules/ai/application/ports/ai-service-port.ts';
import { RunRagPlaygroundUseCase } from '../../../apps/api/src/modules/knowledge/application/use-cases/run-rag-playground-use-case.ts';
import { InsufficientKnowledgePermissionError } from '../../../apps/api/src/modules/knowledge/domain/errors.ts';
import type { TenantAccessPort } from '../../../apps/api/src/modules/knowledge/application/ports/tenant-access-port.ts';
import { Permissions } from '../../../apps/api/src/modules/organizations/domain/permissions.ts';

const tenantId = '11111111-1111-1111-1111-111111111111';

const playgroundResult: RagPlaygroundResponse = {
  schemaVersion: 1,
  query: 'How long do refunds take?',
  topK: 3,
  generate: true,
  latencyMs: 12,
  retrieveMs: 4,
  generateMs: 8,
  filters: { documentIds: [], kinds: ['article'], sourceUri: null, titleContains: null },
  chunks: [
    {
      id: 'chunk-1',
      documentId: 'doc-1',
      version: 1,
      chunkIndex: 0,
      content: 'Refunds are issued within five business days.',
      score: 0.91,
      vectorScore: 0.8,
      keywordScore: 0.7,
      title: 'Refund policy',
      sourceUri: null,
      kind: 'article',
    },
  ],
  sources: [
    {
      documentId: 'doc-1',
      title: 'Refund policy',
      sourceUri: null,
      kind: 'article',
      chunkCount: 1,
      maxScore: 0.91,
    },
  ],
  citations: [
    {
      documentId: 'doc-1',
      chunkId: 'chunk-1',
      title: 'Refund policy',
      sourceUri: null,
      chunkIndex: 0,
      snippet: 'Refunds are issued within five business days.',
      score: 0.91,
    },
  ],
  generation: {
    content: 'Refunds take five business days.',
    model: 'heuristic',
    promptTokens: 10,
    completionTokens: 8,
  },
};

class RecordingAI implements Pick<AIServicePort, 'runRagPlayground'> {
  last?: { context: AICallContext; input: unknown };

  async runRagPlayground(context: AICallContext, input: unknown): Promise<RagPlaygroundResponse> {
    this.last = { context, input };
    return playgroundResult;
  }
}

describe('RunRagPlaygroundUseCase', () => {
  it('forwards a tenant-scoped playground query to the AI service', async () => {
    const ai = new RecordingAI();
    const tenantAccess: TenantAccessPort = {
      async loadActor() {
        return { tenantId, actorId: 'user-1', permissions: [Permissions.KNOWLEDGE_MANAGE] };
      },
    };
    const useCase = new RunRagPlaygroundUseCase(tenantAccess, ai as unknown as AIServicePort);

    const result = await useCase.execute({
      tenantId,
      actorId: 'user-1',
      query: 'How long do refunds take?',
      topK: 3,
      generate: true,
      filters: { kinds: ['article'] },
      security: { ipAddress: '127.0.0.1', requestId: 'req-1', correlationId: 'corr-1' },
    });

    expect(result.generation?.content).toContain('five business days');
    expect(result.chunks[0]?.score).toBe(0.91);
    expect(ai.last?.context).toMatchObject({ tenantId, requestId: 'req-1', correlationId: 'corr-1' });
    expect(ai.last?.input).toMatchObject({
      query: 'How long do refunds take?',
      topK: 3,
      generate: true,
      filters: { kinds: ['article'] },
    });
  });

  it('rejects callers without knowledge.manage', async () => {
    const tenantAccess: TenantAccessPort = {
      async loadActor() {
        return { tenantId, actorId: 'user-2', permissions: [Permissions.ORGANIZATION_READ] };
      },
    };
    const useCase = new RunRagPlaygroundUseCase(tenantAccess, new RecordingAI() as unknown as AIServicePort);

    await expect(
      useCase.execute({
        tenantId,
        actorId: 'user-2',
        query: 'refunds',
        security: { ipAddress: '127.0.0.1', requestId: 'req-2' },
      }),
    ).rejects.toBeInstanceOf(InsufficientKnowledgePermissionError);
  });
});
