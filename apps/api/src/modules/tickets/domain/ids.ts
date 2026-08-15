export type TicketId = string & { readonly __brand: 'TicketId' };
export type TicketNoteId = string & { readonly __brand: 'TicketNoteId' };
export type TicketAttachmentId = string & { readonly __brand: 'TicketAttachmentId' };
export type TicketSlaPolicyId = string & { readonly __brand: 'TicketSlaPolicyId' };
export type TicketEscalationPolicyId = string & { readonly __brand: 'TicketEscalationPolicyId' };

export function createTicketId(id: string = crypto.randomUUID()): TicketId {
  return id as TicketId;
}

export function createTicketNoteId(id: string = crypto.randomUUID()): TicketNoteId {
  return id as TicketNoteId;
}

export function createTicketAttachmentId(id: string = crypto.randomUUID()): TicketAttachmentId {
  return id as TicketAttachmentId;
}

export function createTicketSlaPolicyId(id: string = crypto.randomUUID()): TicketSlaPolicyId {
  return id as TicketSlaPolicyId;
}

export function createTicketEscalationPolicyId(id: string = crypto.randomUUID()): TicketEscalationPolicyId {
  return id as TicketEscalationPolicyId;
}
