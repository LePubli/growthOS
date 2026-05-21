'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Plus, Download, RefreshCw, Trash2, Mail,
  GitBranch, Filter, ChevronDown, MoreHorizontal,
  Building2, Phone, Globe, Zap,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface Prospect {
  id: string; company_name: string; siren?: string;
  naf_label?: string; city?: string; region?: string;
  employee_range?: string; phone?: string; email?: string;
  website?: string; propensity_score?: number;
  propensity_category?: 'HOT' | 'WARM' | 'COLD';
  sources_used?: string[]; stage_name?: string; stage_color?: string;
  created_at: string;
}

interface Filters {
  search?: string; propensity_category?: string;
  city?: string; naf_code?: string; stage_id?: string;
  has_email?: boolean; has_phone?: boolean; min_score?: number;
}

const CAT_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  HOT:  { bg: 'rgba(220,53,69,.1)',  color: '#DC3545', label: '🔥 HOT' },
  WARM: { bg: 'rgba(240,173,78,.1)', color: '#F0AD4E', label: '🌡 WARM' },
  COLD: { bg: 'rgba(1,126,132,.1)',  color: '#017E84', label: '❄️ COLD' },
};

const COLUMNS = [
  { key: 'company_name', label: 'Entreprise', width: 220, sticky: true },
  { key: 'siren',        label: 'SIREN',      width: 100 },
  { key: 'city',         label: 'Ville',       width: 120 },
  { key: 'naf_label',    label: 'Secteur',     width: 180 },
  { key: 'employee_range', label: 'Effectifs', width: 100 },
  { key: 'phone',        label: 'Téléphone',   width: 140 },
  { key: 'email',        label: 'Email',       width: 200 },
  { key: 'website',      label: 'Site web',    width: 180 },
  { key: 'propensity_score', label: 'Score',   width: 80 },
  { key: 'propensity_category', label: 'Cat.', width: 80 },
  { key: 'stage_name',   label: 'Étape',       width: 120 },
];

export default function ProspectsPage() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Filters>({});
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ company_name: '', city: '', phone: '', email: '', website: '', naf_code: '' });
  const PAGE_SIZE = 50;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['prospects', filters, page],
    queryFn: () => apiClient.get<any>('/prospects', { ...filters, page, page_size: PAGE_SIZE }),
  });

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => apiClient.post('/prospects/bulk-delete', { ids }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['prospects'] }); setSelected(new Set()); toast.success('Supprimé'); },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiClient.post('/prospects', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['prospects'] }); setShowCreate(false); setCreateForm({ company_name: '', city: '', phone: '', email: '', website: '', naf_code: '' }); toast.success('Prospect créé'); },
    onError: (e: any) => toast.error(e.message),
  });

  const prospects: Prospect[] = data?.items || [];
  const total: number = data?.total || 0;
  const pages = Math.ceil(total / PAGE_SIZE);

  const toggleAll = () => {
    if (selected.size === prospects.length) setSelected(new Set());
    else setSelected(new Set(prospects.map(p => p.id)));
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const setFilter = (k: keyof Filters, v: any) => {
    setFilters(f => ({ ...f, [k]: v || undefined }));
    setPage(1);
  };

  const exportCSV = () => window.open('/api/v1/prospects/export/csv', '_blank');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg-app)' }}>

      {/* Toolbar */}
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', padding: '12px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>

          {/* Left */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {selected.size > 0 ? (
              <>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>{selected.size} sélectionné(s)</span>
                <button onClick={() => deleteMutation.mutate(Array.from(selected))} className="o-btn o-btn-danger o-btn-sm">
                  <Trash2 size={13} /> Supprimer
                </button>
                <button onClick={() => setSelected(new Set())} className="o-btn o-btn-ghost o-btn-sm">Désélectionner</button>
              </>
            ) : (
              <>
                <button onClick={() => setShowFilters(v => !v)}
                  className={`o-btn o-btn-sm ${showFilters ? 'o-btn-primary' : 'o-btn-secondary'}`}>
                  <Filter size={13} />
                  Filtres
                  {Object.values(filters).filter(Boolean).length > 0 && (
                    <span style={{ background: '#fff', color: 'var(--color-primary)', borderRadius: 9999, padding: '0 5px', fontSize: 10, fontWeight: 700 }}>
                      {Object.values(filters).filter(Boolean).length}
                    </span>
                  )}
                </button>
                <button onClick={() => refetch()} className="o-btn o-btn-secondary o-btn-sm"><RefreshCw size={13} /></button>
              </>
            )}
          </div>

          {/* Center - Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '6px 12px', flex: 1, maxWidth: 340 }}>
            <Search size={13} color="var(--text-muted)" />
            <input value={filters.search || ''} onChange={e => setFilter('search', e.target.value)}
              placeholder="Rechercher par nom, ville, SIREN..."
              style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-primary)', flex: 1 }} />
          </div>

          {/* Right */}
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>
              {total.toLocaleString('fr-FR')} prospects
            </span>
            <button onClick={exportCSV} className="o-btn o-btn-secondary o-btn-sm"><Download size={13} /> CSV</button>
            <button onClick={() => setShowCreate(true)} className="o-btn o-btn-primary o-btn-sm"><Plus size={13} /> Nouveau</button>
          </div>
        </div>

        {/* Filter bar */}
        {showFilters && (
          <div style={{ marginTop: 12, padding: '12px 0 4px', borderTop: '1px solid var(--border-light)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {[
              { label: 'Catégorie', key: 'propensity_category', type: 'select', options: [['', 'Toutes'], ['HOT', '🔥 HOT'], ['WARM', '🌡 WARM'], ['COLD', '❄️ COLD']] },
              { label: 'A un email', key: 'has_email', type: 'select', options: [['', 'Tous'], ['true', 'Avec email'], ['false', 'Sans email']] },
              { label: 'A un tel.', key: 'has_phone', type: 'select', options: [['', 'Tous'], ['true', 'Avec tél.'], ['false', 'Sans tél.']] },
            ].map(f => (
              <div key={f.key}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>{f.label}</div>
                <select value={String((filters as any)[f.key] || '')}
                  onChange={e => setFilter(f.key as keyof Filters, e.target.value === 'true' ? true : e.target.value === 'false' ? false : e.target.value)}
                  className="o-form-control o-form-control-sm" style={{ width: 'auto' }}>
                  {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            ))}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>Score min</div>
              <input type="number" value={filters.min_score || ''}
                onChange={e => setFilter('min_score', e.target.value ? Number(e.target.value) : undefined)}
                placeholder="0-100" min={0} max={100} className="o-form-control o-form-control-sm" style={{ width: 80 }} />
            </div>
            <button onClick={() => { setFilters({}); setPage(1); }} className="o-btn o-btn-ghost o-btn-sm">
              Réinitialiser
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {isLoading ? (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="o-skeleton" style={{ height: 38, borderRadius: 4 }} />
            ))}
          </div>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: 'max-content', minWidth: '100%', fontSize: 13 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr style={{ background: '#F8F9FA', borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ width: 40, padding: '10px 12px', textAlign: 'center', position: 'sticky', left: 0, background: '#F8F9FA', zIndex: 11 }}>
                  <input type="checkbox" checked={selected.size === prospects.length && prospects.length > 0}
                    onChange={toggleAll} style={{ accentColor: 'var(--color-primary)', cursor: 'pointer' }} />
                </th>
                <th style={{ width: 36, padding: '10px 6px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, position: 'sticky', left: 40, background: '#F8F9FA', zIndex: 11 }}>#</th>
                {COLUMNS.map(col => (
                  <th key={col.key} style={{
                    width: col.width, minWidth: col.width, padding: '10px 12px',
                    textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
                    textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap',
                    ...(col.sticky ? { position: 'sticky', left: 76, background: '#F8F9FA', zIndex: 11 } : {}),
                  }}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prospects.length === 0 ? (
                <tr><td colSpan={COLUMNS.length + 3} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Building2 size={40} style={{ opacity: .15, marginBottom: 12 }} />
                  <p style={{ fontWeight: 500 }}>Aucun prospect trouvé</p>
                </td></tr>
              ) : prospects.map((p, idx) => {
                const cat = CAT_STYLE[p.propensity_category || ''];
                const isSelected = selected.has(p.id);
                return (
                  <tr key={p.id}
                    style={{ borderBottom: '1px solid var(--border-light)', background: isSelected ? 'rgba(1,126,132,.04)' : 'transparent', transition: 'background .1s', cursor: 'pointer' }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#F8F9FA'; }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <td style={{ width: 40, padding: '8px 12px', textAlign: 'center', position: 'sticky', left: 0, background: isSelected ? 'rgba(1,126,132,.04)' : 'var(--bg-card)', zIndex: 5 }}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggle(p.id)}
                        style={{ accentColor: 'var(--color-primary)', cursor: 'pointer' }} />
                    </td>
                    <td style={{ width: 36, padding: '8px 6px', color: 'var(--text-muted)', fontSize: 11, fontFamily: 'monospace', position: 'sticky', left: 40, background: isSelected ? 'rgba(1,126,132,.04)' : 'var(--bg-card)', zIndex: 5 }}>
                      {(page - 1) * PAGE_SIZE + idx + 1}
                    </td>
                    {/* company_name */}
                    <td style={{ width: 220, padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', position: 'sticky', left: 76, background: isSelected ? 'rgba(1,126,132,.04)' : 'var(--bg-card)', zIndex: 5 }}>
                      <a href={`/prospects/${p.id}`} style={{ color: 'var(--text-primary)', textDecoration: 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-primary)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}>
                        {p.company_name}
                      </a>
                    </td>
                    <td style={{ width: 100, padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{p.siren || '—'}</td>
                    <td style={{ width: 120, padding: '8px 12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.city || '—'}</td>
                    <td style={{ width: 180, padding: '8px 12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{p.naf_label || '—'}</td>
                    <td style={{ width: 100, padding: '8px 12px', color: 'var(--text-muted)' }}>{p.employee_range || '—'}</td>
                    <td style={{ width: 140, padding: '8px 12px' }}>
                      {p.phone ? <a href={`tel:${p.phone}`} style={{ color: 'var(--color-primary)', fontSize: 12 }}>{p.phone}</a> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ width: 200, padding: '8px 12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.email ? <a href={`mailto:${p.email}`} style={{ color: 'var(--color-primary)', fontSize: 12 }}>{p.email}</a> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ width: 180, padding: '8px 12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.website ? <a href={p.website} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)', fontSize: 12 }}>{p.website.replace(/^https?:\/\//, '')}</a> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ width: 80, padding: '8px 12px', textAlign: 'center' }}>
                      {p.propensity_score != null ? (
                        <span style={{ fontWeight: 700, color: p.propensity_score >= 70 ? '#DC3545' : p.propensity_score >= 40 ? '#F0AD4E' : '#017E84' }}>
                          {Math.round(p.propensity_score)}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ width: 80, padding: '8px 12px' }}>
                      {cat ? <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: cat.bg, color: cat.color }}>{cat.label}</span> : '—'}
                    </td>
                    <td style={{ width: 120, padding: '8px 12px' }}>
                      {p.stage_name ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.stage_color || '#ccc', flexShrink: 0 }} />
                          {p.stage_name}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ padding: '10px 20px', background: 'var(--bg-card)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Page <strong style={{ color: 'var(--text-primary)' }}>{page}</strong> sur {pages} — {total.toLocaleString('fr-FR')} résultats
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="o-btn o-btn-secondary o-btn-sm">←</button>
            {Array.from({ length: Math.min(5, pages) }, (_, i) => {
              const p = Math.max(1, Math.min(page - 2, pages - 4)) + i;
              return (
                <button key={p} onClick={() => setPage(p)} className="o-btn o-btn-sm"
                  style={{ background: p === page ? 'var(--color-primary)' : '#fff', color: p === page ? '#fff' : 'var(--text-secondary)', border: `1px solid ${p === page ? 'var(--color-primary)' : 'var(--border-color)'}` }}>
                  {p}
                </button>
              );
            })}
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="o-btn o-btn-secondary o-btn-sm">→</button>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 480, maxWidth: '95vw', boxShadow: 'var(--shadow-lg)', animation: 'popIn .15s ease' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 20px', color: 'var(--text-primary)' }}>
              <Plus size={16} style={{ verticalAlign: 'middle', marginRight: 8 }} />
              Nouveau prospect
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="o-form-group" style={{ margin: 0 }}>
                <label className="o-form-label required">Nom de l'entreprise</label>
                <input className="o-form-control" value={createForm.company_name}
                  onChange={e => setCreateForm(f => ({ ...f, company_name: e.target.value }))} placeholder="Acme SAS" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { key: 'city', label: 'Ville', placeholder: 'Paris' },
                  { key: 'naf_code', label: 'Code NAF', placeholder: '62.01' },
                  { key: 'phone', label: 'Téléphone', placeholder: '01 23 45 67 89' },
                  { key: 'email', label: 'Email', placeholder: 'contact@acme.fr' },
                ].map(f => (
                  <div key={f.key} className="o-form-group" style={{ margin: 0 }}>
                    <label className="o-form-label">{f.label}</label>
                    <input className="o-form-control" value={(createForm as any)[f.key]}
                      onChange={e => setCreateForm(frm => ({ ...frm, [f.key]: e.target.value }))} placeholder={f.placeholder} />
                  </div>
                ))}
              </div>
              <div className="o-form-group" style={{ margin: 0 }}>
                <label className="o-form-label">Site web</label>
                <input className="o-form-control" value={createForm.website}
                  onChange={e => setCreateForm(f => ({ ...f, website: e.target.value }))} placeholder="https://acme.fr" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowCreate(false)} className="o-btn o-btn-secondary o-btn-sm">Annuler</button>
              <button disabled={!createForm.company_name || createMutation.isPending}
                onClick={() => createMutation.mutate(createForm)} className="o-btn o-btn-primary o-btn-sm">
                {createMutation.isPending ? 'Création...' : 'Créer le prospect'}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes popIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );
}
