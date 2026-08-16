import type {
  CreateKnowledgeArticleRequest,
  CreateKnowledgeCategoryRequest,
  KnowledgeArticleListResponse,
  KnowledgeArticleResponse,
  KnowledgeArticleVersionListResponse,
  KnowledgeCategoryListResponse,
  KnowledgeCategoryResponse,
  KnowledgeDocumentListResponse,
  KnowledgeDocumentResponse,
  KnowledgeTagListResponse,
  RegisterKnowledgeDocumentRequest,
  UpdateKnowledgeArticleRequest,
  UpdateKnowledgeCategoryRequest,
} from '@ai-customer-support/contracts';
import { apiClient, apiRequest } from '@/services/api-client';

export type KnowledgeArticleListParams = {
  readonly page?: number;
  readonly pageSize?: number;
  readonly q?: string;
  readonly status?: string;
  readonly categoryId?: string;
  readonly tag?: string;
};

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

  listCategories: (organizationId: string) =>
    apiClient.get<KnowledgeCategoryListResponse>(`/api/organizations/${organizationId}/knowledge/categories`),

  createCategory: (organizationId: string, body: CreateKnowledgeCategoryRequest) =>
    apiClient.post<KnowledgeCategoryResponse>(`/api/organizations/${organizationId}/knowledge/categories`, body),

  updateCategory: (organizationId: string, categoryId: string, body: UpdateKnowledgeCategoryRequest) =>
    apiClient.patch<KnowledgeCategoryResponse>(
      `/api/organizations/${organizationId}/knowledge/categories/${categoryId}`,
      body,
    ),

  deleteCategory: (organizationId: string, categoryId: string) =>
    apiClient.delete(`/api/organizations/${organizationId}/knowledge/categories/${categoryId}`),

  listTags: (organizationId: string) =>
    apiClient.get<KnowledgeTagListResponse>(`/api/organizations/${organizationId}/knowledge/tags`),

  listArticles: (organizationId: string, params?: KnowledgeArticleListParams) =>
    apiClient.get<KnowledgeArticleListResponse>(`/api/organizations/${organizationId}/knowledge/articles`, { params }),

  getArticle: (organizationId: string, articleId: string) =>
    apiClient.get<KnowledgeArticleResponse>(`/api/organizations/${organizationId}/knowledge/articles/${articleId}`),

  createArticle: (organizationId: string, body: CreateKnowledgeArticleRequest) =>
    apiClient.post<KnowledgeArticleResponse>(`/api/organizations/${organizationId}/knowledge/articles`, body),

  updateArticle: (organizationId: string, articleId: string, body: UpdateKnowledgeArticleRequest) =>
    apiClient.patch<KnowledgeArticleResponse>(
      `/api/organizations/${organizationId}/knowledge/articles/${articleId}`,
      body,
    ),

  publishArticle: (organizationId: string, articleId: string) =>
    apiClient.post<KnowledgeArticleResponse>(
      `/api/organizations/${organizationId}/knowledge/articles/${articleId}/publish`,
    ),

  unpublishArticle: (organizationId: string, articleId: string) =>
    apiClient.post<KnowledgeArticleResponse>(
      `/api/organizations/${organizationId}/knowledge/articles/${articleId}/unpublish`,
    ),

  archiveArticle: (organizationId: string, articleId: string) =>
    apiClient.post<KnowledgeArticleResponse>(
      `/api/organizations/${organizationId}/knowledge/articles/${articleId}/archive`,
    ),

  deleteArticle: (organizationId: string, articleId: string) =>
    apiClient.delete(`/api/organizations/${organizationId}/knowledge/articles/${articleId}`),

  listArticleVersions: (organizationId: string, articleId: string) =>
    apiClient.get<KnowledgeArticleVersionListResponse>(
      `/api/organizations/${organizationId}/knowledge/articles/${articleId}/versions`,
    ),

  restoreArticleVersion: (organizationId: string, articleId: string, version: number) =>
    apiClient.post<KnowledgeArticleResponse>(
      `/api/organizations/${organizationId}/knowledge/articles/${articleId}/versions/${String(version)}/restore`,
    ),
};
