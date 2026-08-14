export type InvitationId = string & { readonly __brand: 'InvitationId' };

export function createInvitationId(id: string = crypto.randomUUID()): InvitationId {
  return id as InvitationId;
}
