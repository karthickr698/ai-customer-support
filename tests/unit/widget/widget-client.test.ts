import { describe, expect, it } from 'vitest';
import { isWidgetStreamEvent } from '@ai-customer-support/contracts';
import { parseSseChunk } from '../../../apps/widget/src/api/parse-sse.ts';
import { contrastForeground, normalizeHexColor } from '../../../apps/widget/src/theme.ts';

describe('widget stream contracts', () => {
  it('accepts typing, delta, and error events', () => {
    expect(isWidgetStreamEvent({ type: 'typing', active: true })).toBe(true);
    expect(isWidgetStreamEvent({ type: 'delta', text: 'Hello' })).toBe(true);
    expect(isWidgetStreamEvent({ type: 'error', code: 'AI_PROVIDER_ERROR', message: 'failed' })).toBe(true);
    expect(isWidgetStreamEvent({ type: 'delta' })).toBe(false);
  });
});

describe('parseSseChunk', () => {
  it('parses complete frames and keeps a partial tail', () => {
    const { frames, rest } = parseSseChunk(
      'event: delta\ndata: {"type":"delta","text":"Hi"}\n\nevent: typing\ndata: {"type":"typing","active":false}\n\nevent: done\ndata: {',
    );

    expect(frames).toEqual([
      { event: 'delta', data: '{"type":"delta","text":"Hi"}' },
      { event: 'typing', data: '{"type":"typing","active":false}' },
    ]);
    expect(rest).toBe('event: done\ndata: {');
  });
});

describe('widget theme', () => {
  it('normalizes short hex and picks a contrasting foreground', () => {
    expect(normalizeHexColor('#26e')).toBe('#2266ee');
    expect(contrastForeground('#ffffff')).toBe('#0f172a');
    expect(contrastForeground('#2563eb')).toBe('#ffffff');
  });
});
