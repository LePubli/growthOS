import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

export type PluginState = 'DISCOVERED' | 'RESOLVING' | 'ACTIVE' | 'ERROR' | 'DISABLED';
export type PluginAuditAction = 'REGISTERED' | 'ENABLED' | 'DISABLED' | 'ACTIVATION_SUCCEEDED' | 'ACTIVATION_FAILED';

export interface RuntimePlugin {
  id: string;
  name: string;
  version: string;
  state: PluginState;
  permissions: string[];
  uiSlots: string[];
  routes: { path: string; label: string; icon?: string }[];
  error?: string;
  activatedAt?: string;
}

export interface AuditLog {
  id: string;
  pluginId: string;
  pluginName: string;
  action: PluginAuditAction;
  actorUserId: string | null;
  actorEmail: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface PluginsResponse {
  plugins: RuntimePlugin[];
  total: number;
}

interface AuditResponse {
  logs: AuditLog[];
  total: number;
}

export const PLUGIN_QUERY_KEY = ['plugins', 'runtime'] as const;
export const AUDIT_QUERY_KEY = ['plugins', 'audit'] as const;

export function useRuntimePlugins() {
  return useQuery<PluginsResponse>({
    queryKey: PLUGIN_QUERY_KEY,
    queryFn: () => apiClient.get<PluginsResponse>('/plugins/status'),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

export function usePluginAudit(pluginId?: string) {
  return useQuery<AuditResponse>({
    queryKey: [...AUDIT_QUERY_KEY, pluginId ?? 'all'],
    queryFn: () => {
      const params = pluginId ? `?plugin_id=${encodeURIComponent(pluginId)}&limit=100` : '?limit=100';
      return apiClient.get<AuditResponse>(`/plugins/audit${params}`);
    },
    refetchInterval: 15_000,
    staleTime: 5_000,
  });
}

export function useEnablePlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/plugins/${id}/enable`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PLUGIN_QUERY_KEY });
      qc.invalidateQueries({ queryKey: AUDIT_QUERY_KEY });
      toast.success('Plugin activé');
    },
    onError: (err: Error) => {
      toast.error(err.message || "Impossible d'activer le plugin");
    },
  });
}

export function useDisablePlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/plugins/${id}/disable`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PLUGIN_QUERY_KEY });
      qc.invalidateQueries({ queryKey: AUDIT_QUERY_KEY });
      toast.success('Plugin désactivé');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Impossible de désactiver le plugin');
    },
  });
}
