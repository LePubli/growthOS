import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield, Plus, Loader2, Target, X, ChevronRight,
  Search, BarChart2, ExternalLink,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';

interface Campaign {
  id: string;
  name: string;
  targetType: 'B2B' | 'B2C';
  targetName: string;
  targetUrl: string | null;
  keywords: string[];
  status: string;
  reputationScore: number;
  createdAt: string;
}

const SCORE_COLOR = (s: number) => s >= 70 ? '#059669' : s >= 40 ? '#D97706' : '#DC2626';
const SCORE_BG = (s: number) => s >= 70 ? '#F0FDF4' : s >= 40 ? '#FFFBEB' : '#FEF2F2';

export default function CampaignsPage() {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    name: '', targetType: 'B2B' as 'B2B' | 'B2C', targetName: '',
    targetUrl: '', keywords: '',
  });

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['erep-campaigns'],
    queryFn: () => apiClient.get('/ereputation/campaigns') as Promise<Campaign[]>,
  });

  const createMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.post('/ereputation/campaigns', data) as Promise<Campaign>,
    onSuccess: (c) => {
      toast.success(`Campagne "${c.name}" créée`);
      qc.invalidateQueries({ queryKey: ['erep-campaigns'] });
      setShowModal(false);
      setForm({ name: '', targetType: 'B2B', targetName: '', targetUrl: '', keywords: '' });
    },
    onError: () => toast.error('Erreur lors de la création'),
  });

  const filtered = campaigns.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.targetName.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSubmit = () => {
    if (!form.name || !form.targetName) { toast.error('Nom et cible requis'); return; }
    createMut.mutate({
      name: form.name,
      targetType: form.targetType,
      targetName: form.targetName,
      targetUrl: form.targetUrl || undefined,
      keywords: form.keywords.split(',').map(k => k.trim()).filter(Boolean),
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Campagnes E-Réputation</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{campaigns.length} campagne{campaigns.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: 'linear-gradient(135deg,#1E3A5F,#2563EB)' }}>
          <Plus size={14} />Nouvelle campagne
        </button>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher une campagne..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none"
          style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-primary)' }} /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Shield size={40} className="mx-auto mb-3" style={{ color: 'var(--card-border)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {search ? 'Aucun résultat' : 'Aucune campagne — cliquez sur "Nouvelle campagne"'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--card-border)', background: 'var(--body-bg)' }}>
                {['Campagne', 'Type', 'Mots-clés', 'Statut', 'Score', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--card-border)' : undefined }}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{c.name}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.targetName}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-1 rounded-full font-medium text-white"
                      style={{ background: c.targetType === 'B2B' ? '#2563EB' : '#7C3AED' }}>
                      {c.targetType}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.keywords.slice(0, 3).map(kw => (
                        <span key={kw} className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--body-bg)', color: 'var(--text-muted)' }}>{kw}</span>
                      ))}
                      {c.keywords.length > 3 && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>+{c.keywords.length - 3}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-1 rounded-full" style={{ background: c.status === 'active' ? '#F0FDF4' : 'var(--body-bg)', color: c.status === 'active' ? '#059669' : 'var(--text-muted)' }}>
                      {c.status === 'active' ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-bold px-2 py-1 rounded-lg" style={{ background: SCORE_BG(c.reputationScore), color: SCORE_COLOR(c.reputationScore) }}>
                      {c.reputationScore}/100
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/ereputation/${c.id}/dashboard`}>
                      <button className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-all"
                        style={{ borderColor: 'var(--card-border)', color: 'var(--text-secondary)' }}>
                        <BarChart2 size={11} />Dashboard
                      </button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl border shadow-2xl w-full max-w-md mx-4 p-6" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Nouvelle campagne</h2>
              <button onClick={() => setShowModal(false)} style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Nom de la campagne *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Réputation Acme Corp 2026"
                  className="w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ background: 'var(--body-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Type de cible *</label>
                <div className="flex gap-2">
                  {(['B2B', 'B2C'] as const).map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, targetType: t }))}
                      className="flex-1 py-2 rounded-xl text-sm font-medium border transition-all"
                      style={{
                        background: form.targetType === t ? (t === 'B2B' ? '#2563EB' : '#7C3AED') : 'var(--body-bg)',
                        color: form.targetType === t ? '#fff' : 'var(--text-secondary)',
                        borderColor: form.targetType === t ? 'transparent' : 'var(--card-border)',
                      }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Nom de la cible *</label>
                <input value={form.targetName} onChange={e => setForm(f => ({ ...f, targetName: e.target.value }))}
                  placeholder={form.targetType === 'B2B' ? 'Ex: Acme Corp' : 'Ex: Jean Dupont'}
                  className="w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none"
                  style={{ background: 'var(--body-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>URL cible</label>
                <input value={form.targetUrl} onChange={e => setForm(f => ({ ...f, targetUrl: e.target.value }))}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none"
                  style={{ background: 'var(--body-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Mots-clés (séparés par des virgules)</label>
                <input value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}
                  placeholder="SEO, growth hacking, CRM B2B"
                  className="w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none"
                  style={{ background: 'var(--body-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl border text-sm" style={{ borderColor: 'var(--card-border)', color: 'var(--text-muted)' }}>
                  Annuler
                </button>
                <button onClick={handleSubmit} disabled={createMut.isPending}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg,#1E3A5F,#2563EB)' }}>
                  {createMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Créer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
