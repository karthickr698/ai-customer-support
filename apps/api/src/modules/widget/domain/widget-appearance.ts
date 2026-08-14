import type { WidgetPosition } from '@ai-customer-support/contracts';
import { InvalidWidgetConfigurationError } from './errors.js';

export const WIDGET_POSITIONS = ['left', 'right'] as const;

const COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isWidgetPosition(value: string): value is WidgetPosition {
  return (WIDGET_POSITIONS as readonly string[]).includes(value);
}

export function parseWidgetPosition(value: string): WidgetPosition {
  if (!isWidgetPosition(value)) {
    throw new InvalidWidgetConfigurationError('Position must be left or right');
  }

  return value;
}

export function parsePrimaryColor(value: string): string {
  const color = value.trim();
  if (!COLOR_PATTERN.test(color)) {
    throw new InvalidWidgetConfigurationError('Primary color must be a hex value such as #2563eb');
  }

  return color.toLowerCase();
}

export function parseAllowedOrigin(value: string): string {
  const origin = value.trim();
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new InvalidWidgetConfigurationError('Allowed origins must start with http or https');
    }

    return parsed.origin;
  } catch (error: unknown) {
    if (error instanceof InvalidWidgetConfigurationError) {
      throw error;
    }

    throw new InvalidWidgetConfigurationError('Enter a valid origin URL');
  }
}

export function generateWidgetPublicKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return `wk_${Buffer.from(bytes).toString('base64url')}`;
}
