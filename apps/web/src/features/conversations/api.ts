import type {
  AddConversationNoteRequest,
  AddConversationTagRequest,
  AssignConversationRequest,
  ChangeConversationPriorityRequest,
  ChangeConversationStatusRequest,
  ConversationListResponse,
  ConversationNoteListResponse,
  ConversationNoteResponse,
  ConversationResponse,
  EscalateConversationRequest,
  MessageListResponse,
  MessageResponse,
  SendMessageRequest,
} from '@ai-customer-support/contracts';
import { apiClient, http } from '@/services/api-client';

export type ConversationListParams = {
  readonly page?: number;
  readonly pageSize?: number;
  readonly q?: string;
  readonly status?: string;
  readonly priority?: string;
  readonly channel?: string;
  readonly assignedAgentId?: string;
  readonly tag?: string;
};

function conversationPath(organizationId: string, conversationId: string, suffix = ''): string {
  return `/api/organizations/${organizationId}/conversations/${conversationId}${suffix}`;
}

export const conversationsApi = {
  list: (organizationId: string, params: ConversationListParams) =>
    apiClient.get<ConversationListResponse>(`/api/organizations/${organizationId}/conversations`, { params }),

  get: (organizationId: string, conversationId: string) =>
    apiClient.get<ConversationResponse>(conversationPath(organizationId, conversationId)),

  changeStatus: (organizationId: string, conversationId: string, body: ChangeConversationStatusRequest) =>
    apiClient.patch<ConversationResponse>(conversationPath(organizationId, conversationId, '/status'), body),

  changePriority: (organizationId: string, conversationId: string, body: ChangeConversationPriorityRequest) =>
    apiClient.patch<ConversationResponse>(conversationPath(organizationId, conversationId, '/priority'), body),

  assign: (organizationId: string, conversationId: string, body: AssignConversationRequest) =>
    apiClient.post<ConversationResponse>(conversationPath(organizationId, conversationId, '/assign'), body),

  assignAvailable: (organizationId: string, conversationId: string) =>
    apiClient.post<ConversationResponse>(conversationPath(organizationId, conversationId, '/assign/available')),

  unassign: (organizationId: string, conversationId: string) =>
    apiClient.post<ConversationResponse>(conversationPath(organizationId, conversationId, '/unassign')),

  takeOver: (organizationId: string, conversationId: string) =>
    apiClient.post<ConversationResponse>(conversationPath(organizationId, conversationId, '/takeover')),

  escalate: (organizationId: string, conversationId: string, body: EscalateConversationRequest = {}) =>
    apiClient.post<ConversationResponse>(conversationPath(organizationId, conversationId, '/escalate'), body),

  addTag: (organizationId: string, conversationId: string, body: AddConversationTagRequest) =>
    apiClient.post<ConversationResponse>(conversationPath(organizationId, conversationId, '/tags'), body),

  removeTag: (organizationId: string, conversationId: string, tag: string) =>
    apiClient.delete<ConversationResponse>(
      conversationPath(organizationId, conversationId, `/tags/${encodeURIComponent(tag)}`),
    ),

  listMessages: (organizationId: string, conversationId: string, page = 1, pageSize = 100) =>
    apiClient.get<MessageListResponse>(conversationPath(organizationId, conversationId, '/messages'), {
      params: { page, pageSize },
    }),

  sendMessage: (organizationId: string, conversationId: string, body: SendMessageRequest) =>
    apiClient.post<MessageResponse>(conversationPath(organizationId, conversationId, '/messages'), body),

  listNotes: (organizationId: string, conversationId: string, page = 1, pageSize = 50) =>
    apiClient.get<ConversationNoteListResponse>(conversationPath(organizationId, conversationId, '/notes'), {
      params: { page, pageSize },
    }),

  addNote: (organizationId: string, conversationId: string, body: AddConversationNoteRequest) =>
    apiClient.post<ConversationNoteResponse>(conversationPath(organizationId, conversationId, '/notes'), body),

  async downloadAttachment(
    organizationId: string,
    conversationId: string,
    attachmentId: string,
    fileName: string,
  ): Promise<void> {
    const response = await http.get<Blob>(
      conversationPath(organizationId, conversationId, `/attachments/${attachmentId}`),
      { responseType: 'blob' },
    );
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  },
};
