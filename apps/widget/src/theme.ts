import type { WidgetPosition } from '@ai-customer-support/contracts';

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export type WidgetTheme = {
  readonly primary: string;
  readonly primaryForeground: string;
  readonly position: WidgetPosition;
};

export function isHexColor(value: string): boolean {
  return HEX.test(value.trim());
}

export function normalizeHexColor(value: string, fallback = '#2563eb'): string {
  const color = value.trim();
  if (!HEX.test(color)) {
    return fallback;
  }

  if (color.length === 4) {
    const r = color[1];
    const g = color[2];
    const b = color[3];
    if (!r || !g || !b) {
      return fallback;
    }

    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  return color.toLowerCase();
}

export function contrastForeground(hex: string): string {
  const { r, g, b } = parseRgb(normalizeHexColor(hex));
  const luminance = relativeLuminance(r, g, b);
  return luminance > 0.45 ? '#0f172a' : '#ffffff';
}

export function applyWidgetTheme(root: HTMLElement, theme: WidgetTheme): void {
  root.style.setProperty('--acs-primary', theme.primary);
  root.style.setProperty('--acs-primary-foreground', theme.primaryForeground);
  root.dataset.position = theme.position;
}

function parseRgb(hex: string): { r: number; g: number; b: number } {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [red, green, blue] = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0);
}
