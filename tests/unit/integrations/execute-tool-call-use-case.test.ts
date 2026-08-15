import { describe, expect, it } from 'vitest';
import { ExecuteToolCallUseCase } from '../../../apps/api/src/modules/integrations/application/use-cases/execute-tool-call-use-case.ts';
import { UpsertIntegrationCredentialUseCase } from '../../../apps/api/src/modules/integrations/application/use-cases/credential-use-cases.ts';
import { InvalidToolCallError, ToolCredentialRequiredError } from '../../../apps/api/src/modules/integrations/domain/errors.ts';
import {
  FakeHttpInvoker,
  FakeOAuthExchange,
  MemoryConnectors,
  MemoryCredentials,
  MemoryInvocations,
  RecordingEvents,
  actorId,
  agentAccess,
  cipher,
  now,
  ownerAccess,
  platform,
  security,
  tenantId,
} from './fakes.ts';

const conversationId = '22222222-2222-2222-2222-222222222222';

function executeUseCase(http = new FakeHttpInvoker({ status: 200, data: { orderId: 'ORD-1' }, attemptCount: 1 })) {
  const invocations = new MemoryInvocations();
  const credentials = new MemoryCredentials();
  const connectors = new MemoryConnectors();
  const events = new RecordingEvents();
  const useCase = new ExecuteToolCallUseCase(
    ownerAccess,
    invocations,
    credentials,
    connectors,
    cipher,
    http,
    new FakeOAuthExchange(),
    platform,
    { now: () => now },
    events,
  );
  return { useCase, invocations, credentials, events, http };
}

describe('ExecuteToolCallUseCase', () => {
  it('schema-validates, executes platform tools, and writes an audit trail', async () => {
    const { useCase, invocations, events } = executeUseCase();
    const result = await useCase.execute({
      tenantId,
      actorId,
      name: 'handoffToAgent',
      arguments: { conversationId, reason: 'Customer requested a human' },
      conversationId,
      security,
    });

    expect(result.invocation.status).toBe('succeeded');
    expect(result.invocation.result?.handedOff).toBe(true);
    expect(invocations.items.size).toBe(1);
    expect(events.names).toContain('ToolCallExecuted');
  });

  it('rejects extra arguments before execution', async () => {
    const { useCase, invocations } = executeUseCase();
    await expect(
      useCase.execute({
        tenantId,
        actorId,
        name: 'handoffToAgent',
        arguments: { conversationId, reason: 'help', extra: true },
        security,
      }),
    ).rejects.toBeInstanceOf(InvalidToolCallError);
    expect(invocations.items.size).toBe(0);
  });

  it('requires a tenant credential or OAuth connector for HTTP tools', async () => {
    const { useCase } = executeUseCase();
    await expect(
      useCase.execute({
        tenantId,
        actorId,
        name: 'getOrderDetails',
        arguments: { orderId: 'ORD-1' },
        security,
      }),
    ).rejects.toBeInstanceOf(ToolCredentialRequiredError);
  });

  it('sends tenant-scoped credentials on HTTP tools and never retries writes', async () => {
    const http = new FakeHttpInvoker({ status: 200, data: { status: 'paid' }, attemptCount: 1 });
    const { useCase, credentials } = executeUseCase(http);
    const upsert = new UpsertIntegrationCredentialUseCase(
      ownerAccess,
      credentials,
      cipher,
      { now: () => now },
      new RecordingEvents(),
    );
    await upsert.execute({
      tenantId,
      actorId,
      toolName: 'getOrderDetails',
      name: 'Shopify',
      kind: 'bearer',
      secret: 'shopify-secret-key',
      baseUrl: 'https://shop.example.com',
      security,
    });

    const result = await useCase.execute({
      tenantId,
      actorId,
      name: 'getOrderDetails',
      arguments: { orderId: 'ORD-9' },
      security,
    });

    expect(result.invocation.status).toBe('succeeded');
    expect(http.calls).toHaveLength(1);
    expect(http.calls[0]?.url).toBe('https://shop.example.com/orders/lookup');
    expect(http.calls[0]?.headers.Authorization).toBe('Bearer shopify-secret-key');
    expect(http.calls[0]?.maxAttempts).toBe(3);
    expect(JSON.stringify(result.invocation.result)).not.toContain('shopify-secret-key');
  });

  it('denies agents from managing credentials', async () => {
    const upsert = new UpsertIntegrationCredentialUseCase(
      agentAccess,
      new MemoryCredentials(),
      cipher,
      { now: () => now },
      new RecordingEvents(),
    );
    await expect(
      upsert.execute({
        tenantId,
        actorId: 'agent-1',
        toolName: 'getOrderDetails',
        name: 'Shopify',
        kind: 'bearer',
        secret: 'shopify-secret-key',
        baseUrl: 'https://shop.example.com',
        security,
      }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_PERMISSION' });
  });
});
