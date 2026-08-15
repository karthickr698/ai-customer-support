import type { EventBus, Page, PageRequest } from '@ai-customer-support/shared';
import { OrganizationNotFoundError } from '../domain/errors.js';
import { OrganizationStatusChangedEvent } from '../domain/events.js';
import type { OrganizationStatus } from '../domain/organization.js';
import { createOrganizationId } from '../domain/organization-id.js';
import type {
  OrganizationCatalogFilter,
  OrganizationCatalogPort,
  OrganizationCatalogRecord,
} from './ports/organization-catalog-port.js';
import type { OrganizationRepository } from './ports/organization-repository.js';

export class OrganizationAdminQuery {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly catalog: OrganizationCatalogPort,
    private readonly eventBus: EventBus,
  ) {}

  list(
    page: PageRequest,
    filter?: OrganizationCatalogFilter,
  ): Promise<Page<OrganizationCatalogRecord>> {
    return this.catalog.list(page, filter);
  }

  get(organizationId: string): Promise<OrganizationCatalogRecord | null> {
    return this.catalog.findSummary(createOrganizationId(organizationId));
  }

  async setStatus(input: {
    readonly organizationId: string;
    readonly status: OrganizationStatus;
    readonly now: Date;
    readonly correlationId?: string;
  }): Promise<OrganizationCatalogRecord> {
    const id = createOrganizationId(input.organizationId);
    const organization = await this.organizations.findById(id);
    if (!organization) {
      throw new OrganizationNotFoundError();
    }

    const previousStatus = organization.status;
    if (input.status === 'disabled') {
      organization.disable(input.now);
    } else {
      organization.enable(input.now);
    }

    if (previousStatus !== organization.status) {
      await this.organizations.save(organization);
      await this.eventBus.publish(
        new OrganizationStatusChangedEvent(
          crypto.randomUUID(),
          input.now,
          organization.id,
          organization.id,
          organization.status,
          previousStatus,
          input.correlationId,
        ),
      );
    }

    const summary = await this.catalog.findSummary(organization.id);
    if (!summary) {
      throw new OrganizationNotFoundError();
    }
    return summary;
  }
}
