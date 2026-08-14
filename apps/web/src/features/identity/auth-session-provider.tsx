import { type ReactNode, useEffect } from 'react';
import { useAuthStore } from './auth-store';

export function AuthSessionProvider({ children }: { readonly children: ReactNode }) {
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    if (status === 'idle') {
      void bootstrap();
    }
  }, [bootstrap, status]);

  return children;
}
