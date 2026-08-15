const DEFAULT_AUTHENTICATED_PATH = '/organizations';

export function safeNextPath(next: string | null | undefined, fallback = DEFAULT_AUTHENTICATED_PATH): string {
  if (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')) {
    return next;
  }

  return fallback;
}

export function loginPathWithNext(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`;
}
