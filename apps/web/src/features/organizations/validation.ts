export const ORGANIZATION_NAME_MAX = 80;
export const ORGANIZATION_SLUG_MIN = 3;
export const ORGANIZATION_SLUG_MAX = 48;
export const ORGANIZATION_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateOrganizationName(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return 'Organization name is required';
  }
  if (trimmed.length > ORGANIZATION_NAME_MAX) {
    return `Name must be at most ${String(ORGANIZATION_NAME_MAX)} characters`;
  }
  return undefined;
}

export function validateOrganizationSlug(value: string): string | undefined {
  const slug = value.trim().toLowerCase();
  if (slug.length < ORGANIZATION_SLUG_MIN) {
    return `Slug must be at least ${String(ORGANIZATION_SLUG_MIN)} characters`;
  }
  if (slug.length > ORGANIZATION_SLUG_MAX) {
    return `Slug must be at most ${String(ORGANIZATION_SLUG_MAX)} characters`;
  }
  if (!ORGANIZATION_SLUG_PATTERN.test(slug)) {
    return 'Use lowercase letters, numbers, and hyphens';
  }
  return undefined;
}
