'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Star, Download, CheckCircle2, Upload, Filter } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { useRef } from 'react';

interface MarketplacePlugin {
  id: string; name: string; displayName: string; version: string;
  description: string; author: string; category: string; icon: string;
  isVerified: boolean; isFree: boolean; price?: number;
  rating: number; installCount: number; isInstalled?: boolean; isActive?: boolean;
}

const CATEGORIES = [
  { value: 'ALL', label: 'Tous' },
  { value: 'CRM', label: 'CRM' },
  { value: 'PROSPECTING', label: 'Prospection' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'SEO', label: 'SEO' },
  { value: 'AI', label: 'Intelligence IA' },
  { value: 'AUTOMATION', label: 'Automation' },
  { value: 'ANALYTICS', label: 'Analytics' },
  { value: 'INTEGRATION', label: 'Intégrations' },
];

const FEATURED_PLUGINS = [
  { id: 'f1', name: 'crm-prospecting', displayName: 'CRM & Prospecting', version: '1.0.0', description: 'Module complet B2B — scraping multi-sources, pipeline Kanban, scoring IA, signaux d\'affaires', author: 'GrowthOS', category: 'PROSPECTING', icon: '🎯', isVerified: true, isFree: true, rating: 4.9, installCount: 1200, isInstalled: true, isActive: true },
  { id: 'f2', name: 'seo-audit', displayName: 'SEO Audit Pro', version: '2.1.0', description: 'Audit SEO complet, analyse de mots-clés, suivi de positionnement et recommandations IA', author: 'GrowthOS', category: 'SEO', icon: '🔍', isVerified: true, isFree: false, price: 29, rating: 4.7, installCount: 890, isInstalled: false, isActive: false },
  { id: 'f3', name: 'linkedin-auto', displayName: 'LinkedIn Automation', version: '1.3.0', description: 'Automatisation LinkedIn — connexions, messages, suivi des vues de profil et extraction de données', author: 'GrowthOS', category: 'MARKETING', icon: '💼', isVerified: true, isFree: false, price: 49, rating: 4.5, installCount: 670, isInstalled: false, isActive: false },
  { id: 'f4', name: 'email-warmup', displayName: 'Email Warmup', version: '1.0.0', description: 'Améliore la délivrabilité email — pool d\'adresses de warmup, monitoring réputation, scores inbox', author: 'GrowthOS', category: 'MARKETING', icon: '🔥', isVerified: true, isFree: true, rating: 4.6, installCount: 540, isInstalled: false, isActive: false },
  { id: 'f5', name: 'reputation-monitor', displayName: 'E-Réputation Monitor', version: '1.1.0', description: 'Surveillance avis Google/Trustpilot, alertes mentions, analyse sentiment et reporting mensuel', author: 'GrowthOS', category: 'SEO', icon: '⭐', isVerified: true, isFree: false, price: 19, rating: 4.4, installCount: 420, isInstalled: false, isActive: false },
  { id: 'f6', name: 'ab-testing', displayName: 'A/B Testing Suite', version: '1.2.0', description: 'Tests A/B sur emails, landing pages et séquences. Analyse statistique et recommandations automatiques', author: 'GrowthOS', category: 'ANALYTICS', icon: '📊', isVerified: true, isFree: true, rating: 4.3, installCount: 380, isInstalled: false, isActive: false },
  { id: 'f7', name: 'hubspot-sync', displayName: 'HubSpot Sync Pro', version: '2.0.0', description: 'Synchronisation bidirectionnelle HubSpot — contacts, deals, activités. Mapping des champs personnalisé', author: 'GrowthOS', category: 'INTEGRATION', icon: '🔄', isVerified: true, isFree: false, price: 39, rating: 4.8, installCount: 950, isInstalled: false, isActive: false },
  { id: 'f8', name: 'whatsapp-business', displayName: 'WhatsApp Business', version: '1.0.0', description: 'Séquences WhatsApp automatisées, chatbot IA, templates officiels Meta et analytics', author: 'GrowthOS', category: 'COMMUNICATION', icon: '💬', isVerified: false, isFree: false, price: 59, rating: 4.2, installCount: 210, isInstalled: false, isActive: false },
];

export default function MarketplacePage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [filter, setFilter] = useState<'all' | 'free' | 'installed'>('all');
  const [selected, setSelected] = useState<MarketplacePlugin | null>(null);

  const installMutation = useMutation({
    mutationFn: (name: string) => apiClient.post(`/plugins/${name}/activate`, {}),
    onSuccess: (_, name) => { toast.success(`Plugin installé et activé`); qc.invalidateQueries({ queryKey: ['plugins'] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return apiClient.upload('/plugins/upload', fd);
    },
    onSuccess: (data: any) => { toast.success(`Plugin "${data.pluginName}" installé`); qc.invalidateQueries({ queryKey: ['plugins'] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = FEATURED_PLUGINS.filter(p => {
    const matchSearch = !search || p.displayName.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === 'ALL' || p.category === category;
    const matchFilter = filter === 'all' || (filter === 'free' ? p.isFree : p.isInstalled);
    return matchSearch && matchCat && matchFilter;
  });

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-app)' }}>

      {/* Header */}
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', padding: '20px 24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Marketplace</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
              {FEATURED_PLUGINS.length} plugins disponibles · Enrichissez GrowthOS avec des modules spécialisés
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input ref={fileRef} type="file" accept=".zip" style={{ display: 'none' }}
              onChange={e => e.target.files?.[0] && uploadMutation.mutate(e.target.files[0])} />
            <button onClick={() => fileRef.current?.click()} disabled={uploadMutation.isPending} className="o-btn o-btn-secondary o-btn-sm">
              <Upload size={13} /> {uploadMutation.isPending ? 'Installation...' : 'Upload ZIP'}
            </button>
          </div>
        </div>

        {/* Filtres */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '6px 12px', flex: 1, maxWidth: 320 }}>
            <Search size={13} color="var(--text-muted)" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un plugin..."
              style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-primary)', flex: 1 }} />
          </div>

          <div style={{ display: 'flex', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 6, overflow: 'hidden' }}>
            {(['all', 'free', 'installed'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding: '5px 14px', border: 'none', fontSize: 13, cursor: 'pointer', background: filter === f ? 'var(--color-primary)' : 'transparent', color: filter === f ? '#fff' : 'var(--text-secondary)', fontWeight: filter === f ? 600 : 400, transition: 'all .15s' }}>
                {f === 'all' ? 'Tous' : f === 'free' ? '🆓 Gratuits' : '✓ Installés'}
              </button>
            ))}
          </div>

          <select value={category} onChange={e => setCategory(e.target.value)} className="o-form-control o-form-control-sm" style={{ width: 'auto' }}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex' }}>
        <div style={{ flex: 1, padding: 24, overflow: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {filtered.map(plugin => (
              <div key={plugin.id}
                onClick={() => setSelected(plugin)}
                style={{ background: 'var(--bg-card)', border: `1px solid ${selected?.id === plugin.id ? 'var(--color-primary)' : 'var(--border-color)'}`, borderRadius: 10, overflow: 'hidden', cursor: 'pointer', transition: 'all .15s', boxShadow: 'var(--shadow-card)' }}>

                <div style={{ padding: '16px 16px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(1,126,132,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                        {plugin.icon}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{plugin.displayName}</span>
                          {plugin.isVerified && <CheckCircle2 size={13} color="var(--color-primary)" />}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>v{plugin.version} · {plugin.author}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {plugin.isFree
                        ? <span className="o-badge o-badge-success">Gratuit</span>
                        : <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary)' }}>{plugin.price}€/mois</span>
                      }
                    </div>
                  </div>

                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {plugin.description}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Star size={11} fill="var(--color-warning)" color="var(--color-warning)" />
                        {plugin.rating}
                      </span>
                      <span>·</span>
                      <span><Download size={11} style={{ verticalAlign: 'middle' }} /> {plugin.installCount.toLocaleString('fr-FR')}</span>
                    </div>

                    {plugin.isInstalled ? (
                      <span className="o-badge o-badge-success">✓ Installé</span>
                    ) : (
                      <button
                        onClick={e => { e.stopPropagation(); installMutation.mutate(plugin.name); }}
                        disabled={installMutation.isPending}
                        className="o-btn o-btn-primary o-btn-sm"
                      >
                        {plugin.isFree ? 'Installer' : 'Essayer 14j'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Panel détail */}
        {selected && (
          <div style={{ width: 360, borderLeft: '1px solid var(--border-color)', background: 'var(--bg-card)', overflow: 'auto', flexShrink: 0 }}>
            <div style={{ padding: 20, borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 48 }}>{selected.icon}</div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>{selected.displayName}</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px' }}>par {selected.author} · v{selected.version}</p>

              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                {selected.isVerified && <span className="o-badge o-badge-primary">✓ Vérifié</span>}
                <span className="o-badge o-badge-muted">{selected.category}</span>
                {selected.isFree ? <span className="o-badge o-badge-success">Gratuit</span> : <span className="o-badge o-badge-warning">{selected.price}€/mois</span>}
              </div>

              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>{selected.description}</p>

              <div style={{ marginBottom: 20 }}>
                {[
                  { label: 'Note', value: `${selected.rating}/5 ⭐` },
                  { label: 'Installations', value: selected.installCount.toLocaleString('fr-FR') },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{row.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{row.value}</span>
                  </div>
                ))}
              </div>

              {selected.isInstalled ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: 'rgba(40,167,69,.08)', color: '#28A745', fontSize: 13, fontWeight: 600 }}>
                  <CheckCircle2 size={14} /> Plugin installé et actif
                </div>
              ) : (
                <button
                  onClick={() => installMutation.mutate(selected.name)}
                  disabled={installMutation.isPending}
                  className="o-btn o-btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <Download size={14} />
                  {selected.isFree ? 'Installer gratuitement' : `Essai gratuit 14 jours`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
