import { useState } from 'react';
import {
  LayoutDashboard, Plus, Share2, Copy, Eye, Edit2, Trash2, X,
  Users, Lock, Globe, BarChart2, TrendingUp, Target, CheckCircle,
  Link as LinkIcon,
} from 'lucide-react';
import { toast } from 'sonner';

type Visibility = 'private' | 'team' | 'public';
type WidgetType = 'prospects' | 'pipeline' | 'revenue' | 'activity' | 'conversion' | 'signals';

interface Widget { id: string; type: WidgetType; label: string; }
interface Dashboard {
  id: string;
  name: string;
  description: string;
  visibility: Visibility;
  author: string;
  createdAt: string;
  views: number;
  widgets: Widget[];
  shareToken: string;
}

const WIDGET_META: Record<WidgetType, { icon: React.ReactNode; color: string; bg: string; mockValue: string; mockLabel: string }> = {
  prospects:  { icon: <Users size={16} />,      color: '#2563EB', bg: '#EFF6FF', mockValue: '248', mockLabel: 'prospects actifs' },
  pipeline:   { icon: <BarChart2 size={16} />,   color: '#7C3AED', bg: '#EDE9FE', mockValue: '142k€', mockLabel: 'pipeline total' },
  revenue:    { icon: <TrendingUp size={16} />,  color: '#059669', bg: '#ECFDF5', mockValue: '38k€', mockLabel: 'CA ce mois' },
  activity:   { icon: <CheckCircle size={16} />, color: '#D97706', bg: '#FEF3C7', mockValue: '47', mockLabel: 'activités semaine' },
  conversion: { icon: <Target size={16} />,      color: '#DC2626', bg: '#FEF2F2', mockValue: '18%', mockLabel: 'taux conversion' },
  signals:    { icon: <TrendingUp size={16} />,  color: '#0891B2', bg: '#ECFEFF', mockValue: '12', mockLabel: 'signaux intent' },
};

const VIS_CFG: Record<Visibility, { label: string; icon: React.ReactNode; color: string }> = {
  private: { label: 'Privé',   icon: <Lock size={12} />,  color: '#6B7280' },
  team:    { label: 'Équipe',  icon: <Users size={12} />, color: '#2563EB' },
  public:  { label: 'Public',  icon: <Globe size={12} />, color: '#059669' },
};

const ALL_WIDGETS: { type: WidgetType; label: string }[] = [
  { type: 'prospects',  label: 'Prospects actifs' },
  { type: 'pipeline',   label: 'Pipeline' },
  { type: 'revenue',    label: 'CA & Revenus' },
  { type: 'activity',   label: 'Activités' },
  { type: 'conversion', label: 'Taux de conversion' },
  { type: 'signals',    label: 'Signaux intent' },
];

const MOCK_DASHBOARDS: Dashboard[] = [
  {
    id: '1', name: 'Dashboard Commercial Q2', description: 'Vue d\'ensemble des performances commerciales du trimestre',
    visibility: 'team', author: 'Sophie Martin', createdAt: '2026-05-15', views: 142, shareToken: 'tok_abc123',
    widgets: [
      { id: '1', type: 'prospects', label: 'Prospects actifs' },
      { id: '2', type: 'pipeline',  label: 'Pipeline' },
      { id: '3', type: 'revenue',   label: 'CA & Revenus' },
      { id: '4', type: 'conversion', label: 'Taux de conversion' },
    ],
  },
  {
    id: '2', name: 'Suivi Signaux Intent', description: 'Tableau de bord centré sur les signaux d\'achat détectés',
    visibility: 'private', author: 'Paul Dupont', createdAt: '2026-05-28', views: 23, shareToken: 'tok_def456',
    widgets: [
      { id: '1', type: 'signals',  label: 'Signaux intent' },
      { id: '2', type: 'activity', label: 'Activités' },
    ],
  },
  {
    id: '3', name: 'Rapport Direction — Mai 2026', description: 'Dashboard partagé avec la direction pour le reporting mensuel',
    visibility: 'public', author: 'Marie Dubois', createdAt: '2026-05-31', views: 89, shareToken: 'tok_ghi789',
    widgets: [
      { id: '1', type: 'revenue',    label: 'CA & Revenus' },
      { id: '2', type: 'prospects',  label: 'Prospects actifs' },
      { id: '3', type: 'conversion', label: 'Taux de conversion' },
    ],
  },
];

function CreateModal({ onClose, onSave }: { onClose: () => void; onSave: (d: Dashboard) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('team');
  const [selectedWidgets, setSelectedWidgets] = useState<WidgetType[]>(['prospects', 'pipeline']);

  const toggleWidget = (type: WidgetType) => {
    setSelectedWidgets(w => w.includes(type) ? w.filter(x => x !== type) : [...w, type]);
  };

  const save = () => {
    if (!name.trim()) { toast.error('Donnez un nom au dashboard'); return; }
    const d: Dashboard = {
      id: Date.now().toString(),
      name: name.trim(),
      description: description.trim(),
      visibility,
      author: 'Moi',
      createdAt: new Date().toISOString().split('T')[0],
      views: 0,
      shareToken: `tok_${Math.random().toString(36).slice(2, 10)}`,
      widgets: selectedWidgets.map((type, i) => ({ id: String(i + 1), type, label: ALL_WIDGETS.find(w => w.type === type)!.label })),
    };
    onSave(d);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Nouveau dashboard partagé</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>Nom du dashboard *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Dashboard Commercial Q3"
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Pour qui ce dashboard ? Quelles métriques ?" rows={2}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Visibilité</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(Object.keys(VIS_CFG) as Visibility[]).map(v => {
                const cfg = VIS_CFG[v];
                const active = visibility === v;
                return (
                  <button key={v} onClick={() => setVisibility(v)}
                    style={{ flex: 1, padding: '8px 10px', borderRadius: 10, border: `1px solid ${active ? cfg.color : 'var(--card-border)'}`, background: active ? `${cfg.color}15` : 'transparent', color: active ? cfg.color : 'var(--text-muted)', fontSize: 12, fontWeight: active ? 700 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                    {cfg.icon}{cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Widgets à inclure</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              {ALL_WIDGETS.map(w => {
                const meta = WIDGET_META[w.type];
                const active = selectedWidgets.includes(w.type);
                return (
                  <button key={w.type} onClick={() => toggleWidget(w.type)}
                    style={{ padding: '8px 10px', borderRadius: 9, border: `1px solid ${active ? meta.color : 'var(--card-border)'}`, background: active ? meta.bg : 'transparent', color: active ? meta.color : 'var(--text-muted)', fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, textAlign: 'left' }}>
                    {meta.icon}{w.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>Annuler</button>
          <button onClick={save} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Créer le dashboard</button>
        </div>
      </div>
    </div>
  );
}

function DashboardPreview({ dashboard, onClose }: { dashboard: Dashboard; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: 'var(--card-bg)', borderRadius: 20, width: '100%', maxWidth: 680, maxHeight: '88vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{dashboard.name}</h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0' }}>{dashboard.description}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>
        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
          {dashboard.widgets.map(w => {
            const meta = WIDGET_META[w.type];
            return (
              <div key={w.id} style={{ padding: '18px 16px', borderRadius: 14, border: `1px solid ${meta.color}30`, background: meta.bg }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: meta.color }}>{meta.icon}<span style={{ fontSize: 12, fontWeight: 600 }}>{w.label}</span></div>
                <div style={{ fontSize: 28, fontWeight: 800, color: meta.color }}>{meta.mockValue}</div>
                <div style={{ fontSize: 11, color: meta.color, opacity: 0.7, marginTop: 2 }}>{meta.mockLabel}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function SharedDashboardsPage() {
  const [dashboards, setDashboards] = useState<Dashboard[]>(MOCK_DASHBOARDS);
  const [showCreate, setShowCreate] = useState(false);
  const [preview, setPreview] = useState<Dashboard | null>(null);
  const [search, setSearch] = useState('');
  const [visFilter, setVisFilter] = useState<Visibility | 'all'>('all');

  const filtered = dashboards.filter(d => {
    const q = search.toLowerCase();
    const matchQ = !q || `${d.name} ${d.description}`.toLowerCase().includes(q);
    const matchV = visFilter === 'all' || d.visibility === visFilter;
    return matchQ && matchV;
  });

  const copyLink = (d: Dashboard) => {
    const url = `${window.location.origin}/shared/${d.shareToken}`;
    navigator.clipboard.writeText(url).catch(() => {});
    toast.success('Lien copié dans le presse-papiers');
  };

  const deleteDashboard = (id: string) => {
    setDashboards(ds => ds.filter(d => d.id !== id));
    toast.success('Dashboard supprimé');
  };

  const addDashboard = (d: Dashboard) => {
    setDashboards(ds => [d, ...ds]);
    toast.success('Dashboard créé');
  };

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: 'var(--body-bg)' }}>
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onSave={addDashboard} />}
      {preview && <DashboardPreview dashboard={preview} onClose={() => setPreview(null)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Dashboards Partagés</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{dashboards.length} dashboards · partagez vos vues avec l'équipe ou la direction</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 12, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <Plus size={14} />Nouveau dashboard
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { l: 'Total dashboards', v: dashboards.length, c: '#2563EB', bg: '#EFF6FF', icon: <LayoutDashboard size={16} /> },
          { l: 'Partagés équipe', v: dashboards.filter(d => d.visibility === 'team').length, c: '#7C3AED', bg: '#EDE9FE', icon: <Users size={16} /> },
          { l: 'Publics', v: dashboards.filter(d => d.visibility === 'public').length, c: '#059669', bg: '#ECFDF5', icon: <Globe size={16} /> },
        ].map((k, i) => (
          <div key={i} className="rounded-2xl border p-4 flex items-center gap-3" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: k.bg, color: k.c }}>{k.icon}</div>
            <div>
              <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{k.v}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{k.l}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <LayoutDashboard size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un dashboard..."
            style={{ width: '100%', paddingLeft: 30, paddingRight: 12, paddingTop: 9, paddingBottom: 9, borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'private', 'team', 'public'] as const).map(v => (
            <button key={v} onClick={() => setVisFilter(v)}
              style={{ padding: '7px 13px', borderRadius: 9, border: `1px solid ${visFilter === v ? 'var(--color-primary)' : 'var(--card-border)'}`, background: visFilter === v ? `var(--color-primary)15` : 'var(--card-bg)', color: visFilter === v ? 'var(--color-primary)' : 'var(--text-secondary)', fontSize: 12, fontWeight: visFilter === v ? 700 : 400, cursor: 'pointer' }}>
              {v === 'all' ? 'Tous' : VIS_CFG[v as Visibility].label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {filtered.map(d => {
          const vis = VIS_CFG[d.visibility];
          return (
            <div key={d.id} style={{ background: 'var(--card-bg)', borderRadius: 18, border: '1px solid var(--card-border)', padding: '18px 18px 14px', display: 'flex', flexDirection: 'column', gap: 14, transition: 'all 0.1s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(0,0,0,.08)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}>
              {/* Top */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{d.description || 'Aucune description'}</div>
                </div>
                <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, background: `${vis.color}15`, color: vis.color, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  {vis.icon}{vis.label}
                </span>
              </div>

              {/* Widgets preview */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {d.widgets.map(w => {
                  const meta = WIDGET_META[w.type];
                  return (
                    <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 8, background: meta.bg, color: meta.color, fontSize: 11, fontWeight: 600 }}>
                      {meta.icon}<span>{meta.mockValue}</span>
                    </div>
                  );
                })}
              </div>

              {/* Meta */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Users size={10} />{d.author}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Eye size={10} />{d.views} vues</span>
                <span style={{ marginLeft: 'auto' }}>{d.createdAt}</span>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 7, borderTop: '1px solid var(--card-border)', paddingTop: 12 }}>
                <button onClick={() => setPreview(d)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 0', borderRadius: 9, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
                  <Eye size={13} />Aperçu
                </button>
                <button onClick={() => copyLink(d)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 0', borderRadius: 9, border: `1px solid var(--color-primary)`, background: `var(--color-primary)10`, color: 'var(--color-primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  <LinkIcon size={13} />Partager
                </button>
                <button onClick={() => deleteDashboard(d.id)} style={{ width: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}

        {/* Add new card */}
        <button onClick={() => setShowCreate(true)}
          style={{ borderRadius: 18, border: `2px dashed var(--card-border)`, background: 'transparent', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', minHeight: 180, transition: 'all 0.1s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-primary)'; (e.currentTarget as HTMLElement).style.background = 'var(--color-primary)08'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--card-border)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
          <Plus size={24} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>Nouveau dashboard</span>
        </button>

        {filtered.length === 0 && dashboards.length > 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
            <LayoutDashboard size={40} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
            <div style={{ fontSize: 14 }}>Aucun dashboard trouvé</div>
          </div>
        )}
      </div>
    </div>
  );
}
