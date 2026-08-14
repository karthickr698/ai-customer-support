import { create } from 'zustand';

type SessionState = {
  readonly accessToken: string | undefined;
  readonly tenantId: string | undefined;
  readonly setAccessToken: (accessToken: string | undefined) => void;
  readonly setTenantId: (tenantId: string | undefined) => void;
  readonly clearSession: () => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  accessToken: undefined,
  tenantId: undefined,
  setAccessToken: (accessToken) => {
    set({ accessToken });
  },
  setTenantId: (tenantId) => {
    set({ tenantId });
  },
  clearSession: () => {
    set({ accessToken: undefined, tenantId: undefined });
  },
}));
