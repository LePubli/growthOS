import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '@/lib/api-client';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  role?: string;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  branding?: Record<string, any>;
  settings?: Record<string, any>;
}

interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, tenantSlug?: string) => Promise<void>;
  register: (data: { email: string; password: string; firstName?: string; lastName?: string; companyName?: string }) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  setTenant: (tenant: Tenant) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tenant: null,
      accessToken: null,
      isAuthenticated: false,

      login: async (email, password, tenantSlug) => {
        const result = await apiClient.login(email, password, tenantSlug);
        set({
          user: result.user,
          tenant: result.tenant,
          accessToken: result.accessToken,
          isAuthenticated: true,
        });
      },

      register: async (data) => {
        const result = await apiClient.register(data);
        set({
          user: result.user,
          tenant: result.tenant,
          accessToken: result.accessToken,
          isAuthenticated: true,
        });
      },

      logout: () => {
        apiClient.logout();
        set({ user: null, tenant: null, accessToken: null, isAuthenticated: false });
      },

      setUser: (user) => set({ user }),
      setTenant: (tenant) => set({ tenant }),
    }),
    {
      name: 'growthos-auth',
      partialize: (state) => ({
        user: state.user,
        tenant: state.tenant,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
