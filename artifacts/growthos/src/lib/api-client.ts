import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';

// Runtime injection via docker/entrypoint.sh takes priority over build-time env.
// This allows changing the API URL without a full Docker rebuild:
// set VITE_API_URL as an environment variable in Coolify → restart container.
const BASE_URL =
  (window as any).__ENV__?.VITE_API_URL ||
  (import.meta.env.VITE_API_URL as string) ||
  '/api/v1';

class ApiClient {
  private axios: AxiosInstance;
  private refreshing: Promise<string> | null = null;

  constructor() {
    this.axios = axios.create({
      baseURL: BASE_URL,
      timeout: 30_000,
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' },
    });

    this.axios.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const tenantId = this.getTenantId();
        if (tenantId && config.headers) {
          config.headers['X-Tenant-ID'] = tenantId;
        }
        const token = this.getAccessToken();
        if (token && config.headers) {
          config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.axios.interceptors.response.use(
      (res: AxiosResponse) => res.data,
      async (error) => {
        const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !original._retry) {
          original._retry = true;
          if (!this.refreshing) {
            this.refreshing = this.doRefresh().finally(() => { this.refreshing = null; });
          }
          try {
            const newToken = await this.refreshing;
            if (original.headers) {
              original.headers['Authorization'] = `Bearer ${newToken}`;
            }
            return this.axios(original);
          } catch {
            this.logout();
            toast.error('Session expirée. Veuillez vous reconnecter.');
            throw error;
          }
        }

        const message =
          error.response?.data?.message ||
          error.response?.data?.detail ||
          error.message ||
          'Une erreur est survenue';
        const errorMessage = Array.isArray(message) ? message.join(', ') : message;
        if (error.response?.status && error.response.status >= 400 && error.response.status !== 401) {
          toast.error(errorMessage);
        }
        throw new Error(errorMessage);
      }
    );
  }

  async get<T = any>(url: string, params?: Record<string, any>): Promise<T> {
    return this.axios.get(url, { params }) as unknown as T;
  }

  async post<T = any>(url: string, data?: any): Promise<T> {
    return this.axios.post(url, data) as unknown as T;
  }

  async put<T = any>(url: string, data?: any): Promise<T> {
    return this.axios.put(url, data) as unknown as T;
  }

  async patch<T = any>(url: string, data?: any): Promise<T> {
    return this.axios.patch(url, data) as unknown as T;
  }

  async delete<T = any>(url: string): Promise<T> {
    return this.axios.delete(url) as unknown as T;
  }

  async upload<T = any>(url: string, formData: FormData): Promise<T> {
    return this.axios.post(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }) as unknown as T;
  }

  async login(email: string, password: string, tenantSlug?: string) {
    const result = await this.post<any>('/auth/login', { email, password, tenantSlug });
    if (result.tenant?.id) {
      sessionStorage.setItem('tenant_id', result.tenant.id);
      sessionStorage.setItem('tenant_slug', result.tenant.slug || '');
    }
    return result;
  }

  async register(data: { email: string; password: string; firstName?: string; lastName?: string; companyName?: string }) {
    const result = await this.post<any>('/auth/register', data);
    if (result.tenant?.id) {
      sessionStorage.setItem('tenant_id', result.tenant.id);
      sessionStorage.setItem('tenant_slug', result.tenant.slug || '');
    }
    return result;
  }

  async logout() {
    try { await this.post('/auth/logout', {}); } catch {}
    finally { this.clearAuth(); }
  }

  private async doRefresh(): Promise<string> {
    const result = await this.axios.post('/auth/refresh', {});
    return (result as any).accessToken;
  }

  private clearAuth() {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem('tenant_id');
    sessionStorage.removeItem('tenant_slug');
    window.location.href = '/login';
  }

  private getTenantId(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('tenant_id');
  }

  private getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('growthos-auth');
      if (!raw) return null;
      const state = JSON.parse(raw);
      return state?.state?.accessToken ?? state?.accessToken ?? null;
    } catch {
      return null;
    }
  }

  isAuthenticated(): boolean {
    return !!this.getTenantId();
  }

  getCurrentTenant(): { id: string; slug: string } | null {
    if (typeof window === 'undefined') return null;
    const id = sessionStorage.getItem('tenant_id');
    const slug = sessionStorage.getItem('tenant_slug');
    if (!id || !slug) return null;
    return { id, slug };
  }
}

export const apiClient = new ApiClient();
export default apiClient;
