import { isAIServiceHealthResponse, isDetectIntentResponse, isGenerateSupportReplyResponse, isOrchestrateSupportTurnResponse, isProposeToolCallsResponse } from '@ai-customer-support/contracts';
import type { Logger } from '@ai-customer-support/shared';
import { describe, expect, it, vi } from 'vitest';
import { PythonAIServiceAdapter } from '../../../apps/api/src/modules/ai/adapters/outbound/python-ai/python-ai-service-adapter.ts';

const silentLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return silentLogger;
  },
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe('PythonAIServiceAdapter', () => {
  it('reports ready when the Python health contract is valid', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ status: 'ok', service: 'ai' }));
    const adapter = new PythonAIServiceAdapter('http://localhost:8000/', silentLogger, fetchImpl);

    await expect(adapter.isReady()).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:8000/health',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('rejects payloads that are not the AI health contract', async () => {
    expect(isAIServiceHealthResponse({ status: 'ok' })).toBe(false);

    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ status: 'ok' }));
    const adapter = new PythonAIServiceAdapter('http://localhost:8000', silentLogger, fetchImpl);

    await expect(adapter.isReady()).resolves.toBe(false);
  });

  it('reports not ready when the Python process is unreachable', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED'));
    const adapter = new PythonAIServiceAdapter('http://localhost:8000', silentLogger, fetchImpl);

    await expect(adapter.isReady()).resolves.toBe(false);
  });

  it('rejects support replies that omit citations', () => {
    expect(
      isGenerateSupportReplyResponse({
        content: 'Hello',
        model: 'heuristic',
        promptTokens: 1,
        completionTokens: 1,
      }),
    ).toBe(false);
    expect(
      isGenerateSupportReplyResponse({
        content: 'Hello',
        model: 'heuristic',
        promptTokens: 1,
        completionTokens: 1,
        citations: [
          {
            documentId: 'doc-1',
            chunkId: 'chunk-1',
            title: 'Refund policy',
            sourceUri: null,
            chunkIndex: 0,
            snippet: 'Refunds take five days.',
            score: 0.9,
          },
        ],
      }),
    ).toBe(true);
  });

  it('rejects invalid knowledge ingestion payloads', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ status: 'processed' }));
    const adapter = new PythonAIServiceAdapter('http://localhost:8000', silentLogger, fetchImpl);

    await expect(
      adapter.ingestKnowledgeDocument(
        { tenantId: 'tenant-1', requestId: 'req-1', correlationId: 'corr-1' },
        {
          schemaVersion: 1,
          documentId: 'doc-1',
          kind: 'article',
          version: 1,
          title: 'Policy',
          replacePreviousVersion: false,
          content: 'Refunds take five days.',
          contentEncoding: 'utf8',
        },
      ),
    ).rejects.toMatchObject({ code: 'INVALID_AI_PAYLOAD' });
  });

  it('rejects orchestration payloads that omit a reply', async () => {
    expect(
      isDetectIntentResponse({
        schemaVersion: 1,
        intent: 'question',
        confidence: 0.7,
        shouldEscalate: false,
        reasons: ['question_form'],
        guardrails: { input: 'passed' },
      }),
    ).toBe(true);
    expect(isOrchestrateSupportTurnResponse({ schemaVersion: 1, intent: 'question' })).toBe(false);

    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ schemaVersion: 1, intent: 'question' }));
    const adapter = new PythonAIServiceAdapter('http://localhost:8000', silentLogger, fetchImpl);

    await expect(
      adapter.orchestrateSupportTurn(
        { tenantId: 'tenant-1', requestId: 'req-1', correlationId: 'corr-1' },
        { conversationId: 'conv-1', visitorMessage: 'Hello', history: [] },
      ),
    ).rejects.toMatchObject({ code: 'INVALID_AI_PAYLOAD' });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:8000/v1/orchestration/run',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('rejects tool proposals that are not on the allowlist', async () => {
    expect(
      isProposeToolCallsResponse({
        schemaVersion: 1,
        calls: [{ name: 'getOrderDetails', arguments: { orderId: '1' } }],
        reason: null,
      }),
    ).toBe(true);
    expect(isProposeToolCallsResponse({ schemaVersion: 1, calls: [{ name: 'rm', arguments: {} }] })).toBe(false);

    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ schemaVersion: 1, calls: [{ name: 'rm', arguments: {} }] }));
    const adapter = new PythonAIServiceAdapter('http://localhost:8000', silentLogger, fetchImpl);

    await expect(
      adapter.proposeToolCalls(
        { tenantId: 'tenant-1', requestId: 'req-1', correlationId: 'corr-1' },
        { conversationId: 'conv-1', visitorMessage: 'Where is my order?' },
      ),
    ).rejects.toMatchObject({ code: 'INVALID_AI_PAYLOAD' });
  });

  it('rejects RAG playground payloads that omit chunks', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ schemaVersion: 1, query: 'refunds' }));
    const adapter = new PythonAIServiceAdapter('http://localhost:8000', silentLogger, fetchImpl);

    await expect(
      adapter.runRagPlayground(
        { tenantId: 'tenant-1', requestId: 'req-1', correlationId: 'corr-1' },
        { query: 'How long do refunds take?', generate: true },
      ),
    ).rejects.toMatchObject({ code: 'INVALID_AI_PAYLOAD' });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:8000/v1/knowledge/playground',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
