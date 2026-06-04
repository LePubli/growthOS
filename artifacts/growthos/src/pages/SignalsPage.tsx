import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import {
  Zap, Star, CheckCircle, RefreshCw, TrendingUp, Users, DollarSign,
  Newspaper, Cpu, Filter, X, UserPlus, Mail, Eye, EyeOff, Trash2,
  ChevronDown, SlidersHorizontal, Flame, Thermometer, Wind,
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

/* ─────────────── types & config ─────────────── */

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  funding:    { label:'Financement',  color:'#059669', bg:'#ECFDF5', icon:<DollarSign size={13}/> },
  hiring:     { label:'Recrutement',  color:'#2563EB', bg:'#EFF6FF', icon:<Users size={13}/> },
  news:       { label:'Actualité',    color:'#7C3AED', bg:'#F5F3FF', icon:<Newspaper size={13}/> },
  technology: { label:'Technologie',  color:'#D97706', bg:'#FFFBEB', icon:<Cpu size={13}/> },
  intent:     { label:'Intention',    color:'#DC2626', bg:'#FEF2F2', icon:<TrendingUp size={13}/> },
};

const MOCK_SIGNALS = [
  { id:'1', type:'funding',    company:'TechVision', domain:'techvision.io',   title:'Levée de fonds Série A — 5M€', body:'TechVision vient de boucler un tour de table Série A de 5M€ lead par Idinvest. Contexte idéal pour pitcher une solution growth.', score:92, isRead:false, isStarred:true,  isDismissed:false, source:'Crunchbase', createdAt:'il y a 5 min',   tags:['scale-up','fintech'] },
  { id:'2', type:'hiring',     company:'BigCorp',    domain:'bigcorp.com',     title:'Recrute 5 commerciaux B2B Senior', body:'BigCorp ouvre 5 postes de Business Developer, signal fort d\'expansion commerciale. Probablement à la recherche d\'outils de prospection.', score:78, isRead:false, isStarred:false, isDismissed:false, source:'LinkedIn',   createdAt:'il y a 30 min', tags:['enterprise','retail'] },
  { id:'3', type:'intent',     company:'StartupX',   domain:'startupx.fr',     title:'Visite répétée page pricing (×7 en 48h)', body:'7 visites sur votre page /pricing en moins de 48h. Score d\'intention maximal — contact à prioriser maintenant.', score:95, isRead:false, isStarred:true,  isDismissed:false, source:'Clearbit',   createdAt:'il y a 1h',     tags:['hot-lead','saas'] },
  { id:'4', type:'news',       company:'Acme Corp',  domain:'acme.fr',         title:'Acme Corp ouvre un bureau à Paris', body:'Acme Corp annonce l\'ouverture de son siège France à Paris La Défense. Recrutements en cours — décideurs accessibles.', score:65, isRead:true,  isStarred:false, isDismissed:false, source:'Societe.info', createdAt:'il y a 2h',   tags:['expansion','B2B'] },
  { id:'5', type:'technology', company:'GrowthCo',   domain:'growthco.io',     title:'Migration vers Salesforce CRM', body:'GrowthCo vient de déployer Salesforce Enterprise — implique une réorganisation commerciale potentiellement alignée avec notre offre.', score:71, isRead:false, isStarred:false, isDismissed:false, source:'BuiltWith',  createdAt:'il y a 3h',   tags:['tech-change','smb'] },
  { id:'6', type:'funding',    company:'Nexus AI',   domain:'nexus.ai',         title:'Seed Round — 2.4M€ levés', body:'Nexus AI boucle un seed de 2.4M€. Équipe technique forte, phase de go-to-market imminente.', score:83, isRead:true,  isStarred:false, isDismissed:false, source:'Maddyness',  createdAt:'il y a 5h',   tags:['ai','seed'] },
  { id:'7', type:'intent',     company:'DataPulse',  domain:'datapulse.com',   title:'Téléchargement whitepaper — 3 personnes', body:'3 membres de l\'équipe DataPulse ont téléchargé votre guide "Cold Outreach B2B" en moins de 24h.', score:88, isRead:false, isStarred:false, isDismissed:false, source:'HubSpot',    createdAt:'il y a 6h',   tags:['saas','mid-market'] },
  { id:'8', type:'hiring',     company:'Verilog SAS',domain:'verilog.fr',      title:'Recrute un VP Sales France', body:'Verilog cherche un VP Sales — signal de structuration commerciale forte. Idéal pour pitcher leur futur outil.', score:74, isRead:true,  isStarred:true,  isDismissed:false, source:'Welcome',    createdAt:'il y a 1j',   tags:['executive','industrie'] },
];

function scoreColor(s: number): { text: string; bg: string; label: string; icon: React.ReactNode } {
  if (s >= 85) return { text:'#059669', bg:'#ECFDF5', label:'Hot',  icon:<Flame size={11}/> };
  if (s >= 65) return { text:'#D97706', bg:'#FFFBEB', label:'Warm', icon:<Thermometer size={11}/> };
  return        { text:'#6B7280', bg:'#F3F4F6', label:'Cold', icon:<Wind size={11}/> };
}

/* ─────────────── main ─────────────── */
export default function SignalsPage() {
  const [, navigate] = useLocation();
  const [signals, setSignals] = useState(MOCK_SIGNALS);
  const [filter, setFilter] = useState('all');
  const [scoreMin, setScoreMin] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fetching, setFetching] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setFetching(true);
    apiClient.get('/signals').then((d: any) => {
      const l = Array.isArray(d) ? d : d?.data || [];
      if (l.length > 0) setSignals(l);
    }).catch(() => {}).finally(() => setFetching(false));
  }, []);

  const visible = signals.filter(s => !s.isDismissed);
  const unread = visible.filter(s => !s.isRead).length;
  const hot = visible.filter(s => s.score >= 85).length;
  const warm = visible.filter(s => s.score >= 65 && s.score < 85).length;
  const cold = visible.filter(s => s.score < 65).length;

  const filtered = visible.filter(s => {
    if (s.score < scoreMin) return false;
    if (filter === 'unread') return !s.isRead;
    if (filter === 'starred') return s.isStarred;
    if (filter === 'hot') return s.score >= 85;
    if (filter !== 'all') return s.type === filter;
    return true;
  });

  const markRead = (id: string) => {
    setSignals(ss => ss.map(s => s.id === id ? { ...s, isRead: true } : s));
    apiClient.post(`/signals/${id}/read`).catch(() => {});
  };
  const markAllRead = () => {
    const unread = signals.filter(s => !s.isRead);
    setSignals(ss => ss.map(s => ({ ...s, isRead: true })));
    toast.success('Tous les signaux marqués comme lus');
    unread.forEach(s => apiClient.post(`/signals/${s.id}/read`).catch(() => {}));
  };
  const toggleStar = (id: string, e: React.MouseEvent) => { e.stopPropagation(); setSignals(ss => ss.map(s => s.id === id ? { ...s, isStarred: !s.isStarred } : s)); };
  const dismiss = (id: string, e: React.MouseEvent) => { e.stopPropagation(); setSignals(ss => ss.map(s => s.id === id ? { ...s, isDismissed: true } : s)); toast.success('Signal ignoré'); };
  const addToProspects = (s: typeof MOCK_SIGNALS[0], e: React.MouseEvent) => { e.stopPropagation(); toast.success(`${s.company} ajouté aux prospects`); };
  const sendSequence = (s: typeof MOCK_SIGNALS[0], e: React.MouseEvent) => { e.stopPropagation(); toast.success(`Séquence lancée pour ${s.company}`); };

  const toggleSelect = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const bulkDismiss = () => { setSignals(ss => ss.map(s => selected.has(s.id) ? { ...s, isDismissed: true } : s)); toast.success(`${selected.size} signal(s) ignoré(s)`); setSelected(new Set()); };
  const bulkRead = () => { setSignals(ss => ss.map(s => selected.has(s.id) ? { ...s, isRead: true } : s)); setSelected(new Set()); };

  return (
    <div style={{ minHeight: '100vh', padding: 24, background: 'var(--body-bg)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px' }}>Signaux d'intention</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>{unread} non lu{unread > 1 ? 's' : ''} · {visible.length} signaux actifs</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowFilters(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--card-border)', background: showFilters ? 'var(--color-primary)' : 'var(--card-bg)', color: showFilters ? '#fff' : 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
            <SlidersHorizontal size={13} />Filtres
          </button>
          <button onClick={markAllRead} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
            <Eye size={13} />Tout lire
          </button>
          <button onClick={() => { setFetching(true); setTimeout(() => setFetching(false), 800); }} style={{ padding: 9, borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <RefreshCw size={14} className={fetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 18 }}>
        {[
          { l:'Hot (80+)',  v:hot,  color:'#DC2626', bg:'#FEF2F2', icon:<Flame size={14}/>,       k:'hot' },
          { l:'Warm (65+)', v:warm, color:'#D97706', bg:'#FFFBEB', icon:<Thermometer size={14}/>, k:'warm' },
          { l:'Cold (<65)', v:cold, color:'#6B7280', bg:'#F3F4F6', icon:<Wind size={14}/>,         k:'cold_only' },
          { l:'Non lus',   v:unread,color:'#2563EB', bg:'#EFF6FF', icon:<EyeOff size={14}/>,      k:'unread' },
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
            <div style={{ display: 'flex', gap: 4 }}>
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
          <button onClick={bulkRead} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,.3)', background: 'transparent', color: '#fff', fontSize: 12, cursor: 'pointer' }}>Marquer lus</button>
          <button onClick={bulkDismiss} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,.3)', background: 'transparent', color: '#fff', fontSize: 12, cursor: 'pointer' }}>Ignorer</button>
          <button onClick={() => setSelected(new Set())} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.7)', display: 'flex' }}><X size={14} /></button>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { k:'all', l:`Tous (${visible.length})` },
          { k:'starred', l:'⭐ Favoris' },
          ...Object.entries(TYPE_CONFIG).map(([k,v]) => ({ k, l:v.label })),
        ].map(f => (
          <button key={f.k} onClick={() => setFilter(f.k)}
            style={{ padding: '6px 12px', borderRadius: 10, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: filter === f.k ? 'var(--color-primary)' : 'var(--card-bg)', color: filter === f.k ? '#fff' : 'var(--text-secondary)', boxShadow: filter === f.k ? 'none' : '0 0 0 1px var(--card-border)' }}>
            {f.l}
          </button>
        ))}
      </div>

      {/* Signal list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(signal => {
          const type = TYPE_CONFIG[signal.type] || TYPE_CONFIG.news;
          const sc = scoreColor(signal.score);
          const isExpanded = expandedId === signal.id;
          const isSelected = selected.has(signal.id);

          return (
            <div key={signal.id}
              style={{ borderRadius: 14, border: `1.5px solid ${isSelected ? 'var(--color-primary)' : !signal.isRead ? 'var(--color-primary)' : 'var(--card-border)'}`, background: 'var(--card-bg)', overflow: 'hidden', transition: 'all .15s', opacity: signal.isRead && !isSelected ? 0.9 : 1 }}>
              {/* Main row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
                onClick={() => { markRead(signal.id); setExpandedId(isExpanded ? null : signal.id); }}>
                {/* Checkbox */}
                <div onClick={e => { e.stopPropagation(); toggleSelect(signal.id); }}
                  style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${isSelected ? 'var(--color-primary)' : 'var(--card-border)'}`, background: isSelected ? 'var(--color-primary)' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  {isSelected && <CheckCircle size={11} color="#fff" />}
                </div>

                {/* Type icon */}
                <div style={{ width: 36, height: 36, borderRadius: 10, background: type.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: type.color }}>
                  {type.icon}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{signal.company}</span>
                    <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 9999, background: type.bg, color: type.color, fontWeight: 700 }}>{type.label}</span>
                    {!signal.isRead && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0 }} />}
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{signal.title}</p>
                  <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{signal.createdAt}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>via {signal.source}</span>
                    {signal.tags?.map(t => <span key={t} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 9999, background: 'var(--body-bg)', color: 'var(--text-muted)' }}>#{t}</span>)}
                  </div>
                </div>

                {/* Score */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 9999, background: sc.bg, flexShrink: 0 }}>
                  <span style={{ color: sc.text, display: 'flex' }}>{sc.icon}</span>
                  <span style={{ fontWeight: 800, fontSize: 14, color: sc.text }}>{signal.score}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: sc.text }}>{sc.label}</span>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button onClick={e => addToProspects(signal, e)} title="Ajouter en prospect"
                    style={{ padding: 6, borderRadius: 8, background: 'var(--body-bg)', border: '1px solid var(--card-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>
                    <UserPlus size={12} />
                  </button>
                  <button onClick={e => sendSequence(signal, e)} title="Envoyer une séquence"
                    style={{ padding: 6, borderRadius: 8, background: 'var(--body-bg)', border: '1px solid var(--card-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>
                    <Mail size={12} />
                  </button>
                  <button onClick={e => toggleStar(signal.id, e)} title="Favori"
                    style={{ padding: 6, borderRadius: 8, background: 'var(--body-bg)', border: '1px solid var(--card-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', color: signal.isStarred ? '#F59E0B' : 'var(--text-muted)' }}>
                    <Star size={12} fill={signal.isStarred ? '#F59E0B' : 'none'} />
                  </button>
                  <button onClick={e => dismiss(signal.id, e)} title="Ignorer"
                    style={{ padding: 6, borderRadius: 8, background: 'var(--body-bg)', border: '1px solid var(--card-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#EF4444' }}>
                    <X size={12} />
                  </button>
                  <ChevronDown size={14} style={{ color: 'var(--text-muted)', transition: 'transform .2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }} />
                </div>
              </div>

              {/* Expanded body */}
              {isExpanded && (
                <div style={{ padding: '0 16px 14px 16px', borderTop: '1px solid var(--card-border)' }}>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 12, marginTop: 12 }}>{signal.body}</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={e => addToProspects(signal, e)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      <UserPlus size={12} />Ajouter en prospect
                    </button>
                    <button onClick={e => sendSequence(signal, e)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      <Mail size={12} />Lancer séquence
                    </button>
                    <button onClick={() => navigate(`/signals/${signal.id}`)}
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
            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Aucun signal correspondant aux filtres</p>
            <button onClick={() => { setFilter('all'); setScoreMin(0); }} style={{ marginTop: 10, padding: '7px 16px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
              Réinitialiser les filtres
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
