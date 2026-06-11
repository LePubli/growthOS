import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  Zap, Star, Eye, EyeOff, RefreshCw, TrendingUp, Users, DollarSign,
  Newspaper, Cpu, Filter, X, UserPlus, Mail, SlidersHorizontal,
  Flame, Thermometer, Wind, ChevronDown, Loader2,
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

/* ─────────────── types & config ─────────────── */

interface Signal {
  id: string;
  type: string;
  company: string;
  title: string;
  description?: string;
  score: number;
  isRead: boolean;
  isStarred: boolean;
  source?: string;
  detectedAt?: string;
  createdAt?: string;
  tags?: string[];
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  funding:           { label:'Financement',      color:'#059669', bg:'#ECFDF5', icon:<DollarSign size={13}/> },
  hiring:            { label:'Recrutement',       color:'#2563EB', bg:'#EFF6FF', icon:<Users size={13}/> },
  news:              { label:'Actualité',         color:'#7C3AED', bg:'#F5F3FF', icon:<Newspaper size={13}/> },
  technology:        { label:'Technologie',       color:'#D97706', bg:'#FFFBEB', icon:<Cpu size={13}/> },
  intent:            { label:'Intention',         color:'#DC2626', bg:'#FEF2F2', icon:<TrendingUp size={13}/> },
  reputation_crisis: { label:'Crise E-Rep',      color:'#B91C1C', bg:'#FEF2F2', icon:<Zap size={13}/> },
};

function scoreColor(s: number): { text: string; bg: string; label: string; icon: React.ReactNode } {
  if (s >= 85) return { text:'#059669', bg:'#ECFDF5', label:'Hot',  icon:<Flame size={11}/> };
  if (s >= 65) return { text:'#D97706', bg:'#FFFBEB', label:'Warm', icon:<Thermometer size={11}/> };
  return              { text:'#6B7280', bg:'#F3F4F6', label:'Cold', icon:<Wind size={11}/> };
}

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (d < 1) return "À l'instant";
  if (d < 60) return `il y a ${d} min`;
  if (d < 1440) return `il y a ${Math.floor(d/60)}h`;
  return `il y a ${Math.floor(d/1440)}j`;
}

/* ─────────────── main ─────────────── */
export default function SignalsPage() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [scoreMin, setScoreMin] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Fetch signals from API
  const { data: rawSignals = [], isLoading, refetch, isFetching } = useQuery<Signal[]>({
    queryKey: ['signals-page'],
    queryFn: async () => {
      const data: any = await apiClient.get('/signals?limit=200');
      // API returns { data: [...] } or array directly
      const arr = Array.isArray(data) ? data : (data?.data ?? data?.signals ?? []);
      return arr.map((s: any) => ({
        id: s.id,
        type: s.type ?? 'news',
        company: s.company ?? '',
        title: s.title ?? '',
        description: s.description ?? s.body ?? '',
        score: s.score ?? 50,
        isRead: s.isRead ?? s.is_read ?? false,
        isStarred: s.isStarred ?? s.is_starred ?? false,
        source: s.source ?? 'GrowthOS',
        detectedAt: s.detectedAt ?? s.detected_at ?? s.createdAt ?? s.created_at,
        tags: s.tags ?? [],
      }));
    },
    refetchInterval: 30000,
  });

  // ── Mutations
  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/signals/${id}/read`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['signals-page'] }),
  });

  const starMutation = useMutation({
    mutationFn: ({ id, isStarred }: { id: string; isStarred: boolean }) =>
      apiClient.patch(`/signals/${id}`, { isStarred }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['signals-page'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const unread = rawSignals.filter(s => !s.isRead);
      await Promise.all(unread.map(s => apiClient.post(`/signals/${s.id}/read`, {}).catch(() => {})));
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['signals-page'] }); toast.success('Tous les signaux marqués comme lus'); },
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/signals/${id}`, { isRead: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['signals-page'] }),
  });

  const addProspectMutation = useMutation({
    mutationFn: (s: Signal) => apiClient.post('/prospects', {
      company: s.company,
      firstName: '',
      lastName: s.company,
      email: `contact@${(s.company || 'company').toLowerCase().replace(/\s+/g, '')}.com`,
      status: 'new',
      source: 'signal',
    }),
    onSuccess: (_, s) => { toast.success(`${s.company} ajouté aux prospects`); qc.invalidateQueries({ queryKey: ['prospects'] }); },
    onError: () => toast.error('Erreur lors de l\'ajout'),
  });

  // ── Filters
  const signals = rawSignals.filter(s => !s.isRead || filter === 'all' || filter === 'starred');
  const hot    = rawSignals.filter(s => s.score >= 85).length;
  const warm   = rawSignals.filter(s => s.score >= 65 && s.score < 85).length;
  const cold   = rawSignals.filter(s => s.score < 65).length;
  const unread = rawSignals.filter(s => !s.isRead).length;

  const filtered = rawSignals.filter(s => {
    if (s.score < scoreMin) return false;
    if (filter === 'unread') return !s.isRead;
    if (filter === 'starred') return s.isStarred;
    if (filter === 'hot') return s.score >= 85;
    if (filter === 'warm') return s.score >= 65 && s.score < 85;
    if (filter === 'cold_only') return s.score < 65;
    if (filter !== 'all') return s.type === filter;
    return true;
  });

  const toggleSelect = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  if (isLoading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
      <Loader2 size={28} color="var(--color-primary)" style={{ animation:'spin 1s linear infinite' }} />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', padding: 24, background: 'var(--body-bg)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px' }}>Signaux d'intention</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>{unread} non lu{unread > 1 ? 's' : ''} · {filtered.length} signaux actifs</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowFilters(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--card-border)', background: showFilters ? 'var(--color-primary)' : 'var(--card-bg)', color: showFilters ? '#fff' : 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
            <SlidersHorizontal size={13} />Filtres
          </button>
          <button onClick={() => markAllReadMutation.mutate()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
            <Eye size={13} />Tout lire
          </button>
          <button onClick={() => refetch()} style={{ padding: 9, borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 18 }}>
        {[
          { l:'Hot (85+)',   v:hot,   color:'#DC2626', bg:'#FEF2F2', icon:<Flame size={14}/>,       k:'hot' },
          { l:'Warm (65+)',  v:warm,  color:'#D97706', bg:'#FFFBEB', icon:<Thermometer size={14}/>, k:'warm' },
          { l:'Cold (<65)',  v:cold,  color:'#6B7280', bg:'#F3F4F6', icon:<Wind size={14}/>,         k:'cold_only' },
          { l:'Non lus',    v:unread,color:'#2563EB', bg:'#EFF6FF', icon:<EyeOff size={14}/>,      k:'unread' },
        ].map(s => (
          <button key={s.l} onClick={() => setFilter(f => f === s.k ? 'all' : s.k)}
            style={{ borderRadius: 12, border: `1.5px solid ${filter === s.k ? s.color : 'var(--card-border)'}`, background: filter === s.k ? s.bg : 'var(--card-bg)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', transition: 'all .15s' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>{s.icon}</div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.v}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{s.l}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <div style={{ borderRadius: 14, border: '1px solid var(--card-border)', background: 'var(--card-bg)', padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Score minimum : <strong style={{ color: 'var(--color-primary)' }}>{scoreMin}</strong></label>
            <input type="range" min={0} max={100} step={5} value={scoreMin} onChange={e => setScoreMin(+e.target.value)}
              style={{ width: 180, accentColor: 'var(--color-primary)' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Type</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                <button key={k} onClick={() => setFilter(f => f === k ? 'all' : k)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 9999, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: filter === k ? v.bg : 'var(--body-bg)', color: filter === k ? v.color : 'var(--text-muted)' }}>
                  {v.icon}{v.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => { setScoreMin(0); setFilter('all'); setShowFilters(false); }} style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 9, border: 'none', background: 'var(--body-bg)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
            Réinitialiser
          </button>
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 12, background: 'var(--color-primary)', marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{selected.size} sélectionné{selected.size > 1 ? 's' : ''}</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => { selected.forEach(id => markReadMutation.mutate(id)); setSelected(new Set()); }} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,.3)', background: 'transparent', color: '#fff', fontSize: 12, cursor: 'pointer' }}>Marquer lus</button>
          <button onClick={() => { selected.forEach(id => dismissMutation.mutate(id)); setSelected(new Set()); toast.success('Signaux ignorés'); }} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,.3)', background: 'transparent', color: '#fff', fontSize: 12, cursor: 'pointer' }}>Ignorer</button>
          <button onClick={() => setSelected(new Set())} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.7)', display: 'flex' }}><X size={14} /></button>
        </div>
      )}

      {/* Signal list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(signal => {
          const tc = TYPE_CONFIG[signal.type] ?? TYPE_CONFIG.news;
          const sc = scoreColor(signal.score);
          const isExpanded = expandedId === signal.id;

          return (
            <div key={signal.id}
              onClick={() => { setExpandedId(isExpanded ? null : signal.id); if (!signal.isRead) markReadMutation.mutate(signal.id); }}
              style={{ borderRadius: 14, border: `1.5px solid ${isExpanded ? 'var(--color-primary)' : signal.isRead ? 'var(--card-border)' : '#A5B4FC'}`, background: signal.isRead ? 'var(--card-bg)' : 'linear-gradient(135deg, var(--card-bg) 0%, #EEF2FF 100%)', cursor: 'pointer', transition: 'all .15s' }}>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                {/* Checkbox */}
                <input type="checkbox" checked={selected.has(signal.id)} onChange={() => toggleSelect(signal.id)}
                  onClick={e => e.stopPropagation()} style={{ width: 15, height: 15, accentColor: 'var(--color-primary)', flexShrink: 0 }} />

                {/* Score badge */}
                <div style={{ width: 46, height: 46, borderRadius: 12, background: sc.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 900, color: sc.text, lineHeight: 1 }}>{signal.score}</span>
                  <div style={{ display: 'flex', alignItems: 'center', color: sc.text }}>{sc.icon}</div>
                </div>

                {/* Type badge + company */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, background: tc.bg, color: tc.color, fontSize: 10, fontWeight: 700 }}>
                      {tc.icon}{tc.label}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: signal.isRead ? 600 : 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {signal.company}
                    </span>
                    {!signal.isRead && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366F1', flexShrink: 0 }} />}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: signal.isRead ? 400 : 600 }}>
                    {signal.title}
                  </p>
                </div>

                {/* Meta + Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{timeAgo(signal.detectedAt)}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={e => { e.stopPropagation(); addProspectMutation.mutate(signal); }} title="Ajouter en prospect"
                      style={{ padding: 6, borderRadius: 8, background: 'var(--body-bg)', border: '1px solid var(--card-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>
                      <UserPlus size={12} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); navigate(`/ai-sdr?company=${encodeURIComponent(signal.company)}`); }} title="Rédiger message"
                      style={{ padding: 6, borderRadius: 8, background: 'var(--body-bg)', border: '1px solid var(--card-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>
                      <Mail size={12} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); starMutation.mutate({ id: signal.id, isStarred: !signal.isStarred }); }} title="Favori"
                      style={{ padding: 6, borderRadius: 8, background: 'var(--body-bg)', border: '1px solid var(--card-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', color: signal.isStarred ? '#F59E0B' : 'var(--text-muted)' }}>
                      <Star size={12} fill={signal.isStarred ? '#F59E0B' : 'none'} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); dismissMutation.mutate(signal.id); toast.success('Signal ignoré'); }} title="Ignorer"
                      style={{ padding: 6, borderRadius: 8, background: 'var(--body-bg)', border: '1px solid var(--card-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#EF4444' }}>
                      <X size={12} />
                    </button>
                    <ChevronDown size={14} style={{ color: 'var(--text-muted)', transition: 'transform .2s', transform: isExpanded ? 'rotate(180deg)' : 'none', alignSelf: 'center' }} />
                  </div>
                </div>
              </div>

              {/* Expanded body */}
              {isExpanded && (
                <div style={{ padding: '0 16px 14px 16px', borderTop: '1px solid var(--card-border)' }}>
                  {signal.description && (
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 12, marginTop: 12 }}>{signal.description}</p>
                  )}
                  {signal.tags && signal.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                      {signal.tags.map((tag: string) => (
                        <span key={tag} style={{ padding: '2px 8px', borderRadius: 20, background: '#EDE9FE', color: '#7C3AED', fontSize: 10, fontWeight: 700 }}>{tag}</span>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={e => { e.stopPropagation(); addProspectMutation.mutate(signal); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      <UserPlus size={12} />Ajouter en prospect
                    </button>
                    <button onClick={e => { e.stopPropagation(); navigate(`/ai-sdr?company=${encodeURIComponent(signal.company)}`); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      <Mail size={12} />Rédiger message
                    </button>
                    <button onClick={e => { e.stopPropagation(); navigate(`/signals/${signal.id}`); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Voir détail →
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <Zap size={40} style={{ margin: '0 auto 12px', color: 'var(--card-border)', display: 'block' }} />
            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              {rawSignals.length === 0 ? 'Aucun signal détecté — lancez le seeding pour commencer' : 'Aucun signal correspondant aux filtres'}
            </p>
            <button onClick={() => { setFilter('all'); setScoreMin(0); }} style={{ marginTop: 10, padding: '7px 16px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
              Réinitialiser les filtres
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
