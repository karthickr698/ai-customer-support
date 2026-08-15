import type { ReactNode } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../auth-store';
import { safeNextPath } from '../safe-next-path';
import { SessionLoading } from './session-loading';

export function GuestOnly({
  children,
  fallback = '/organizations',
}: {
  readonly children: ReactNode;
  readonly fallback?: string;
}) {
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const [searchParams] = useSearchParams();

  if (status === 'idle' || status === 'loading') {
    return <SessionLoading />;
  }

  if (user) {
    return <Navigate replace to={safeNextPath(searchParams.get('next'), fallback)} />;
  }

  return children;
}
