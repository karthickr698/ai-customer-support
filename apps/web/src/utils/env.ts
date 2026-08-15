function readUrl(value: string | undefined, fallback: string): string {
  const raw = value?.trim() ?? '';
  if (raw === '') {
    return fallback;
  }

  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname}`.replace(/\/$/, '');
  } catch {
    throw new Error('Frontend URL environment variables must be valid absolute URLs when set');
  }
}

function readApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL?.trim() ?? '';

  if (raw === '') {
    return '';
  }

  return readUrl(raw, '');
}

export const env = {
  apiBaseUrl: readApiBaseUrl(),
  publicApiUrl: readUrl(
    import.meta.env.VITE_PUBLIC_API_URL ?? import.meta.env.VITE_API_BASE_URL,
    import.meta.env.DEV ? 'http://localhost:3000' : '',
  ),
  widgetOrigin: readUrl(import.meta.env.VITE_WIDGET_ORIGIN, import.meta.env.DEV ? 'http://localhost:5174' : ''),
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
} as const;
