import { QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthSessionProvider } from '@/features/identity/auth-session-provider';
import { ThemeProvider } from '@/theme/theme-provider';
import { AppErrorBoundary } from './error-boundary';
import { createQueryClient } from './query-client';

export function AppProviders({ children }: { readonly children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={200}>
          <AppErrorBoundary>
            <AuthSessionProvider>
              {children}
              <Toaster />
            </AuthSessionProvider>
          </AppErrorBoundary>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
