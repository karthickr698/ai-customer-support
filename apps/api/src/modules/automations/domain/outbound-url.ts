import { UnsafeAutomationUrlError } from './errors.js';

const BLOCKED_HOSTS = new Set(['localhost', 'metadata.google.internal']);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function assertSafeAutomationUrl(
  raw: string,
  label = 'URL',
  options?: { readonly allowLocalHttp?: boolean },
): string {
  const url = raw.trim();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new UnsafeAutomationUrlError(`${label} must be a valid URL`);
  }

  if (parsed.username || parsed.password) {
    throw new UnsafeAutomationUrlError(`${label} must not include credentials`);
  }

  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  const localHttpAllowed =
    Boolean(options?.allowLocalHttp) && parsed.protocol === 'http:' && LOCAL_HOSTS.has(host);

  if (parsed.protocol !== 'https:' && !localHttpAllowed) {
    throw new UnsafeAutomationUrlError(`${label} must use https`);
  }

  if (!localHttpAllowed && (BLOCKED_HOSTS.has(host) || host.endsWith('.local') || host.endsWith('.internal'))) {
    throw new UnsafeAutomationUrlError(`${label} host is not allowed`);
  }

  if (isPrivateHost(host) && !localHttpAllowed) {
    throw new UnsafeAutomationUrlError(`${label} host is not allowed`);
  }

  return url;
}

function isPrivateHost(host: string): boolean {
  if (host === '0.0.0.0' || host === '::' || host === '[::]') {
    return true;
  }
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
    return true;
  }
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) {
    return true;
  }
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)) {
    return true;
  }
  if (host.startsWith('169.254.') || host.endsWith('.localhost')) {
    return true;
  }
  return false;
}
