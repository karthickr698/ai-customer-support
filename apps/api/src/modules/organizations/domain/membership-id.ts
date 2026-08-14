export type MembershipId = string & { readonly __brand: 'MembershipId' };

export function createMembershipId(id: string = crypto.randomUUID()): MembershipId {
  return id as MembershipId;
}
