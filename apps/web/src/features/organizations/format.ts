export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

export function initials(name: string, email?: string): string {
  const source = name.trim() || email?.split('@')[0] || '?';
  const parts = source.split(/[\s._-]+/).filter((part) => part.length > 0);

  if (parts.length >= 2) {
    const first = parts[0]?.[0];
    const second = parts[1]?.[0];
    if (first && second) {
      return `${first}${second}`.toUpperCase();
    }
  }

  return source.slice(0, 2).toUpperCase();
}
