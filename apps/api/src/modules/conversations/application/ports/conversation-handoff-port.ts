export type ConversationHandoffResult = {
  readonly handedOff: boolean;
  readonly conversationId: string;
  readonly assignedAgentId: string | null;
  readonly status: string;
  readonly reason: string | undefined;
};

export interface ConversationHandoffPort {
  handoffToHuman(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly conversationId: string;
    readonly reason?: string;
    readonly correlationId?: string;
  }): Promise<ConversationHandoffResult>;
}
