/**
 * ============================================================
 * GrowthOS — API Client avec Cookies HttpOnly
 * ============================================================
 * Remplace localStorage par des cookies httpOnly pour le token JWT
 * Architecture:
 * 1. Token stocké dans cookie httpOnly (secure, sameSite)
 * 2. Refresh automatique via /api/v1/auth/refresh
 * 3. Interceptors pour injection auto de Authorization + X-Tenant-ID
 * 4. Gestion erreurs centralisée avec toasts
 */

import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

class ApiClient {
  private axios: AxiosInstance;
  private refreshing: Promise<string> | null = null;

  constructor() {
    this.axios = axios.create({
      baseURL: BASE_URL,
      timeout: 30_000,
      withCredentials: true, // Important pour les cookies
      headers: { 'Content-Type': 'application/json' },
    });

    // Request interceptor — injecte tenant depuis cookie ou state
    this.axios.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const tenantId = this.getTenantId();
        if (tenantId && config.headers) {
          config.headers['X-Tenant-ID'] = tenantId;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor — refresh token auto + gestion erreurs
    this.axios.interceptors.response.use(
      (res: AxiosResponse) => res.data,
      async (error) => {
        const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !original._retry) {
          original._retry = true;

          if (!this.refreshing) {
            this.refreshing = this.doRefresh().finally(() => {
              this.refreshing = null;
            });
          }

          try {
            const newToken = await this.refreshing;
            if (original.headers) {
              original.headers['Authorization'] = `Bearer ${newToken}`;
            }
            return this.axios(original);
          } catch (refreshError) {
            this.logout();
            toast.error('Session expirée. Veuillez vous reconnecter.');
            throw error;
          }
        }

        // Formater l'erreur
        const message =
          error.response?.data?.message ||
          error.response?.data?.detail ||
          error.message ||
          'Une erreur est survenue';

        const errorMessage = Array.isArray(message) ? message.join(', ') : message;

        // Toast pour les erreurs 4xx/5xx (sauf 401 géré ci-dessus)
        if (error.response?.status && error.response.status >= 400 && error.response.status !== 401) {
          toast.error(errorMessage);
        }

        throw new Error(errorMessage);
      }
    );
  }

  // ── HTTP Methods ───────────────────────────────────────────────

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

  // ── Auth Methods ───────────────────────────────────────────────

  async login(email: string, password: string, tenantSlug?: string) {
    const result = await this.post<any>('/auth/login', { email, password, tenantSlug });
    // Le token est maintenant dans un cookie httpOnly, rien à stocker en localStorage
    if (result.tenant?.id) {
      sessionStorage.setItem('tenant_id', result.tenant.id);
      sessionStorage.setItem('tenant_slug', result.tenant.slug || '');
    }
    return result;
  }

  async register(data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
  }) {
    const result = await this.post<any>('/auth/register', data);
    if (result.tenant?.id) {
      sessionStorage.setItem('tenant_id', result.tenant.id);
      sessionStorage.setItem('tenant_slug', result.tenant.slug || '');
    }
    return result;
  }

  async logout() {
    try {
      await this.post('/auth/logout', {});
    } catch {
      // Ignorer les erreurs de logout
    } finally {
      this.clearAuth();
    }
  }

  private async doRefresh(): Promise<string> {
    const result = await this.axios.post('/auth/refresh', {});
    const data = result as any;
    // Le nouveau token est déjà dans le cookie httpOnly
    return data.accessToken;
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

  isAuthenticated(): boolean {
    // On vérifie la présence du tenant en sessionStorage
    // Le token est dans le cookie httpOnly, géré automatiquement par axios
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

// ── Hooks React ──────────────────────────────────────────────────

export { ApiClient };
export default apiClient;
