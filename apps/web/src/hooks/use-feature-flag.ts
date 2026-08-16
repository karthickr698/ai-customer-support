import type { PlatformFeatureFlagEvaluationResponse, PlatformFeatureFlagKey, PlatformMeResponse } from '@ai-customer-support/contracts';
import { useApiQuery } from '@/hooks/use-api';
import { ApiError } from '@/services/api-error';
import { queryKeys } from '@/services/query-keys';

/**
 * Tenant users cannot call feature-flag evaluation (platform-operator only).
 * Fail open: treat the flag as enabled unless an operator evaluation says otherwise.
 */
export function useFeatureFlag(key: PlatformFeatureFlagKey, organizationId?: string) {
  const me = useApiQuery<PlatformMeResponse>({
    queryKey: queryKeys.platform.me(),
    path: '/api/platform/me',
    retry: (count, error) => !(error instanceof ApiError && (error.status === 401 || error.status === 403)) && count < 2,
    staleTime: 5 * 60_000,
  });
  const isOperator = Boolean(me.data?.operator);
  const evaluation = useApiQuery<PlatformFeatureFlagEvaluationResponse>({
    queryKey: queryKeys.featureFlags.evaluation(key, organizationId),
    path: `/api/platform/feature-flags/${key}/evaluation`,
    params: { organizationId },
    enabled: isOperator,
    staleTime: 60_000,
  });

  if (!isOperator || me.isError) {
    return { enabled: true as const, isPending: me.isPending, source: 'fail-open' as const };
  }

  return {
    enabled: evaluation.data?.evaluation.enabled ?? true,
    isPending: evaluation.isPending,
    source: evaluation.data?.evaluation.source ?? 'global',
  };
}
