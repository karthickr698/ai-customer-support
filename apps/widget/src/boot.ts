import type { WidgetPosition } from '@ai-customer-support/contracts';
import { isHexColor, normalizeHexColor } from './theme';

export type WidgetBootConfig = {
  readonly publicKey: string;
  readonly apiBase: string;
  readonly primaryColor?: string;
  readonly position?: WidgetPosition;
  readonly startOpen: boolean;
};

export function readBootConfig(search = window.location.search): WidgetBootConfig {
  const params = new URLSearchParams(search);
  const publicKey = params.get('pk')?.trim() ?? '';
  const color = params.get('color')?.trim();
  const position = params.get('position');

  return {
    publicKey,
    apiBase: normalizeApiBase(params.get('api')?.trim() ?? defaultApiBase()),
    primaryColor: color && isHexColor(color) ? normalizeHexColor(color) : undefined,
    position: position === 'left' || position === 'right' ? position : undefined,
    startOpen: params.get('open') === '1' || params.get('open') === 'true',
  };
}

function defaultApiBase(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim() ?? '';
  return fromEnv;
}

function normalizeApiBase(value: string): string {
  if (!value) {
    return '';
  }

  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`.replace(/\/$/, '');
  } catch {
    return '';
  }
}
