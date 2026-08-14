export const CONVERSATION_STATUSES = [
  'open',
  'pending',
  'resolved',
  'closed',
  'escalated',
] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export const CONVERSATION_CHANNELS = ['web', 'email', 'api', 'widget'] as const;
export type ConversationChannel = (typeof CONVERSATION_CHANNELS)[number];

export const MESSAGE_AUTHOR_TYPES = ['customer', 'agent', 'system', 'ai'] as const;
export type MessageAuthorType = (typeof MESSAGE_AUTHOR_TYPES)[number];

export type ConversationAssigneeDto = {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
};

export type ConversationDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly customerId: string | null;
  readonly customerEmail: string;
  readonly customerName: string;
  readonly subject: string | null;
  readonly status: ConversationStatus;
  readonly assignedAgentId: string | null;
  readonly assignedAgent: ConversationAssigneeDto | null;
  readonly channel: ConversationChannel;
  readonly widgetSessionId: string | null;
  readonly tags: readonly string[];
  readonly lastMessageAt: string | null;
  readonly lastMessagePreview: string | null;
  readonly createdByUserId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type MessageAttachmentDto = {
  readonly id: string;
  readonly conversationId: string;
  readonly messageId: string | null;
  readonly fileName: string;
  readonly contentType: string;
  readonly byteSize: number;
  readonly createdAt: string;
};

export type MessageDto = {
  readonly id: string;
  readonly conversationId: string;
  readonly authorType: MessageAuthorType;
  readonly authorId: string | null;
  readonly body: string;
  readonly attachments: readonly MessageAttachmentDto[];
  readonly createdAt: string;
};

export type ConversationNoteDto = {
  readonly id: string;
  readonly conversationId: string;
  readonly authorId: string;
  readonly body: string;
  readonly createdAt: string;
};

export type CreateConversationRequest = {
  readonly customerEmail: string;
  readonly customerName: string;
  readonly customerId?: string;
  readonly subject?: string;
  readonly channel?: ConversationChannel;
  readonly tags?: readonly string[];
  readonly assignedAgentId?: string;
  readonly initialMessage?: string;
  readonly initialMessageAuthor?: Extract<MessageAuthorType, 'customer' | 'agent'>;
};

export type ChangeConversationStatusRequest = {
  readonly status: Exclude<ConversationStatus, 'escalated'>;
};

export type AssignConversationRequest = {
  readonly assignedAgentId: string;
};

export type EscalateConversationRequest = {
  readonly reason?: string;
};

export const ESCALATION_TRIGGER_TYPES = [
  'unanswered_for',
  'unassigned_for',
  'assigned_agent_offline',
  'keyword_match',
] as const;
export type EscalationTriggerType = (typeof ESCALATION_TRIGGER_TYPES)[number];

export const ESCALATION_ACTIONS = ['escalate', 'escalate_and_unassign', 'assign_available'] as const;
export type EscalationAction = (typeof ESCALATION_ACTIONS)[number];

export type EscalationRuleDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly triggerType: EscalationTriggerType;
  readonly triggerMinutes: number | null;
  readonly keywords: readonly string[];
  readonly action: EscalationAction;
  readonly priority: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CreateEscalationRuleRequest = {
  readonly name: string;
  readonly enabled?: boolean;
  readonly triggerType: EscalationTriggerType;
  readonly triggerMinutes?: number;
  readonly keywords?: readonly string[];
  readonly action: EscalationAction;
  readonly priority?: number;
};

export type UpdateEscalationRuleRequest = {
  readonly name?: string;
  readonly enabled?: boolean;
  readonly triggerType?: EscalationTriggerType;
  readonly triggerMinutes?: number | null;
  readonly keywords?: readonly string[];
  readonly action?: EscalationAction;
  readonly priority?: number;
};

export type EscalationRuleResponse = {
  readonly rule: EscalationRuleDto;
};

export type EscalationRuleListResponse = {
  readonly items: readonly EscalationRuleDto[];
};

export type EvaluateEscalationRulesResponse = {
  readonly applied: number;
};

export type AddConversationTagRequest = {
  readonly name: string;
};

export type SendMessageRequest = {
  readonly body?: string;
  readonly authorType?: Extract<MessageAuthorType, 'customer' | 'agent'>;
  readonly attachmentIds?: readonly string[];
};

export type MessageAttachmentResponse = {
  readonly attachment: MessageAttachmentDto;
};

export type AddConversationNoteRequest = {
  readonly body: string;
};

export type ConversationResponse = {
  readonly conversation: ConversationDto;
};

export type ConversationListResponse = {
  readonly items: readonly ConversationDto[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};

export type MessageResponse = {
  readonly message: MessageDto;
  readonly conversation: ConversationDto;
};

export type MessageListResponse = {
  readonly items: readonly MessageDto[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};

export type ConversationNoteResponse = {
  readonly note: ConversationNoteDto;
};

export type ConversationNoteListResponse = {
  readonly items: readonly ConversationNoteDto[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};
