import { QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { AppErrorBoundary } from './error-boundary';
import { createQueryClient } from './query-client';

export function AppProviders({ children }: { readonly children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <AppErrorBoundary>{children}</AppErrorBoundary>
    </QueryClientProvider>
  );
}
