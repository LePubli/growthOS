import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

export type PluginState = 'DISCOVERED' | 'RESOLVING' | 'ACTIVE' | 'ERROR' | 'DISABLED';

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

interface PluginsResponse {
  plugins: RuntimePlugin[];
  total: number;
}

export const PLUGIN_QUERY_KEY = ['plugins', 'runtime'] as const;

export function useRuntimePlugins() {
  return useQuery<PluginsResponse>({
    queryKey: PLUGIN_QUERY_KEY,
    queryFn: () => apiClient.get<PluginsResponse>('/plugins/status'),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

export function useEnablePlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/plugins/${id}/enable`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: PLUGIN_QUERY_KEY });
      toast.success(`Plugin activé`);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Impossible d\'activer le plugin');
    },
  });
}

export function useDisablePlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/plugins/${id}/disable`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: PLUGIN_QUERY_KEY });
      toast.success(`Plugin désactivé`);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Impossible de désactiver le plugin');
    },
  });
}
