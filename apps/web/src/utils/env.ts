function readApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL?.trim() ?? '';

  if (raw === '') {
    return '';
  }

  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname}`.replace(/\/$/, '');
  } catch {
    throw new Error('VITE_API_BASE_URL must be a valid absolute URL when set');
  }
}

export const env = {
  apiBaseUrl: readApiBaseUrl(),
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
} as const;
