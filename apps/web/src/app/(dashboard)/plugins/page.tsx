'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Search, Upload, RefreshCw, Power, Settings,
  CheckCircle2, XCircle, Lock, Package, ChevronRight,
  Star, Download, ExternalLink,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface Plugin {
  name: string;
  displayName: string;
  version: string;
  description: string;
  author: string;
  category: string;
  icon: string;
  isActive: boolean;
  isCore: boolean;
  isInstalled: boolean;
  isVerified: boolean;
  rating: number;
  installCount: number;
  config: Record<string, any>;
}

const CATEGORY_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  CORE:          { label: 'Core', color: '#DC3545', bg: '#F8D7DA' },
  CRM:           { label: 'CRM', color: '#017E84', bg: '#E8F5F5' },
  PROSPECTING:   { label: 'Prospection', color: '#714B67', bg: '#F3EBF1' },
  MARKETING:     { label: 'Marketing', color: '#F0AD4E', bg: '#FFF3CD' },
  SEO:           { label: 'SEO', color: '#28A745', bg: '#D4EDDA' },
  REPUTATION:    { label: 'E-Réputation', color: '#17A2B8', bg: '#D1ECF1' },
  AI:            { label: 'Intelligence IA', color: '#6F42C1', bg: '#E9E3F5' },
  AUTOMATION:    { label: 'Automation', color: '#E83E8C', bg: '#FCE4F0' },
  ANALYTICS:     { label: 'Analytics', color: '#FD7E14', bg: '#FFE5D0' },
  COMMUNICATION: { label: 'Communication', color: '#20C997', bg: '#D2F4EA' },
  INTEGRATION:   { label: 'Intégrations', color: '#6C757D', bg: '#F8F9FA' },
  TOOLS:         { label: 'Outils', color: '#343A40', bg: '#F8F9FA' },
};

export default function PluginsPage() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('ALL');
  const [filterState, setFilterState] = useState<'all' | 'active' | 'inactive'>('all');
  const [selected, setSelected] = useState<Plugin | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<Plugin[]>('/plugins');
      setPlugins(Array.isArray(data) ? data : []);
    } catch { toast.error('Erreur chargement plugins'); }
    finally { setLoading(false); }
  };

  const toggle = async (plugin: Plugin) => {
    if (plugin.isCore) return;
    setToggling(plugin.name);
    try {
      const result = await apiClient.post<any>(`/plugins/${plugin.name}/toggle`, {});
      setPlugins(prev => prev.map(p => p.name === plugin.name ? { ...p, isActive: result.status === 'active' } : p));
      if (selected?.name === plugin.name) setSelected(prev => prev ? { ...prev, isActive: result.status === 'active' } : null);
      toast.success(result.status === 'active' ? `✓ Plugin "${plugin.displayName}" activé` : `Plugin "${plugin.displayName}" désactivé`);
    } catch (e: any) {
      toast.error(e?.message || 'Erreur');
    } finally { setToggling(null); }
  };

  const uploadZip = async (file: File) => {
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const result = await apiClient.upload<any>('/plugins/upload', fd);
      toast.success(`✓ Plugin "${result.pluginName}" v${result.version} installé`);
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Erreur installation');
    } finally { setUploading(false); }
  };

  const filtered = plugins.filter(p => {
    const matchSearch = !search ||
      p.displayName.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'ALL' || p.category === filterCat;
    const matchState = filterState === 'all' || (filterState === 'active' ? p.isActive : !p.isActive);
    return matchSearch && matchCat && matchState;
  });

  const categories = ['ALL', ...new Set(plugins.map(p => p.category))];
  const stats = { total: plugins.length, active: plugins.filter(p => p.isActive).length };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-app)' }}>

      {/* Header Odoo-style */}
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', padding: '16px 24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Plugins</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
              {stats.active} actifs · {stats.total - stats.active} inactifs · {stats.total} installés
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={load} className="o-btn o-btn-secondary o-btn-sm">
              <RefreshCw size={13} /> Actualiser
            </button>
            <input ref={fileRef} type="file" accept=".zip" style={{ display: 'none' }}
              onChange={e => e.target.files?.[0] && uploadZip(e.target.files[0])} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="o-btn o-btn-primary o-btn-sm">
              <Upload size={13} />
              {uploading ? 'Installation...' : 'Installer un plugin'}
            </button>
          </div>
        </div>

        {/* Filtres */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '6px 12px', flex: '1', maxWidth: 320 }}>
            <Search size={13} color="var(--text-muted)" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
              style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-primary)', flex: 1 }} />
          </div>

          {/* State tabs */}
          <div style={{ display: 'flex', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 6, overflow: 'hidden' }}>
            {(['all', 'active', 'inactive'] as const).map(s => (
              <button key={s} onClick={() => setFilterState(s)}
                style={{ padding: '5px 14px', border: 'none', fontSize: 13, cursor: 'pointer', fontWeight: filterState === s ? 600 : 400, background: filterState === s ? 'var(--color-primary)' : 'transparent', color: filterState === s ? '#fff' : 'var(--text-secondary)', transition: 'all .15s' }}>
                {s === 'all' ? 'Tous' : s === 'active' ? '● Actifs' : '○ Inactifs'}
              </button>
            ))}
          </div>

          {/* Category */}
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="o-form-control o-form-control-sm" style={{ width: 'auto', minWidth: 160 }}>
            <option value="ALL">Toutes les catégories</option>
            {categories.filter(c => c !== 'ALL').map(c => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]?.label || c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex' }}>

        {/* Plugin list */}
        <div style={{ flex: 1, padding: 24, overflow: 'auto' }}>
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="o-skeleton" style={{ height: 140, borderRadius: 8 }} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
              {filtered.map(plugin => {
                const cat = CATEGORY_LABELS[plugin.category] || CATEGORY_LABELS.TOOLS;
                const isSelected = selected?.name === plugin.name;
                return (
                  <div key={plugin.name}
                    onClick={() => setSelected(isSelected ? null : plugin)}
                    style={{ background: 'var(--bg-card)', border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--border-color)'}`, borderRadius: 8, padding: 16, cursor: 'pointer', transition: 'all .15s', boxShadow: isSelected ? '0 0 0 3px rgba(1,126,132,.12)' : 'var(--shadow-card)', opacity: !plugin.isActive && !plugin.isCore ? 0.75 : 1 }}>

                    {/* Header card */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 8, background: cat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                          {plugin.icon || '🔌'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                            {plugin.displayName}
                            {plugin.isVerified && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--color-primary)' }}>✓</span>}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>v{plugin.version} · {plugin.author}</div>
                        </div>
                      </div>

                      {/* Toggle switch */}
                      {plugin.isCore ? (
                        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#F8D7DA', color: '#DC3545', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Lock size={10} /> CORE
                        </span>
                      ) : (
                        <button onClick={e => { e.stopPropagation(); toggle(plugin); }}
                          disabled={toggling === plugin.name}
                          className={`o-switch ${plugin.isActive ? 'active' : ''}`}
                          title={plugin.isActive ? 'Désactiver' : 'Activer'} />
                      )}
                    </div>

                    {/* Description */}
                    <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {plugin.description}
                    </p>

                    {/* Footer */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: cat.bg, color: cat.color }}>
                        {cat.label}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: plugin.isActive ? 'var(--color-success)' : 'var(--text-muted)' }}>
                        {plugin.isActive ? <><CheckCircle2 size={12} /> Actif</> : <><XCircle size={12} /> Inactif</>}
                      </div>
                    </div>
                  </div>
                );
              })}

              {filtered.length === 0 && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>
                  <Package size={48} style={{ opacity: .2, marginBottom: 16 }} />
                  <p style={{ fontSize: 15, fontWeight: 500 }}>Aucun plugin trouvé</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Panel détail */}
        {selected && (
          <div style={{ width: 340, borderLeft: '1px solid var(--border-color)', background: 'var(--bg-card)', overflow: 'auto', flexShrink: 0 }}>
            <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontSize: 40 }}>{selected.icon || '🔌'}</div>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 0 }}>×</button>
              </div>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: '12px 0 4px' }}>{selected.displayName}</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>v{selected.version} · par {selected.author}</p>
            </div>

            <div style={{ padding: 20 }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>{selected.description}</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                <InfoRow label="Catégorie" value={CATEGORY_LABELS[selected.category]?.label || selected.category} />
                <InfoRow label="Statut" value={selected.isActive ? '● Actif' : '○ Inactif'} color={selected.isActive ? 'var(--color-success)' : 'var(--text-muted)'} />
                <InfoRow label="Type" value={selected.isCore ? 'Core (système)' : 'Module optionnel'} />
                {selected.rating > 0 && <InfoRow label="Note" value={`${selected.rating.toFixed(1)} / 5.0`} />}
                {selected.installCount > 0 && <InfoRow label="Installations" value={selected.installCount.toLocaleString('fr-FR')} />}
              </div>

              {!selected.isCore && (
                <button
                  onClick={() => toggle(selected)}
                  disabled={toggling === selected.name}
                  style={{ width: '100%', padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all .15s', background: selected.isActive ? 'var(--color-danger-light)' : 'var(--color-primary-light)', color: selected.isActive ? 'var(--color-danger)' : 'var(--color-primary)' }}>
                  <Power size={14} />
                  {selected.isActive ? 'Désactiver ce plugin' : 'Activer ce plugin'}
                </button>
              )}

              {selected.isCore && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 6, background: '#F8D7DA', color: '#DC3545', fontSize: 13 }}>
                  <Lock size={13} /> Plugin système — toujours actif
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 500, color: color || 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}
