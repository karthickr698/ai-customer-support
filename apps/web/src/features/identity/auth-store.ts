import type { AuthUserDto } from '@ai-customer-support/contracts';
import { create } from 'zustand';
import { ApiError } from '@/services/api-error';
import { identityApi } from './api';

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

type AuthState = {
  user: AuthUserDto | null;
  status: AuthStatus;
  setUser: (user: AuthUserDto | null) => void;
  bootstrap: () => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'idle',
  setUser: (user) => set({ user, status: user ? 'authenticated' : 'unauthenticated' }),
  bootstrap: async () => {
    set({ status: 'loading' });

    try {
      const response = await identityApi.me();
      set({ user: response.user, status: 'authenticated' });
    } catch (error: unknown) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        set({ user: null, status: 'unauthenticated' });
        return;
      }

      set({ user: null, status: 'unauthenticated' });
    }
  },
  logout: async () => {
    try {
      await identityApi.logout();
    } finally {
      set({ user: null, status: 'unauthenticated' });
    }
  },
}));
