import { InvalidOrganizationNameError, OrganizationDisabledError } from './errors.js';
import { createOrganizationId, type OrganizationId } from './organization-id.js';
import { OrganizationSlug } from './organization-slug.js';

export type OrganizationStatus = 'active' | 'disabled';

export type OrganizationSnapshot = {
  readonly id: OrganizationId;
  readonly name: string;
  readonly slug: string;
  readonly status: OrganizationStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export class Organization {
  private constructor(
    readonly id: OrganizationId,
    private nameValue: string,
    private slugValue: OrganizationSlug,
    private statusValue: OrganizationStatus,
    readonly createdAt: Date,
    private updatedAtValue: Date,
  ) {}

  static create(input: {
    readonly name: string;
    readonly slug: OrganizationSlug;
    readonly now: Date;
    readonly id?: OrganizationId;
  }): Organization {
    return new Organization(
      input.id ?? createOrganizationId(),
      normalizeName(input.name),
      input.slug,
      'active',
      input.now,
      input.now,
    );
  }

  static reconstitute(snapshot: OrganizationSnapshot): Organization {
    return new Organization(
      snapshot.id,
      snapshot.name,
      OrganizationSlug.parse(snapshot.slug),
      snapshot.status,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get name(): string {
    return this.nameValue;
  }

  get slug(): OrganizationSlug {
    return this.slugValue;
  }

  get status(): OrganizationStatus {
    return this.statusValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  assertActive(): void {
    if (this.statusValue === 'disabled') {
      throw new OrganizationDisabledError();
    }
  }

  rename(name: string, now: Date): void {
    this.assertActive();
    this.nameValue = normalizeName(name);
    this.updatedAtValue = now;
  }

  changeSlug(slug: OrganizationSlug, now: Date): void {
    this.assertActive();
    this.slugValue = slug;
    this.updatedAtValue = now;
  }

  disable(now: Date): void {
    if (this.statusValue === 'disabled') {
      return;
    }
    this.statusValue = 'disabled';
    this.updatedAtValue = now;
  }

  enable(now: Date): void {
    if (this.statusValue === 'active') {
      return;
    }
    this.statusValue = 'active';
    this.updatedAtValue = now;
  }

  toSnapshot(): OrganizationSnapshot {
    return {
      id: this.id,
      name: this.nameValue,
      slug: this.slugValue.value,
      status: this.statusValue,
      createdAt: this.createdAt,
      updatedAt: this.updatedAtValue,
    };
  }
}

function normalizeName(raw: string): string {
  const name = raw.trim();

  if (name.length < 1 || name.length > 80) {
    throw new InvalidOrganizationNameError();
  }

  return name;
}
