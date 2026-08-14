import type {
  KnowledgeDocumentListResponse,
  KnowledgeDocumentResponse,
  RegisterKnowledgeDocumentRequest,
} from '@ai-customer-support/contracts';
import { apiClient, apiRequest } from '@/services/api-client';

export const knowledgeApi = {
  listDocuments: (organizationId: string) =>
    apiClient.get<KnowledgeDocumentListResponse>(`/api/organizations/${organizationId}/knowledge/documents`),

  registerDocument: (organizationId: string, body: RegisterKnowledgeDocumentRequest) =>
    apiClient.post<KnowledgeDocumentResponse>(`/api/organizations/${organizationId}/knowledge/documents`, body),

  uploadDocument: (organizationId: string, file: File, title?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (title) {
      form.append('title', title);
    }
    return apiRequest<KnowledgeDocumentResponse>(`/api/organizations/${organizationId}/knowledge/documents/upload`, {
      method: 'POST',
      body: form,
      timeoutMs: 60_000,
    });
  },

  reindexDocument: (organizationId: string, documentId: string) =>
    apiClient.post<KnowledgeDocumentResponse>(
      `/api/organizations/${organizationId}/knowledge/documents/${documentId}/reindex`,
    ),

  deleteDocument: (organizationId: string, documentId: string) =>
    apiClient.delete(`/api/organizations/${organizationId}/knowledge/documents/${documentId}`),
};
