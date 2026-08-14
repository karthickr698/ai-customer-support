export type OrganizationId = string & { readonly __brand: 'OrganizationId' };

export function createOrganizationId(id: string = crypto.randomUUID()): OrganizationId {
  return id as OrganizationId;
}
