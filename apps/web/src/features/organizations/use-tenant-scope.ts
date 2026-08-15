import { useEffect } from 'react';
import { useSessionStore } from '@/stores/session-store';

export function useTenantScope(organizationId: string): void {
  const setTenantId = useSessionStore((state) => state.setTenantId);

  useEffect(() => {
    if (organizationId) {
      setTenantId(organizationId);
    }
  }, [organizationId, setTenantId]);
}
