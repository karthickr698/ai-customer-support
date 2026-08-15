export type TicketIntakeCommand = {
  readonly tenantId: string;
  readonly conversationId: string;
  readonly customerEmail: string;
  readonly customerName: string;
  readonly description: string;
  readonly actorId: string;
  readonly source: 'ai_conversation' | 'escalation';
  readonly customerId?: string;
  readonly subject?: string;
  readonly assignedAgentId?: string;
  readonly priority?: string;
  readonly correlationId?: string;
};

export type TicketIntakeResult = {
  readonly ticketId: string;
  readonly created: boolean;
};

export interface TicketIntakePort {
  openFromConversation(command: TicketIntakeCommand): Promise<TicketIntakeResult>;
}
