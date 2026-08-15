import { ORGANIZATION_PERMISSIONS, type OrganizationPermission } from '@ai-customer-support/contracts';
import { InvalidApiKeyError, InvalidOAuthApplicationError } from './errors.js';
import { DEFAULT_API_SCOPES, MAX_SCOPES } from './api-version.js';

const PERMISSIONS = ORGANIZATION_PERMISSIONS as readonly string[];

export function parseApiScopes(
  raw: readonly string[] | undefined,
  fallback: readonly string[] = DEFAULT_API_SCOPES,
): readonly OrganizationPermission[] {
  const source = raw && raw.length > 0 ? raw : fallback;
  const unique = [...new Set(source.map((item) => item.trim()).filter((item) => item.length > 0))];
  if (unique.length === 0) {
    throw new InvalidApiKeyError('At least one scope is required');
  }
  if (unique.length > MAX_SCOPES) {
    throw new InvalidApiKeyError(`At most ${MAX_SCOPES} scopes are allowed`);
  }
  for (const scope of unique) {
    if (!PERMISSIONS.includes(scope)) {
      throw new InvalidApiKeyError(`Unknown scope: ${scope}`);
    }
  }
  return unique as OrganizationPermission[];
}

export function parseOAuthScopes(raw: readonly string[] | undefined): readonly OrganizationPermission[] {
  try {
    return parseApiScopes(raw);
  } catch (error) {
    if (error instanceof InvalidApiKeyError) {
      throw new InvalidOAuthApplicationError(error.message);
    }
    throw error;
  }
}

export function intersectScopes(
  granted: readonly string[],
  requested: readonly string[],
): readonly OrganizationPermission[] {
  const allowed = new Set(granted);
  return requested.filter((scope) => allowed.has(scope)) as OrganizationPermission[];
}

export function parseScopeQuery(scope: string | undefined, allowed: readonly string[]): readonly OrganizationPermission[] {
  if (!scope || scope.trim().length === 0) {
    return allowed as OrganizationPermission[];
  }
  const requested = scope.split(/[+\s]+/).map((item) => item.trim()).filter((item) => item.length > 0);
  const granted = intersectScopes(allowed, requested);
  if (granted.length === 0) {
    throw new InvalidOAuthApplicationError('Requested scopes are not allowed for this application');
  }
  return granted;
}
