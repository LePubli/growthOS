import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import {
  Plus, DollarSign, TrendingUp, Trophy, Search, X, Mail, Phone,
  Edit2, ChevronDown, SlidersHorizontal, Calendar, Target, BarChart2,
  ArrowUpRight, Loader2,
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

/* ─────────────── types & data ─────────────── */

const STAGES = [
  { id: 'lead',        label: 'Lead',        color: '#6B7280', prob: 10  },
  { id: 'qualified',   label: 'Qualifié',    color: '#3B82F6', prob: 25  },
  { id: 'proposal',    label: 'Proposition', color: '#8B5CF6', prob: 50  },
  { id: 'negotiation', label: 'Négociation', color: '#F59E0B', prob: 75  },
  { id: 'won',         label: 'Gagné',       color: '#10B981', prob: 100 },
  { id: 'lost',        label: 'Perdu',       color: '#EF4444', prob: 0   },
];

interface Deal {
  id: string; title: string; company: string; value: number;
  stage: string; probability: number; closeDate: string; prospect: string;
  notes?: string; priority?: 'high' | 'medium' | 'low';
}


const PRIORITY_CONFIG = {
  high:   { l:'Haute',  c:'#DC2626', bg:'#FEF2F2' },
  medium: { l:'Moyenne',c:'#D97706', bg:'#FFFBEB' },
  low:    { l:'Basse',  c:'#6B7280', bg:'#F3F4F6' },
};

function computeHealthScore(deal: Deal): { score: number; color: string; label: string } {
  if (deal.stage === 'won')  return { score: 100, color: '#10B981', label: 'Gagné' };
  if (deal.stage === 'lost') return { score: 0,   color: '#EF4444', label: 'Perdu' };
  const stageScore: Record<string, number> = { lead:15, qualified:35, proposal:55, negotiation:75 };
  const base = stageScore[deal.stage] ?? 30;
  let closeDateScore = 50;
  if (deal.closeDate) {
    const d = Math.ceil((new Date(deal.closeDate).getTime() - Date.now()) / 86400000);
    closeDateScore = d < 0 ? 10 : d < 7 ? 30 : d < 15 ? 55 : d < 30 ? 75 : 90;
  }
  const prioBonus = deal.priority === 'high' ? 10 : deal.priority === 'low' ? -5 : 0;
  const raw = Math.round(base * 0.4 + closeDateScore * 0.3 + deal.probability * 0.3 + prioBonus);
  const score = Math.max(0, Math.min(100, raw));
  return { score, color: score >= 70 ? '#10B981' : score >= 40 ? '#F59E0B' : '#EF4444', label: score >= 70 ? 'Bon' : score >= 40 ? 'Moyen' : 'Faible' };
}

/* ─────────────── new deal modal ─────────────── */

function NewDealModal({ onClose, onSave }: { onClose:()=>void; onSave:(d:Deal)=>void }) {
  const [form, setForm] = useState({ title:'', company:'', value:'', stage:'lead', probability:'20', closeDate:'', prospect:'', priority:'medium' });
  const [saving, setSaving] = useState(false);
  const set = (k:string,v:string) => setForm(f=>({...f,[k]:v}));
  const save = async () => {
    if (!form.title || !form.company) { toast.error('Titre et entreprise requis'); return; }
    setSaving(true);
    try {
      const deal = await apiClient.post('/pipeline', {
        title: form.title,
        company: form.company,
        prospect: form.prospect || undefined,
        value: Number(form.value) || 0,
        stage: form.stage,
        probability: Number(form.probability) || 20,
        closeDate: form.closeDate || undefined,
        priority: form.priority,
      }) as any;
      onSave(deal as Deal);
      onClose();
      toast.success('Deal créé ✓');
    } catch (e: any) {
      toast.error(e?.error || 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={onClose}>
      <div style={{ background:'var(--card-bg)', borderRadius:20, padding:24, width:'100%', maxWidth:500, boxShadow:'0 20px 60px rgba(0,0,0,.2)' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h2 style={{ fontSize:17, fontWeight:700, color:'var(--text-primary)', margin:0 }}>Nouveau deal</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex' }}><X size={18}/></button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
          {[
            { k:'title',    l:'Titre *',         col:'1/-1' },
            { k:'company',  l:'Entreprise *',    col:'' },
            { k:'prospect', l:'Contact',         col:'' },
            { k:'value',    l:'Valeur (€)',      col:'' },
            { k:'probability',l:'Probabilité %', col:'' },
            { k:'closeDate',l:'Date closing',    col:'',   type:'date' },
          ].map(f => (
            <div key={f.k} style={{ gridColumn:f.col||undefined }}>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:4 }}>{f.l}</label>
              <input type={f.type||'text'} value={(form as any)[f.k]} onChange={e=>set(f.k,e.target.value)}
                style={{ width:'100%', padding:'8px 12px', border:'1px solid var(--card-border)', borderRadius:10, fontSize:13, background:'var(--body-bg)', color:'var(--text-primary)', outline:'none', boxSizing:'border-box' }} />
            </div>
          ))}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:4 }}>Étape</label>
            <select value={form.stage} onChange={e=>set('stage',e.target.value)} style={{ width:'100%', padding:'8px 12px', border:'1px solid var(--card-border)', borderRadius:10, fontSize:13, background:'var(--body-bg)', color:'var(--text-primary)', outline:'none' }}>
              {STAGES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:4 }}>Priorité</label>
            <select value={form.priority} onChange={e=>set('priority',e.target.value)} style={{ width:'100%', padding:'8px 12px', border:'1px solid var(--card-border)', borderRadius:10, fontSize:13, background:'var(--body-bg)', color:'var(--text-primary)', outline:'none' }}>
              <option value="high">🔴 Haute</option>
              <option value="medium">🟡 Moyenne</option>
              <option value="low">⚪ Basse</option>
            </select>
          </div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ flex:1, padding:11, borderRadius:12, border:'1px solid var(--card-border)', background:'transparent', color:'var(--text-secondary)', fontSize:14, cursor:'pointer' }}>Annuler</button>
          <button onClick={save} disabled={saving} style={{ flex:2, padding:11, borderRadius:12, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:14, fontWeight:700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
            {saving ? '⏳ Création…' : 'Créer le deal'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── kanban card ─────────────── */

function KanbanCard({ deal, stage, onDragStart, onClick, onQuickAction }: {
  deal: Deal; stage: typeof STAGES[0]; onDragStart:(e:React.DragEvent,id:string)=>void;
  onClick:()=>void; onQuickAction:(action:string,deal:Deal)=>void;
}) {
  const [hover, setHover] = useState(false);
  const daysLeft = deal.closeDate ? Math.ceil((new Date(deal.closeDate).getTime() - Date.now()) / 86400000) : null;
  const prio = deal.priority ? PRIORITY_CONFIG[deal.priority] : null;
  const weighted = Math.round(deal.value * deal.probability / 100);
  return (
    <div draggable onDragStart={e=>onDragStart(e,deal.id)}
      onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      style={{ padding:'12px 14px', borderRadius:12, background:'var(--card-bg)', border:`1.5px solid ${hover?stage.color:'var(--card-border)'}`, cursor:'grab', transition:'all .15s', userSelect:'none', boxShadow:hover?`0 4px 16px ${stage.color}20`:undefined }}>
      {/* Priority + title */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:6, marginBottom:6 }}>
        {prio && <div style={{ width:8, height:8, borderRadius:'50%', background:prio.c, marginTop:4, flexShrink:0 }} />}
        <div style={{ fontWeight:600, fontSize:13, color:'var(--text-primary)', lineHeight:1.35 }}>{deal.title}</div>
      </div>
      <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:10 }}>{deal.company}</div>

      {/* Value row + health score */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <span style={{ fontWeight:800, fontSize:15, color:stage.color }}>{deal.value.toLocaleString('fr-FR')}€</span>
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          {(()=>{ const h=computeHealthScore(deal); return (
            <span title={`Score santé : ${h.score}/100 — ${h.label}`}
              style={{ fontSize:10, padding:'2px 7px', borderRadius:9999, background:`${h.color}18`, color:h.color, fontWeight:700, cursor:'help' }}>
              ♥ {h.score}
            </span>
          );})()}
          <span style={{ fontSize:11, padding:'2px 8px', borderRadius:9999, background:`${stage.color}18`, color:stage.color, fontWeight:700 }}>{deal.probability}%</span>
        </div>
      </div>

      {/* Meta */}
      <div style={{ display:'flex', gap:10, fontSize:11, color:'var(--text-muted)', marginBottom:hover?10:0 }}>
        {daysLeft !== null && (
          <span style={{ color:daysLeft<7?'#DC2626':daysLeft<14?'#D97706':'var(--text-muted)', fontWeight:daysLeft<7?700:400 }}>
            <Calendar size={10} style={{ display:'inline', marginRight:3 }} />
            {daysLeft<0?'Dépassé':daysLeft===0?'Aujourd\'hui':`J-${daysLeft}`}
          </span>
        )}
        <span>≈{weighted.toLocaleString()}€</span>
      </div>

      {/* Quick actions on hover */}
      {hover && (
        <div style={{ display:'flex', gap:6, paddingTop:10, borderTop:'1px solid var(--card-border)' }}>
          <button onClick={e=>{e.stopPropagation();onQuickAction('email',deal);}} title="Email"
            style={{ flex:1, padding:'4px 0', borderRadius:7, border:'none', background:'#EFF6FF', color:'#2563EB', cursor:'pointer', fontSize:11, display:'flex', alignItems:'center', justifyContent:'center', gap:3 }}>
            <Mail size={10}/>Email
          </button>
          <button onClick={e=>{e.stopPropagation();onQuickAction('call',deal);}} title="Appel"
            style={{ flex:1, padding:'4px 0', borderRadius:7, border:'none', background:'#ECFDF5', color:'#059669', cursor:'pointer', fontSize:11, display:'flex', alignItems:'center', justifyContent:'center', gap:3 }}>
            <Phone size={10}/>Appel
          </button>
          <button onClick={e=>{e.stopPropagation();onClick();}} title="Ouvrir"
            style={{ flex:1, padding:'4px 0', borderRadius:7, border:'none', background:'var(--body-bg)', color:'var(--text-secondary)', cursor:'pointer', fontSize:11, display:'flex', alignItems:'center', justifyContent:'center', gap:3 }}>
            <ArrowUpRight size={10}/>Ouvrir
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────── main ─────────────── */

export default function PipelinePage() {
  const [, navigate] = useLocation();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [view, setView] = useState<'kanban'|'list'|'forecast'>('kanban');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [dragOver, setDragOver] = useState<string|null>(null);
  const [minValue, setMinValue] = useState(0);
  const draggingId = useRef<string|null>(null);

  useEffect(() => {
    apiClient.get('/pipeline').then((d:any)=>{ const l=Array.isArray(d)?d:d?.data||[]; setDeals(l); }).catch(()=>{});
    const onNouveau = () => setShowModal(true);
    window.addEventListener('growthos:nouveau', onNouveau);
    return () => window.removeEventListener('growthos:nouveau', onNouveau);
  }, []);

  const onDragStart = (e:React.DragEvent, id:string) => { draggingId.current=id; e.dataTransfer.effectAllowed='move'; };
  const onDrop = (e:React.DragEvent, stageId:string) => {
    e.preventDefault();
    const id = draggingId.current; if (!id) return;
    setDeals(ds=>ds.map(d=>d.id===id?{...d,stage:stageId}:d));
    apiClient.patch(`/pipeline/${id}`,{stage:stageId}).catch(()=>{});
    toast.success(`Deal déplacé vers "${STAGES.find(s=>s.id===stageId)?.label}"`);
    draggingId.current=null; setDragOver(null);
  };

  const quickAction = (action:string, deal:Deal) => {
    if (action==='email') toast.success(`Email en cours pour ${deal.company}`);
    if (action==='call') toast.success(`Appel en cours pour ${deal.company}`);
  };

  const filtered = deals.filter(d => {
    if (search && !`${d.title} ${d.company} ${d.prospect}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (stageFilter!=='all' && d.stage!==stageFilter) return false;
    if (priorityFilter!=='all' && d.priority!==priorityFilter) return false;
    if (d.value < minValue) return false;
    return true;
  });

  const active = deals.filter(d=>d.stage!=='won'&&d.stage!=='lost');
  const totalPipeline = active.reduce((s,d)=>s+d.value,0);
  const totalWon = deals.filter(d=>d.stage==='won').reduce((s,d)=>s+d.value,0);
  const weighted = active.reduce((s,d)=>s+(d.value*d.probability/100),0);
  const avgProbability = active.length>0 ? Math.round(active.reduce((s,d)=>s+d.probability,0)/active.length) : 0;

  return (
    <div style={{ minHeight:'100vh', padding:'20px 24px', background:'var(--body-bg)' }}>
      {showModal && <NewDealModal onClose={()=>setShowModal(false)} onSave={d=>setDeals(ds=>[...ds,d])} />}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text-primary)', margin:'0 0 2px' }}>Pipeline Commercial</h1>
          <p style={{ fontSize:13, color:'var(--text-muted)', margin:0 }}>{active.length} deals actifs · {deals.filter(d=>d.stage==='won').length} gagnés</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <div style={{ display:'flex', gap:1, padding:3, borderRadius:12, background:'var(--card-bg)', border:'1px solid var(--card-border)' }}>
            {([['kanban','📋 Kanban'],['list','📄 Liste'],['forecast','📈 Forecast']] as const).map(([v,l])=>(
              <button key={v} onClick={()=>setView(v)} style={{ padding:'6px 12px', borderRadius:9, fontSize:12, fontWeight:600, border:'none', cursor:'pointer', background:view===v?'var(--color-primary)':'transparent', color:view===v?'#fff':'var(--text-muted)' }}>{l}</button>
            ))}
          </div>
          <button onClick={()=>setShowFilters(v=>!v)} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:10, border:`1px solid ${showFilters?'var(--color-primary)':'var(--card-border)'}`, background:showFilters?'var(--color-primary)':'var(--card-bg)', color:showFilters?'#fff':'var(--text-secondary)', fontSize:13, cursor:'pointer', fontWeight:600 }}>
            <SlidersHorizontal size={13}/>Filtres
          </button>
          <button onClick={()=>setShowModal(true)} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
            <Plus size={14}/>Nouveau deal
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:18 }}>
        {[
          { l:'Pipeline total',  v:`${(totalPipeline/1000).toFixed(0)}k€`, icon:<DollarSign size={17}/>, c:'#2563EB', bg:'#EFF6FF' },
          { l:'CA gagné',        v:`${(totalWon/1000).toFixed(0)}k€`,      icon:<Trophy size={17}/>,     c:'#059669', bg:'#ECFDF5' },
          { l:'Pondéré',         v:`${(weighted/1000).toFixed(0)}k€`,       icon:<TrendingUp size={17}/>, c:'#7C3AED', bg:'#F5F3FF' },
          { l:'Proba. moyenne',  v:`${avgProbability}%`,                    icon:<Target size={17}/>,     c:'#D97706', bg:'#FFFBEB' },
        ].map((m,i)=>(
          <div key={i} style={{ borderRadius:14, border:'1px solid var(--card-border)', background:'var(--card-bg)', padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:38, height:38, borderRadius:10, background:m.bg, display:'flex', alignItems:'center', justifyContent:'center', color:m.c, flexShrink:0 }}>{m.icon}</div>
            <div>
              <div style={{ fontSize:20, fontWeight:800, color:'var(--text-primary)' }}>{m.v}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>{m.l}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + filters */}
      <div style={{ display:'flex', gap:10, marginBottom:showFilters?0:16, alignItems:'center' }}>
        <div style={{ position:'relative', flex:1 }}>
          <Search size={13} style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un deal, entreprise…"
            style={{ width:'100%', paddingLeft:34, paddingRight:12, paddingTop:9, paddingBottom:9, borderRadius:11, border:'1px solid var(--card-border)', background:'var(--card-bg)', color:'var(--text-primary)', fontSize:13, outline:'none', boxSizing:'border-box' }}/>
        </div>
      </div>

      {showFilters && (
        <div style={{ display:'flex', gap:16, alignItems:'center', flexWrap:'wrap', padding:'14px 16px', borderRadius:12, border:'1px solid var(--card-border)', background:'var(--card-bg)', marginBottom:14 }}>
          <div>
            <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Étape</label>
            <div style={{ display:'flex', gap:4 }}>
              {([{id:'all',label:'Tous',color:'',prob:0},...STAGES]).map(s=>(
                <button key={s.id} onClick={()=>setStageFilter(s.id)}
                  style={{ padding:'4px 10px', borderRadius:9, border:'none', fontSize:11, fontWeight:600, cursor:'pointer', background:stageFilter===s.id?'var(--color-primary)':'var(--body-bg)', color:stageFilter===s.id?'#fff':'var(--text-muted)' }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Priorité</label>
            <div style={{ display:'flex', gap:4 }}>
              {[{v:'all',l:'Tous'},{v:'high',l:'Haute'},{v:'medium',l:'Moyenne'},{v:'low',l:'Basse'}].map(p=>(
                <button key={p.v} onClick={()=>setPriorityFilter(p.v)}
                  style={{ padding:'4px 10px', borderRadius:9, border:'none', fontSize:11, fontWeight:600, cursor:'pointer', background:priorityFilter===p.v?'var(--color-primary)':'var(--body-bg)', color:priorityFilter===p.v?'#fff':'var(--text-muted)' }}>
                  {p.l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Valeur min : <strong style={{ color:'var(--color-primary)' }}>{minValue.toLocaleString()}€</strong></label>
            <input type="range" min={0} max={20000} step={500} value={minValue} onChange={e=>setMinValue(+e.target.value)} style={{ width:140, accentColor:'var(--color-primary)' }}/>
          </div>
          <button onClick={()=>{setStageFilter('all');setPriorityFilter('all');setMinValue(0);setShowFilters(false);}} style={{ marginLeft:'auto', padding:'6px 12px', borderRadius:9, border:'none', background:'var(--body-bg)', color:'var(--text-muted)', fontSize:12, cursor:'pointer' }}>
            Réinitialiser
          </button>
        </div>
      )}

      {/* ── KANBAN ── */}
      {view==='kanban' && (
        <div style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:16 }}>
          {STAGES.map(stage=>{
            const stageDeals = filtered.filter(d=>d.stage===stage.id);
            const stageTotal = stageDeals.reduce((s,d)=>s+d.value,0);
            const stageWeighted = stageDeals.reduce((s,d)=>s+(d.value*d.probability/100),0);
            const isOver = dragOver===stage.id;
            return (
              <div key={stage.id} style={{ minWidth:220, flex:'0 0 220px', display:'flex', flexDirection:'column', gap:0 }}
                onDragOver={e=>{e.preventDefault();setDragOver(stage.id);}}
                onDragLeave={()=>setDragOver(null)}
                onDrop={e=>onDrop(e,stage.id)}>
                {/* Column header */}
                <div style={{ padding:'10px 12px', borderRadius:'12px 12px 0 0', background:isOver?`${stage.color}15`:'var(--card-bg)', border:`1.5px solid ${isOver?stage.color:'var(--card-border)'}`, borderBottom:'none', marginBottom:0, transition:'all .15s' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                      <div style={{ width:9, height:9, borderRadius:'50%', background:stage.color }}/>
                      <span style={{ fontSize:12, fontWeight:800, color:stage.color }}>{stage.label}</span>
                    </div>
                    <span style={{ fontSize:12, fontWeight:700, padding:'2px 8px', borderRadius:9999, background:`${stage.color}18`, color:stage.color }}>{stageDeals.length}</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-muted)' }}>
                    <span>{stageTotal.toLocaleString('fr-FR')}€</span>
                    <span>≈{Math.round(stageWeighted/1000)}k pondéré</span>
                  </div>
                </div>
                {/* Cards */}
                <div style={{ display:'flex', flexDirection:'column', gap:7, minHeight:100, borderLeft:`1.5px solid ${isOver?stage.color:'var(--card-border)'}`, borderRight:`1.5px solid ${isOver?stage.color:'var(--card-border)'}`, borderBottom:`1.5px solid ${isOver?stage.color:'var(--card-border)'}`, borderRadius:'0 0 12px 12px', padding:'8px', background:isOver?`${stage.color}06`:'transparent', transition:'all .15s' }}>
                  {stageDeals.map(deal=>(
                    <KanbanCard key={deal.id} deal={deal} stage={stage} onDragStart={onDragStart} onClick={()=>navigate(`/pipeline/${deal.id}`)} onQuickAction={quickAction}/>
                  ))}
                  {isOver && <div style={{ height:60, borderRadius:10, border:`2px dashed ${stage.color}`, opacity:.4 }}/>}
                  {stageDeals.length===0 && !isOver && (
                    <div style={{ textAlign:'center', padding:'24px 0', color:'var(--card-border)', fontSize:12 }}>Déposer ici</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── LIST ── */}
      {view==='list' && (
        <div style={{ background:'var(--card-bg)', borderRadius:16, border:'1px solid var(--card-border)', overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 1fr', gap:12, padding:'10px 16px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em', color:'var(--text-muted)', borderBottom:'1px solid var(--card-border)', background:'var(--body-bg)' }}>
            <span>Deal</span><span>Étape</span><span>Valeur</span><span>Proba</span><span>Closing</span><span>Priorité</span>
          </div>
          {filtered.map(deal=>{
            const stage = STAGES.find(s=>s.id===deal.stage)||STAGES[0];
            const prio = deal.priority ? PRIORITY_CONFIG[deal.priority] : null;
            const daysLeft = deal.closeDate ? Math.ceil((new Date(deal.closeDate).getTime()-Date.now())/86400000) : null;
            return (
              <div key={deal.id} onClick={()=>navigate(`/pipeline/${deal.id}`)}
                style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 1fr', gap:12, alignItems:'center', padding:'13px 16px', borderBottom:'1px solid var(--card-border)', cursor:'pointer', transition:'background .1s' }}
                onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='var(--body-bg)'}
                onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                <div>
                  <div style={{ fontWeight:600, fontSize:13, color:'var(--text-primary)' }}>{deal.title}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)' }}>{deal.company} · {deal.prospect}</div>
                </div>
                <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:9999, color:stage.color, background:`${stage.color}18`, whiteSpace:'nowrap', width:'fit-content' }}>{stage.label}</span>
                <span style={{ fontWeight:700, fontSize:14, color:'var(--color-primary)' }}>{deal.value.toLocaleString('fr-FR')}€</span>
                <span style={{ fontSize:13, color:'var(--text-muted)' }}>{deal.probability}%</span>
                <span style={{ fontSize:12, color:daysLeft!==null&&daysLeft<7?'#DC2626':daysLeft!==null&&daysLeft<14?'#D97706':'var(--text-muted)' }}>
                  {daysLeft===null?'—':daysLeft<0?'Dépassé':daysLeft===0?'Aujourd\'hui':`J-${daysLeft}`}
                </span>
                {prio ? <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:9999, background:prio.bg, color:prio.c, width:'fit-content' }}>{prio.l}</span> : <span>—</span>}
              </div>
            );
          })}
          {filtered.length===0 && <div style={{ textAlign:'center', padding:'48px 0', color:'var(--text-muted)', fontSize:14 }}>Aucun deal trouvé</div>}
        </div>
      )}

      {/* ── FORECAST ── */}
      {view==='forecast' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ borderRadius:16, border:'1px solid var(--card-border)', background:'var(--card-bg)', padding:20 }}>
            <h2 style={{ fontWeight:700, fontSize:14, color:'var(--text-primary)', marginBottom:14 }}>Forecast par étape</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {STAGES.filter(s=>!['lost'].includes(s.id)).map(stage=>{
                const sd = deals.filter(d=>d.stage===stage.id);
                const total = sd.reduce((s,d)=>s+d.value,0);
                const w = sd.reduce((s,d)=>s+(d.value*d.probability/100),0);
                const pct = totalPipeline>0 ? total/totalPipeline*100 : 0;
                return (
                  <div key={stage.id}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:10, height:10, borderRadius:3, background:stage.color }}/>
                        <span style={{ fontSize:13, color:'var(--text-secondary)', fontWeight:600 }}>{stage.label}</span>
                        <span style={{ fontSize:11, color:'var(--text-muted)' }}>{sd.length} deals</span>
                      </div>
                      <div style={{ display:'flex', gap:16 }}>
                        <span style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>{total.toLocaleString('fr-FR')}€</span>
                        <span style={{ fontSize:12, color:'var(--text-muted)' }}>≈{Math.round(w/1000)}k€ pondéré</span>
                        <span style={{ fontSize:12, color:'var(--text-muted)', minWidth:36, textAlign:'right' }}>{Math.round(pct)}%</span>
                      </div>
                    </div>
                    <div style={{ height:10, borderRadius:9999, background:'var(--body-bg)', overflow:'hidden' }}>
                      <div style={{ height:'100%', borderRadius:9999, background:stage.color, width:`${pct}%`, transition:'width .5s' }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
            {[
              { l:'Deals cette semaine', v:deals.filter(d=>{ const dt=new Date(d.closeDate); const now=new Date(); return dt>=now && dt<=new Date(now.getTime()+7*86400000); }).length, c:'#DC2626', bg:'#FEF2F2' },
              { l:'Deals ce mois',       v:deals.filter(d=>{ const dt=new Date(d.closeDate); const now=new Date(); return dt.getMonth()===now.getMonth()&&dt.getFullYear()===now.getFullYear(); }).length, c:'#D97706', bg:'#FFFBEB' },
              { l:'Forecast 90j',        v:`${(deals.filter(d=>d.stage!=='lost'&&d.stage!=='won').reduce((s,d)=>s+(d.value*d.probability/100),0)/1000).toFixed(0)}k€`, c:'#059669', bg:'#ECFDF5' },
            ].map(m=>(
              <div key={m.l} style={{ borderRadius:14, border:'1px solid var(--card-border)', background:'var(--card-bg)', padding:'16px 20px', display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:42, height:42, borderRadius:11, background:m.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:800, color:m.c }}>{m.v}</div>
                <span style={{ fontSize:13, color:'var(--text-secondary)', fontWeight:500 }}>{m.l}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
