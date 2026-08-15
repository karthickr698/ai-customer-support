import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../auth-store';
import { loginPathWithNext } from '../safe-next-path';
import { SessionLoading } from './session-loading';

export function RequireAuth({ children }: { readonly children: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const location = useLocation();

  if (status === 'idle' || status === 'loading') {
    return <SessionLoading />;
  }

  if (!user) {
    return <Navigate replace to={loginPathWithNext(`${location.pathname}${location.search}`)} />;
  }

  return children;
}
