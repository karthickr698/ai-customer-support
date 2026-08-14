import { apiClient } from './api-client';
import type { LivenessStatus, ReadinessStatus } from '@/types/api';

export const healthApi = {
  live: (signal?: AbortSignal) => apiClient.get<LivenessStatus>('/health', { signal }),
  ready: (signal?: AbortSignal) => apiClient.get<ReadinessStatus>('/ready', { signal }),
};
