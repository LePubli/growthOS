import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link2, Plus, X, Loader2, RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';

interface PBNSite {
  id: string;
  url: string;
  da_score: number;
  pa_score: number;
  status: string;
  last_checked_at: string | null;
  created_at: string;
}

const DA_COLOR = (da: number) => da >= 40 ? '#059669' : da >= 20 ? '#D97706' : '#DC2626';
const DA_LABEL = (da: number) => da >= 40 ? 'Fort' : da >= 20 ? 'Moyen' : 'Faible';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  active: { label: 'Actif', color: '#059669', bg: '#F0FDF4', icon: <CheckCircle size={12} /> },
  inactive: { label: 'Inactif', color: '#6B7280', bg: 'var(--body-bg)', icon: <AlertCircle size={12} /> },
  checking: { label: 'Vérification...', color: '#D97706', bg: '#FFFBEB', icon: <Clock size={12} /> },
};

const MOCK_SITES: PBNSite[] = [
  { id: '1', url: 'https://tech-insights-pro.com', da_score: 52, pa_score: 47, status: 'active', last_checked_at: new Date(Date.now() - 3600000).toISOString(), created_at: new Date().toISOString() },
  { id: '2', url: 'https://digital-growth-hub.fr', da_score: 38, pa_score: 34, status: 'active', last_checked_at: new Date(Date.now() - 7200000).toISOString(), created_at: new Date().toISOString() },
  { id: '3', url: 'https://b2b-marketing-news.com', da_score: 29, pa_score: 25, status: 'active', last_checked_at: new Date(Date.now() - 86400000).toISOString(), created_at: new Date().toISOString() },
  { id: '4', url: 'https://sales-automation-blog.io', da_score: 18, pa_score: 16, status: 'inactive', last_checked_at: new Date(Date.now() - 3 * 86400000).toISOString(), created_at: new Date().toISOString() },
  { id: '5', url: 'https://crm-strategy-guide.com', da_score: 44, pa_score: 40, status: 'active', last_checked_at: new Date(Date.now() - 2 * 3600000).toISOString(), created_at: new Date().toISOString() },
];

export default function PBNManagerPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ url: '', daScore: '', paScore: '' });

  const { data: sites = MOCK_SITES, isLoading } = useQuery({
    queryKey: ['erep-pbn'],
    queryFn: () => apiClient.get('/ereputation/pbn') as Promise<PBNSite[]>,
  });

  const addSite = useMutation({
    mutationFn: () => apiClient.post('/ereputation/pbn', {
      url: form.url,
      daScore: parseInt(form.daScore) || 0,
      paScore: parseInt(form.paScore) || 0,
    }),
    onSuccess: () => {
      toast.success('Site PBN ajouté');
      qc.invalidateQueries({ queryKey: ['erep-pbn'] });
      setShowModal(false);
      setForm({ url: '', daScore: '', paScore: '' });
    },
    onError: () => toast.error('Erreur lors de l\'ajout'),
  });

  const displaySites = sites.length ? sites : MOCK_SITES;

  const avgDA = displaySites.length
    ? Math.round(displaySites.reduce((s, site) => s + site.da_score, 0) / displaySites.length)
    : 0;

  const activeSites = displaySites.filter(s => s.status === 'active').length;

  const formatChecked = (d: string | null) => d
    ? new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'Jamais';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Réseau PBN</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Gestion du Private Blog Network</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: 'linear-gradient(135deg,#1E3A5F,#2563EB)' }}>
          <Plus size={14} />Ajouter un site
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Sites actifs', value: activeSites, color: '#059669' },
          { label: 'DA moyen', value: avgDA, color: DA_COLOR(avgDA) },
          { label: 'Sites total', value: displaySites.length, color: '#2563EB' },
        ].map(stat => (
          <div key={stat.label} className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <div className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Sites table */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-primary)' }} /></div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--card-border)', background: 'var(--body-bg)' }}>
                {['URL', 'DA', 'PA', 'Autorité', 'Statut', 'Dernière vérif.'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displaySites.map((site, i) => {
                const statusCfg = STATUS_CONFIG[site.status] ?? STATUS_CONFIG.active!;
                return (
                  <tr key={site.id} style={{ borderBottom: i < displaySites.length - 1 ? '1px solid var(--card-border)' : undefined }}>
                    <td className="px-4 py-3">
                      <a href={site.url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 text-sm font-medium hover:underline"
                        style={{ color: 'var(--color-primary)' }}>
                        <Link2 size={12} />{site.url.replace('https://', '')}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-bold" style={{ color: DA_COLOR(site.da_score) }}>{site.da_score}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{site.pa_score}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: DA_COLOR(site.da_score) + '15', color: DA_COLOR(site.da_score) }}>
                        {DA_LABEL(site.da_score)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full w-fit" style={{ background: statusCfg.bg, color: statusCfg.color }}>
                        {statusCfg.icon}{statusCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {formatChecked(site.last_checked_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl border shadow-2xl w-full max-w-md mx-4 p-6" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Ajouter un site PBN</h2>
              <button onClick={() => setShowModal(false)} style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>URL du site *</label>
                <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none"
                  style={{ background: 'var(--body-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Domain Authority (DA)</label>
                  <input type="number" min="0" max="100" value={form.daScore} onChange={e => setForm(f => ({ ...f, daScore: e.target.value }))}
                    placeholder="0-100"
                    className="w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none"
                    style={{ background: 'var(--body-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Page Authority (PA)</label>
                  <input type="number" min="0" max="100" value={form.paScore} onChange={e => setForm(f => ({ ...f, paScore: e.target.value }))}
                    placeholder="0-100"
                    className="w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none"
                    style={{ background: 'var(--body-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl border text-sm" style={{ borderColor: 'var(--card-border)', color: 'var(--text-muted)' }}>
                  Annuler
                </button>
                <button onClick={() => addSite.mutate()} disabled={!form.url || addSite.isPending}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#1E3A5F,#2563EB)' }}>
                  {addSite.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Ajouter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
