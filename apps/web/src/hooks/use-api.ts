import { useMutation, useQuery, useQueryClient, type QueryKey, type UseMutationOptions, type UseQueryOptions } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/services/api-client';
import { ApiError } from '@/services/api-error';
import type { ApiRequestOptions } from '@/types/api';

type ApiQueryOptions<TData> = Omit<UseQueryOptions<TData, ApiError>, 'queryFn'> & {
  readonly path: string;
  readonly params?: ApiRequestOptions['params'];
  readonly validateStatus?: ApiRequestOptions['validateStatus'];
};

export function useApiQuery<TData>({ path, params, validateStatus, ...options }: ApiQueryOptions<TData>) {
  return useQuery({
    queryFn: ({ signal }) => apiClient.get<TData>(path, { signal, params, validateStatus }),
    ...options,
  });
}

type ApiMutationOptions<TData, TVariables> = Omit<
  UseMutationOptions<TData, ApiError, TVariables>,
  'mutationFn'
> & {
  readonly mutationFn: (variables: TVariables) => Promise<TData>;
  readonly invalidateKeys?: readonly QueryKey[];
  readonly successMessage?: string;
  readonly errorMessage?: string | false;
};

export function useApiMutation<TData, TVariables = void>({
  invalidateKeys,
  successMessage,
  errorMessage,
  onSuccess,
  onError,
  ...options
}: ApiMutationOptions<TData, TVariables>) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    onSuccess: async (data, variables, onMutateResult, context) => {
      if (invalidateKeys) {
        await Promise.all(invalidateKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      }

      if (successMessage) {
        toast.success(successMessage);
      }

      await onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      if (errorMessage !== false) {
        toast.error(errorMessage ?? error.message);
      }

      onError?.(error, variables, onMutateResult, context);
    },
  });
}
