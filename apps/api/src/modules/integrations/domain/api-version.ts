export const PUBLIC_API_VERSION = 'v1' as const;
export const PUBLIC_API_PREFIX = '/api/v1' as const;
export const DASHBOARD_API_PREFIX = '/api' as const;
export const PUBLIC_API_VERSION_HEADER = 'x-api-version' as const;

export const API_KEY_TOKEN_PREFIX = 'acs_live_';
export const OAUTH_CLIENT_ID_PREFIX = 'acs_oa_';
export const OAUTH_CLIENT_SECRET_PREFIX = 'acs_oas_';
export const OAUTH_ACCESS_TOKEN_PREFIX = 'acs_atk_';
export const OAUTH_REFRESH_TOKEN_PREFIX = 'acs_rtk_';
export const OAUTH_AUTHORIZATION_CODE_PREFIX = 'acs_ac_';

export const DEFAULT_API_SCOPES = ['organization.read', 'conversation.read'] as const;
export const MAX_API_KEYS_PER_ORGANIZATION = 25;
export const MAX_WEBHOOKS_PER_ORGANIZATION = 25;
export const MAX_OAUTH_APPLICATIONS_PER_ORGANIZATION = 10;
export const MAX_SCOPES = 20;
export const MAX_USAGE_PATH_LENGTH = 500;
export const MAX_USAGE_USER_AGENT_LENGTH = 400;

export function isVersionedApiPath(path: string): boolean {
  return path === PUBLIC_API_PREFIX || path.startsWith(`${PUBLIC_API_PREFIX}/`);
}

export function isPublicApiDocumentationPath(path: string): boolean {
  return (
    path === PUBLIC_API_PREFIX ||
    path === `${PUBLIC_API_PREFIX}/openapi.json` ||
    path === `${PUBLIC_API_PREFIX}/docs`
  );
}

export function normalizePublicApiRoute(path: string): string {
  const withoutQuery = path.split('?')[0] ?? path;
  return withoutQuery.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    '{id}',
  );
}
