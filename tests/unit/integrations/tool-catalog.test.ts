import { describe, expect, it } from 'vitest';
import { InvalidToolCallError, UnknownToolError } from '../../../apps/api/src/modules/integrations/domain/errors.ts';
import { validateToolArguments } from '../../../apps/api/src/modules/integrations/domain/tool-catalog.ts';
import { assertSafeHttpsUrl } from '../../../apps/api/src/modules/integrations/domain/outbound-url.ts';
import { isProposeToolCallsResponse, isToolName } from '@ai-customer-support/contracts';

describe('tool catalog schema validation', () => {
  it('accepts allowlisted handoff arguments', () => {
    const result = validateToolArguments('handoffToAgent', {
      conversationId: '11111111-1111-1111-1111-111111111111',
      reason: 'Customer asked for a human',
    });
    expect(result.definition.side).toBe('write');
    expect(result.definition.retry.maxAttempts).toBe(1);
    expect(result.arguments.reason).toBe('Customer asked for a human');
  });

  it('rejects unknown tools and extra properties', () => {
    expect(() => validateToolArguments('dropDatabase', {})).toThrow(UnknownToolError);
    expect(() =>
      validateToolArguments('getOrderDetails', { orderId: 'ORD-1', inject: true }),
    ).toThrow(InvalidToolCallError);
  });

  it('requires customer identity and ticket updates', () => {
    expect(() => validateToolArguments('getCustomerDetails', {})).toThrow(InvalidToolCallError);
    expect(() =>
      validateToolArguments('updateTicket', { ticketId: '11111111-1111-1111-1111-111111111111' }),
    ).toThrow(InvalidToolCallError);
  });

  it('rejects non-https integration URLs', () => {
    expect(() => assertSafeHttpsUrl('http://example.com')).toThrow();
    expect(() => assertSafeHttpsUrl('https://user:pass@example.com')).toThrow();
    expect(assertSafeHttpsUrl('https://api.example.com/v1')).toContain('https://');
  });

  it('validates Python tool proposal contracts', () => {
    expect(isToolName('createTicket')).toBe(true);
    expect(
      isProposeToolCallsResponse({
        schemaVersion: 1,
        calls: [{ name: 'getOrderDetails', arguments: { orderId: '1' } }],
        reason: null,
      }),
    ).toBe(true);
    expect(isProposeToolCallsResponse({ schemaVersion: 1, calls: [{ name: 'nope', arguments: {} }] })).toBe(
      false,
    );
  });
});
