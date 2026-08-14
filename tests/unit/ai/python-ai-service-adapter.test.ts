import { isAIServiceHealthResponse } from '@ai-customer-support/contracts';
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
});
