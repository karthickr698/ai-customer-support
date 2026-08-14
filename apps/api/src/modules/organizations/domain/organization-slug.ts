import { InvalidOrganizationSlugError } from './errors.js';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MIN_LENGTH = 3;
const MAX_LENGTH = 48;

export class OrganizationSlug {
  private constructor(readonly value: string) {}

  static parse(raw: string): OrganizationSlug {
    const slug = raw.trim().toLowerCase();

    if (slug.length < MIN_LENGTH || slug.length > MAX_LENGTH || !SLUG_PATTERN.test(slug)) {
      throw new InvalidOrganizationSlugError();
    }

    return new OrganizationSlug(slug);
  }

  static fromName(name: string): OrganizationSlug {
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, MAX_LENGTH)
      .replace(/-+$/g, '');

    if (slug.length >= MIN_LENGTH && SLUG_PATTERN.test(slug)) {
      return new OrganizationSlug(slug);
    }

    return new OrganizationSlug(`org-${crypto.randomUUID().slice(0, 8)}`);
  }

  withUniqueSuffix(): OrganizationSlug {
    const suffix = `-${crypto.randomUUID().slice(0, 8)}`;
    const base = this.value.slice(0, MAX_LENGTH - suffix.length).replace(/-+$/g, '');
    return new OrganizationSlug(`${base}${suffix}`);
  }
}
