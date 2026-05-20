import axios, { AxiosInstance, AxiosResponse } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

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

    // Request interceptor — injecte token + tenant
    this.axios.interceptors.request.use(config => {
      const token = this.getAccessToken();
      if (token) config.headers['Authorization'] = `Bearer ${token}`;

      const tenantId = this.getTenantId();
      if (tenantId) config.headers['X-Tenant-ID'] = tenantId;

      return config;
    });

    // Response interceptor — refresh token auto
    this.axios.interceptors.response.use(
      res => res.data,
      async error => {
        const original = error.config;

        if (error.response?.status === 401 && !original._retry) {
          original._retry = true;

          if (!this.refreshing) {
            this.refreshing = this.doRefresh().finally(() => {
              this.refreshing = null;
            });
          }

          try {
            const newToken = await this.refreshing;
            original.headers['Authorization'] = `Bearer ${newToken}`;
            return this.axios(original);
          } catch {
            this.logout();
            throw error;
          }
        }

        // Formater l'erreur
        const message = error.response?.data?.message || error.response?.data?.detail || error.message;
        throw new Error(Array.isArray(message) ? message.join(', ') : message);
      },
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

  // ── Auth ────────────────────────────────────────────────────

  async login(email: string, password: string, tenantSlug?: string) {
    const result = await this.post<any>('/auth/login', { email, password, tenantSlug });
    this.saveAuth(result);
    return result;
  }

  async register(data: { email: string; password: string; firstName?: string; lastName?: string; companyName?: string }) {
    const result = await this.post<any>('/auth/register', data);
    this.saveAuth(result);
    return result;
  }

  private saveAuth(result: any) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('access_token', result.accessToken);
    if (result.tenant?.id) localStorage.setItem('tenant_id', result.tenant.id);
    if (result.tenant?.slug) localStorage.setItem('tenant_slug', result.tenant.slug);
  }

  private async doRefresh(): Promise<string> {
    const result = await this.axios.post('/auth/refresh', {});
    const data = result as any;
    localStorage.setItem('access_token', data.accessToken);
    return data.accessToken;
  }

  logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('tenant_id');
    localStorage.removeItem('tenant_slug');
    window.location.href = '/login';
  }

  private getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('access_token');
  }

  private getTenantId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('tenant_id');
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }
}

export const apiClient = new ApiClient();
