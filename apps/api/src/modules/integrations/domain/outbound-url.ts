import { UnsafeIntegrationUrlError } from './errors.js';

const BLOCKED_HOSTS = new Set(['localhost', 'metadata.google.internal']);

export function assertSafeHttpsUrl(raw: string, label = 'URL'): string {
  const url = raw.trim();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new UnsafeIntegrationUrlError(`${label} must be a valid URL`);
  }

  if (parsed.protocol !== 'https:') {
    throw new UnsafeIntegrationUrlError(`${label} must use https`);
  }
  if (parsed.username || parsed.password) {
    throw new UnsafeIntegrationUrlError(`${label} must not include credentials`);
  }

  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (BLOCKED_HOSTS.has(host) || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new UnsafeIntegrationUrlError(`${label} host is not allowed`);
  }

  return url;
}

export function joinSafeUrl(baseUrl: string, path: string): string {
  const base = assertSafeHttpsUrl(baseUrl, 'Base URL');
  const trimmed = path.startsWith('/') ? path : `/${path}`;
  return new URL(trimmed, base.endsWith('/') ? base : `${base}/`).toString();
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function assertSafeCallbackUrl(
  raw: string,
  label = 'URL',
  options?: { readonly allowLocalHttp?: boolean },
): string {
  const url = raw.trim();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new UnsafeIntegrationUrlError(`${label} must be a valid URL`);
  }

  if (parsed.username || parsed.password) {
    throw new UnsafeIntegrationUrlError(`${label} must not include credentials`);
  }

  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  const localHttpAllowed =
    Boolean(options?.allowLocalHttp) && parsed.protocol === 'http:' && LOCAL_HOSTS.has(host);

  if (parsed.protocol !== 'https:' && !localHttpAllowed) {
    throw new UnsafeIntegrationUrlError(`${label} must use https`);
  }

  if (!localHttpAllowed && (BLOCKED_HOSTS.has(host) || host.endsWith('.local') || host.endsWith('.internal'))) {
    throw new UnsafeIntegrationUrlError(`${label} host is not allowed`);
  }

  return url;
}
