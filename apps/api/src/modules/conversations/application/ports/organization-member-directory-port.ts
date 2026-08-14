export type OrganizationMemberRecord = {
  readonly userId: string;
  readonly role: string;
};

export interface OrganizationMemberDirectoryPort {
  findActiveMember(tenantId: string, userId: string): Promise<OrganizationMemberRecord | null>;
}
