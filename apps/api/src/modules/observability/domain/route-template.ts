const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export function routeTemplate(path: string): string {
  const normalized = path.split('?')[0] ?? path;
  return normalized.replace(UUID_PATTERN, ':id');
}

export function shouldSkipObservabilityPath(path: string): boolean {
  const normalized = (path.split('?')[0] ?? path).toLowerCase();
  if (normalized === '/health' || normalized === '/ready') {
    return true;
  }
  return normalized.includes('/observability');
}

export function incidentFingerprint(input: {
  readonly source: string;
  readonly errorCode?: string;
  readonly route?: string;
  readonly organizationId?: string;
}): string {
  return [input.source, input.errorCode ?? 'unknown', input.route ?? '*', input.organizationId ?? 'platform'].join(
    ':',
  );
}
