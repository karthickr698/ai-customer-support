import { FONT_CHOICES } from './tokens';
import type { FontId, ThemeMode, ThemePreference } from './types';

const FONT_LINK_ID = 'app-theme-font';

function ensureFontLink(): HTMLLinkElement {
  const existing = document.getElementById(FONT_LINK_ID);

  if (existing instanceof HTMLLinkElement) {
    return existing;
  }

  const link = document.createElement('link');
  link.id = FONT_LINK_ID;
  link.rel = 'stylesheet';
  document.head.appendChild(link);
  return link;
}

function resolveDark(mode: ThemeMode): boolean {
  if (mode === 'dark') {
    return true;
  }

  if (mode === 'light') {
    return false;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function fontChoice(font: FontId) {
  const found = FONT_CHOICES.find((choice) => choice.id === font);
  if (found) {
    return found;
  }

  const fallback = FONT_CHOICES[0];
  if (!fallback) {
    throw new Error('FONT_CHOICES must contain at least one font');
  }

  return fallback;
}

export function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;
  const font = fontChoice(preference.font);

  root.dataset.primary = preference.primary;
  root.dataset.secondary = preference.secondary;
  root.dataset.font = preference.font;
  root.dataset.skin = preference.skin;
  root.classList.toggle('dark', resolveDark(preference.mode));

  if (font) {
    root.style.setProperty('--app-font-family', font.family);
    ensureFontLink().href = font.href;
  }
}

export function watchSystemMode(mode: ThemeMode, onChange: () => void): () => void {
  if (mode !== 'system') {
    return () => undefined;
  }

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const listener = () => {
    onChange();
  };

  media.addEventListener('change', listener);
  return () => {
    media.removeEventListener('change', listener);
  };
}
