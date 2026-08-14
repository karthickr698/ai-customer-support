export type InvitationEmailMessage = {
  readonly to: string;
  readonly organizationName: string;
  readonly role: string;
  readonly acceptUrl: string;
};

export interface InvitationEmailPort {
  sendInvitation(message: InvitationEmailMessage): Promise<void>;
}
