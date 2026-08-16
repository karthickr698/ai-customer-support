import type {
  AddTicketNoteRequest,
  AssignTicketRequest,
  ChangeTicketStatusRequest,
  CreateTicketEscalationPolicyRequest,
  CreateTicketRequest,
  CreateTicketSlaPolicyRequest,
  EscalateTicketRequest,
  EvaluateTicketEscalationResponse,
  TicketAttachmentResponse,
  TicketEscalationPolicyListResponse,
  TicketEscalationPolicyResponse,
  TicketListResponse,
  TicketNoteListResponse,
  TicketNoteResponse,
  TicketResponse,
  TicketSlaPolicyListResponse,
  TicketSlaPolicyResponse,
  UpdateTicketEscalationPolicyRequest,
  UpdateTicketSlaPolicyRequest,
} from '@ai-customer-support/contracts';
import { apiClient, http } from '@/services/api-client';

export type TicketListParams = {
  readonly page?: number;
  readonly pageSize?: number;
  readonly q?: string;
  readonly status?: string;
  readonly priority?: string;
  readonly assignedAgentId?: string;
  readonly conversationId?: string;
  readonly slaBreached?: boolean;
};

function orgPath(organizationId: string, suffix: string): string {
  return `/api/organizations/${organizationId}${suffix}`;
}

export const ticketsApi = {
  list: (organizationId: string, params: TicketListParams) =>
    apiClient.get<TicketListResponse>(orgPath(organizationId, '/tickets'), {
      params: {
        ...params,
        slaBreached: params.slaBreached === undefined ? undefined : params.slaBreached ? 'true' : 'false',
      },
    }),
  get: (organizationId: string, ticketId: string) =>
    apiClient.get<TicketResponse>(orgPath(organizationId, `/tickets/${ticketId}`)),
  create: (organizationId: string, body: CreateTicketRequest) =>
    apiClient.post<TicketResponse>(orgPath(organizationId, '/tickets'), body),
  changeStatus: (organizationId: string, ticketId: string, body: ChangeTicketStatusRequest) =>
    apiClient.patch<TicketResponse>(orgPath(organizationId, `/tickets/${ticketId}/status`), body),
  assign: (organizationId: string, ticketId: string, body: AssignTicketRequest) =>
    apiClient.post<TicketResponse>(orgPath(organizationId, `/tickets/${ticketId}/assign`), body),
  assignAvailable: (organizationId: string, ticketId: string) =>
    apiClient.post<TicketResponse>(orgPath(organizationId, `/tickets/${ticketId}/assign/available`)),
  unassign: (organizationId: string, ticketId: string) =>
    apiClient.post<TicketResponse>(orgPath(organizationId, `/tickets/${ticketId}/unassign`)),
  escalate: (organizationId: string, ticketId: string, body: EscalateTicketRequest = {}) =>
    apiClient.post<TicketResponse>(orgPath(organizationId, `/tickets/${ticketId}/escalate`), body),
  listNotes: (organizationId: string, ticketId: string, page = 1, pageSize = 50) =>
    apiClient.get<TicketNoteListResponse>(orgPath(organizationId, `/tickets/${ticketId}/notes`), {
      params: { page, pageSize },
    }),
  addNote: (organizationId: string, ticketId: string, body: AddTicketNoteRequest) =>
    apiClient.post<TicketNoteResponse>(orgPath(organizationId, `/tickets/${ticketId}/notes`), body),
  uploadAttachment: (organizationId: string, ticketId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post<TicketAttachmentResponse>(
      orgPath(organizationId, `/tickets/${ticketId}/attachments`),
      form,
    );
  },
  async downloadAttachment(
    organizationId: string,
    ticketId: string,
    attachmentId: string,
    fileName: string,
  ): Promise<void> {
    const response = await http.get<Blob>(
      orgPath(organizationId, `/tickets/${ticketId}/attachments/${attachmentId}`),
      { responseType: 'blob' },
    );
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  },
  listSlaPolicies: (organizationId: string) =>
    apiClient.get<TicketSlaPolicyListResponse>(orgPath(organizationId, '/ticket-sla-policies')),
  createSlaPolicy: (organizationId: string, body: CreateTicketSlaPolicyRequest) =>
    apiClient.post<TicketSlaPolicyResponse>(orgPath(organizationId, '/ticket-sla-policies'), body),
  updateSlaPolicy: (organizationId: string, policyId: string, body: UpdateTicketSlaPolicyRequest) =>
    apiClient.patch<TicketSlaPolicyResponse>(orgPath(organizationId, `/ticket-sla-policies/${policyId}`), body),
  deleteSlaPolicy: (organizationId: string, policyId: string) =>
    apiClient.delete<void>(orgPath(organizationId, `/ticket-sla-policies/${policyId}`)),
  listEscalationPolicies: (organizationId: string) =>
    apiClient.get<TicketEscalationPolicyListResponse>(orgPath(organizationId, '/ticket-escalation-policies')),
  createEscalationPolicy: (organizationId: string, body: CreateTicketEscalationPolicyRequest) =>
    apiClient.post<TicketEscalationPolicyResponse>(orgPath(organizationId, '/ticket-escalation-policies'), body),
  updateEscalationPolicy: (organizationId: string, policyId: string, body: UpdateTicketEscalationPolicyRequest) =>
    apiClient.patch<TicketEscalationPolicyResponse>(
      orgPath(organizationId, `/ticket-escalation-policies/${policyId}`),
      body,
    ),
  deleteEscalationPolicy: (organizationId: string, policyId: string) =>
    apiClient.delete<void>(orgPath(organizationId, `/ticket-escalation-policies/${policyId}`)),
  evaluateEscalation: (organizationId: string) =>
    apiClient.post<EvaluateTicketEscalationResponse>(orgPath(organizationId, '/ticket-escalation-policies/evaluate')),
};
