import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import {
  ArrowLeft, Edit2, Save, Loader2, Trash2, CheckCircle, Mail, Phone,
  Calendar, DollarSign, TrendingUp, Plus, X, Clock, User, FileText,
  Paperclip, MessageSquare, Zap, Target, ChevronDown,
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';
import { CommentsPanel } from '@/components/common/CommentsPanel';

/* ─────────────── config ─────────────── */

const STAGES = [
  { value:'lead',        label:'Lead',        color:'#6B7280', prob:10  },
  { value:'qualified',   label:'Qualifié',    color:'#2563EB', prob:25  },
  { value:'proposal',    label:'Proposition', color:'#7C3AED', prob:50  },
  { value:'negotiation', label:'Négociation', color:'#F59E0B', prob:75  },
  { value:'won',         label:'Gagné',       color:'#059669', prob:100 },
  { value:'lost',        label:'Perdu',       color:'#EF4444', prob:0   },
];

type Activity = { id:string; type:'email'|'call'|'meeting'|'note'|'task'; description:string; user:string; date:string; done?:boolean };

const ACTIVITY_CONFIG: Record<string,{icon:React.ReactNode;c:string;bg:string;label:string}> = {
  email:   { icon:<Mail size={12}/>,        c:'#2563EB', bg:'#EFF6FF', label:'Email' },
  call:    { icon:<Phone size={12}/>,       c:'#059669', bg:'#ECFDF5', label:'Appel' },
  meeting: { icon:<Calendar size={12}/>,    c:'#7C3AED', bg:'#F5F3FF', label:'Réunion' },
  note:    { icon:<FileText size={12}/>,    c:'#6B7280', bg:'#F3F4F6', label:'Note' },
  task:    { icon:<CheckCircle size={12}/>, c:'#D97706', bg:'#FFFBEB', label:'Tâche' },
};


/* ─────────────── add activity modal ─────────────── */
function AddActivityModal({ onClose, dealId, onSaved }: { onClose:()=>void; dealId:string; onSaved:()=>void }) {
  const [type, setType] = useState<Activity['type']>('email');
  const [desc, setDesc] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0,16));
  const [saving, setSaving] = useState(false);
  const add = async () => {
    if (!desc.trim()) { toast.error('Description requise'); return; }
    setSaving(true);
    try {
      await apiClient.post('/activities', { type, title: desc, dealId, scheduledAt: date, status:'done' });
      onSaved(); onClose(); toast.success('Activité ajoutée');
    } catch { toast.error('Erreur lors de la création'); }
    finally { setSaving(false); }
  };
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'var(--card-bg)', borderRadius:18, padding:22, width:'100%', maxWidth:420, boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <h2 style={{ fontWeight:700, fontSize:15, color:'var(--text-primary)', margin:0 }}>Ajouter une activité</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex' }}><X size={16}/></button>
        </div>
        <div style={{ display:'flex', gap:6, marginBottom:14 }}>
          {(Object.entries(ACTIVITY_CONFIG) as any[]).map(([k,v]:[string,any])=>(
            <button key={k} onClick={()=>setType(k as Activity['type'])}
              style={{ flex:1, padding:'7px 0', borderRadius:9, border:'none', fontSize:11, fontWeight:700, cursor:'pointer', background:type===k?v.bg:'var(--body-bg)', color:type===k?v.c:'var(--text-muted)', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
              {v.icon}{v.label}
            </button>
          ))}
        </div>
        <div style={{ marginBottom:12 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:4 }}>Description</label>
          <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={3} placeholder="Résumé de l'activité…"
            style={{ width:'100%', padding:'8px 12px', border:'1px solid var(--card-border)', borderRadius:10, fontSize:13, background:'var(--body-bg)', color:'var(--text-primary)', outline:'none', resize:'none', boxSizing:'border-box' }}/>
        </div>
        <div style={{ marginBottom:18 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:4 }}>Date</label>
          <input type="datetime-local" value={date} onChange={e=>setDate(e.target.value)}
            style={{ width:'100%', padding:'8px 12px', border:'1px solid var(--card-border)', borderRadius:10, fontSize:13, background:'var(--body-bg)', color:'var(--text-primary)', outline:'none', boxSizing:'border-box' }}/>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ flex:1, padding:10, borderRadius:11, border:'1px solid var(--card-border)', background:'transparent', color:'var(--text-secondary)', fontSize:13, cursor:'pointer' }}>Annuler</button>
          <button onClick={add} disabled={saving} style={{ flex:2, padding:10, borderRadius:11, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', opacity:saving?0.7:1 }}>
            {saving ? '…' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── main ─────────────── */
export default function DealDetailPage() {
  const params = useParams<{id:string}>();
  const [, navigate] = useLocation();
  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [activeTab, setActiveTab] = useState<'details'|'activities'|'comments'>('activities');

  const fetchActivities = async () => {
    try {
      const data = await apiClient.get('/activities', { params: { dealId: params.id } }) as any[];
      setActivities(Array.isArray(data) ? data.map(a => ({
        id: a.id, type: a.type, description: a.title || a.description || '',
        user: a.createdBy || '—', date: a.createdAt, done: a.status === 'done',
      })) : []);
    } catch {}
  };

  useEffect(()=>{
    apiClient.get(`/pipeline/${params.id}`)
      .then(d=>{ setDeal(d); setForm(d); })
      .catch(()=>{ toast.error('Deal introuvable'); navigate('/pipeline'); })
      .finally(()=>setLoading(false));
    fetchActivities();
  },[params.id]);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await apiClient.patch(`/pipeline/${params.id}`,{
        title:form.title, company:form.company, value:Number(form.value),
        stage:form.stage, probability:Number(form.probability), closeDate:form.closeDate,
        prospect:form.prospect, notes:form.notes,
      });
      setDeal(updated); setEditing(false); toast.success('Deal mis à jour');
    } catch { toast.error('Erreur'); }
    finally { setSaving(false); }
  };

  const deleteDeal = async () => {
    if (!confirm('Supprimer ce deal ?')) return;
    await apiClient.delete(`/pipeline/${params.id}`).catch(()=>{});
    toast.success('Deal supprimé'); navigate('/pipeline');
  };

  const sf = (k:string,v:string) => setForm((f:any)=>({...f,[k]:v}));

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', background:'var(--body-bg)' }}>
      <Loader2 size={28} className="animate-spin" style={{ color:'var(--color-primary)' }}/>
    </div>
  );
  if (!deal) return null;

  const stageInfo = STAGES.find(s=>s.value===deal.stage)||STAGES[0];
  const stageIdx  = STAGES.findIndex(s=>s.value===deal.stage);
  const weighted  = (Number(deal.value)||0) * (Number(deal.probability)||0) / 100;
  const daysLeft  = deal.closeDate ? Math.ceil((new Date(deal.closeDate).getTime()-Date.now())/86400000) : null;

  const upcoming = activities.filter(a=>!a.done);
  const past     = activities.filter(a=>a.done);

  return (
    <div style={{ minHeight:'100vh', padding:'20px 24px', background:'var(--body-bg)' }}>
      {showAddActivity && <AddActivityModal onClose={()=>setShowAddActivity(false)} dealId={params.id} onSaved={fetchActivities}/>}

      {/* Back + header */}
      <button onClick={()=>navigate('/pipeline')} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', color:'var(--text-muted)', fontSize:13, cursor:'pointer', marginBottom:16, padding:0 }}>
        <ArrowLeft size={14}/>Retour au pipeline
      </button>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'var(--text-primary)', margin:'0 0 5px' }}>{deal.title}</h1>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:13, fontWeight:700, color:stageInfo.color }}>{stageInfo.label}</span>
            {deal.company && <span style={{ fontSize:13, color:'var(--text-muted)' }}>· {deal.company}</span>}
            {daysLeft!==null && (
              <span style={{ fontSize:12, padding:'2px 8px', borderRadius:9999, background:daysLeft<7?'#FEF2F2':daysLeft<14?'#FFFBEB':'var(--body-bg)', color:daysLeft<7?'#DC2626':daysLeft<14?'#D97706':'var(--text-muted)', fontWeight:daysLeft<14?700:400 }}>
                {daysLeft<0?'Délai dépassé':daysLeft===0?'Clôture aujourd\'hui':`Clôture J-${daysLeft}`}
              </span>
            )}
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={deleteDeal} style={{ padding:'7px 10px', borderRadius:10, border:'1px solid var(--card-border)', background:'var(--body-bg)', color:'#EF4444', cursor:'pointer', display:'flex', alignItems:'center' }}><Trash2 size={14}/></button>
          {editing ? (
            <>
              <button onClick={()=>setEditing(false)} style={{ padding:'7px 14px', borderRadius:10, border:'1px solid var(--card-border)', background:'transparent', color:'var(--text-secondary)', fontSize:13, cursor:'pointer' }}>Annuler</button>
              <button onClick={save} disabled={saving} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 16px', borderRadius:10, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', opacity:saving?.7:1 }}>
                {saving?<Loader2 size={13} className="animate-spin"/>:<Save size={13}/>}Enregistrer
              </button>
            </>
          ) : (
            <button onClick={()=>setEditing(true)} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:10, border:'1px solid var(--card-border)', background:'var(--card-bg)', color:'var(--text-secondary)', fontSize:13, cursor:'pointer' }}>
              <Edit2 size={13}/>Modifier
            </button>
          )}
        </div>
      </div>

      {/* Stage progress */}
      <div style={{ borderRadius:16, border:'1px solid var(--card-border)', background:'var(--card-bg)', padding:18, marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:14 }}>
          {STAGES.filter(s=>s.value!=='lost').map((s,i)=>{
            const isActive = i<=stageIdx && deal.stage!=='lost';
            const isCurrent = s.value===deal.stage;
            return (
              <div key={s.value} style={{ display:'flex', alignItems:'center', flex:1 }}>
                <button onClick={()=>editing&&sf('stage',s.value)}
                  style={{ flex:1, padding:'8px 4px', borderRadius:10, border:'none', cursor:editing?'pointer':'default', fontSize:11, fontWeight:700, textAlign:'center', background:isCurrent?s.color:isActive?`${s.color}15`:'var(--body-bg)', color:isCurrent?'#fff':isActive?s.color:'var(--text-muted)', transition:'all .15s' }}>
                  {s.label}
                </button>
                {i<STAGES.length-2 && <div style={{ width:6, height:2, background:isActive?'var(--color-primary)':'var(--card-border)', flexShrink:0, margin:'0 1px' }}/>}
              </div>
            );
          })}
        </div>
        {deal.stage==='lost' && <div style={{ textAlign:'center', padding:'7px', borderRadius:10, fontSize:13, fontWeight:700, color:'#fff', background:'#EF4444', marginBottom:14 }}>❌ Deal perdu</div>}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
          {[
            { l:'Valeur',        v:`${Number(deal.value||0).toLocaleString('fr-FR')}€`, c:'var(--text-primary)' },
            { l:'Probabilité',   v:`${deal.probability||0}%`,                           c:stageInfo.color },
            { l:'Pondéré',       v:`${Math.round(weighted).toLocaleString('fr-FR')}€`,  c:'#7C3AED' },
            { l:'Date closing',  v:deal.closeDate||'—',                                 c:'var(--text-muted)' },
          ].map(m=>(
            <div key={m.l} style={{ textAlign:'center', padding:'10px 0', borderRadius:10, background:'var(--body-bg)' }}>
              <div style={{ fontSize:17, fontWeight:800, color:m.c }}>{m.v}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{m.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 2 columns */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:16 }}>
        {/* Left */}
        <div>
          {/* Tabs */}
          <div style={{ display:'flex', gap:0, marginBottom:14, borderBottom:'1px solid var(--card-border)' }}>
            {([['activities','⏱ Activités'],['details','📋 Détails'],['comments','💬 Commentaires']] as const).map(([k,l])=>(
              <button key={k} onClick={()=>setActiveTab(k)}
                style={{ padding:'8px 18px', border:'none', background:'transparent', cursor:'pointer', fontSize:13, fontWeight:700, color:activeTab===k?'var(--color-primary)':'var(--text-muted)', borderBottom:`2px solid ${activeTab===k?'var(--color-primary)':'transparent'}`, marginBottom:-1, transition:'all .15s' }}>
                {l}{k==='activities'&&upcoming.length>0&&<span style={{ marginLeft:5, fontSize:10, padding:'1px 5px', borderRadius:9999, background:'#EF4444', color:'#fff' }}>{upcoming.length}</span>}
              </button>
            ))}
          </div>

          {/* Activities tab */}
          {activeTab==='activities' && (
            <div>
              <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
                <button onClick={()=>setShowAddActivity(true)} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:10, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                  <Plus size={12}/>Ajouter
                </button>
              </div>

              {upcoming.length>0 && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>À faire ({upcoming.length})</div>
                  {upcoming.map(a=>{
                    const ac = ACTIVITY_CONFIG[a.type];
                    return (
                      <div key={a.id} style={{ display:'flex', gap:10, padding:'11px 14px', borderRadius:12, border:`1.5px solid ${ac.c}30`, background:ac.bg, marginBottom:8 }}>
                        <div style={{ width:30, height:30, borderRadius:8, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', color:ac.c, flexShrink:0, boxShadow:'0 1px 3px rgba(0,0,0,.1)' }}>{ac.icon}</div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', marginBottom:3 }}>{a.description}</div>
                          <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                            {new Date(a.date).toLocaleDateString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} · {a.user}
                          </div>
                        </div>
                        <button onClick={()=>setActivities(as=>as.map(x=>x.id===a.id?{...x,done:true}:x))} style={{ padding:5, borderRadius:7, border:'none', background:'#fff', cursor:'pointer', color:'#059669', display:'flex', alignSelf:'center' }}>
                          <CheckCircle size={14}/>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>Historique ({past.length})</div>
                <div style={{ position:'relative', paddingLeft:22 }}>
                  <div style={{ position:'absolute', left:10, top:0, bottom:0, width:1, background:'var(--card-border)' }}/>
                  {past.map(a=>{
                    const ac = ACTIVITY_CONFIG[a.type];
                    return (
                      <div key={a.id} style={{ position:'relative', marginBottom:12 }}>
                        <div style={{ position:'absolute', left:-16, top:5, width:18, height:18, borderRadius:6, background:ac.bg, color:ac.c, display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid var(--card-bg)', flexShrink:0 }}>{ac.icon}</div>
                        <div style={{ padding:'10px 12px', borderRadius:11, background:'var(--card-bg)', border:'1px solid var(--card-border)' }}>
                          <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                            <span style={{ fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:5, background:ac.bg, color:ac.c, flexShrink:0 }}>{ac.label}</span>
                            <span style={{ fontSize:13, color:'var(--text-primary)', lineHeight:1.5 }}>{a.description}</span>
                          </div>
                          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:5 }}>
                            {new Date(a.date).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})} · {a.user}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Details tab */}
          {activeTab==='details' && (
            <div style={{ background:'var(--card-bg)', borderRadius:14, border:'1px solid var(--card-border)', padding:18 }}>
              {editing ? (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  {[
                    { k:'title',       l:'Titre',          col:'1/-1' },
                    { k:'company',     l:'Entreprise',     col:'' },
                    { k:'prospect',    l:'Contact',        col:'' },
                    { k:'value',       l:'Valeur (€)',     col:'',  type:'number' },
                    { k:'probability', l:'Probabilité (%)',col:'',  type:'number' },
                    { k:'closeDate',   l:'Date closing',   col:'',  type:'date' },
                  ].map(f=>(
                    <div key={f.k} style={{ gridColumn:f.col||undefined }}>
                      <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:4 }}>{f.l}</label>
                      <input type={f.type||'text'} value={form[f.k]||''} onChange={e=>sf(f.k,e.target.value)}
                        style={{ width:'100%', padding:'8px 12px', border:'1px solid var(--card-border)', borderRadius:10, fontSize:13, background:'var(--body-bg)', color:'var(--text-primary)', outline:'none', boxSizing:'border-box' }}/>
                    </div>
                  ))}
                  <div style={{ gridColumn:'1/-1' }}>
                    <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:4 }}>Notes</label>
                    <textarea value={form.notes||''} onChange={e=>sf('notes',e.target.value)} rows={5}
                      style={{ width:'100%', padding:'8px 12px', border:'1px solid var(--card-border)', borderRadius:10, fontSize:13, background:'var(--body-bg)', color:'var(--text-primary)', outline:'none', resize:'none', boxSizing:'border-box' }}/>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:16 }}>
                    {[
                      { l:'Entreprise',  v:deal.company||'—' },
                      { l:'Contact',     v:deal.prospect||'—' },
                      { l:'Date closing',v:deal.closeDate||'—' },
                      { l:'ID deal',     v:(deal.id||'').slice(0,12)+'…' },
                    ].map(f=>(
                      <div key={f.l} style={{ padding:'10px 14px', borderRadius:10, background:'var(--body-bg)', border:'1px solid var(--card-border)' }}>
                        <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3 }}>{f.l}</div>
                        <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{f.v}</div>
                      </div>
                    ))}
                  </div>
                  {deal.notes && (
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>Notes</div>
                      <p style={{ fontSize:13, color:'var(--text-secondary)', lineHeight:1.7, whiteSpace:'pre-wrap', margin:0 }}>{deal.notes}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Comments tab */}
          {activeTab==='comments' && (
            <div style={{ background:'var(--card-bg)', borderRadius:14, border:'1px solid var(--card-border)', padding:18 }}>
              <CommentsPanel entityType="deal" entityId={deal.id}/>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {/* Next steps */}
          <div style={{ borderRadius:14, border:'1px solid var(--card-border)', background:'var(--card-bg)', padding:16 }}>
            <h3 style={{ fontWeight:700, fontSize:13, color:'var(--text-primary)', marginBottom:12 }}>Prochaines étapes</h3>
            {upcoming.length===0 ? (
              <div style={{ textAlign:'center', padding:'16px 0', color:'var(--text-muted)', fontSize:12 }}>
                <CheckCircle size={24} style={{ margin:'0 auto 6px', opacity:.3 }}/>
                Aucune tâche planifiée
              </div>
            ) : upcoming.map(a=>{
              const ac = ACTIVITY_CONFIG[a.type];
              return (
                <div key={a.id} style={{ display:'flex', gap:8, padding:'8px 0', borderBottom:'1px solid var(--card-border)' }}>
                  <div style={{ color:ac.c, flexShrink:0, marginTop:2 }}>{ac.icon}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, color:'var(--text-primary)', lineHeight:1.4 }}>{a.description}</div>
                    <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>{new Date(a.date).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}</div>
                  </div>
                </div>
              );
            })}
            <button onClick={()=>setShowAddActivity(true)} style={{ width:'100%', marginTop:10, display:'flex', alignItems:'center', justifyContent:'center', gap:5, padding:'7px 0', borderRadius:9, border:'1px dashed var(--card-border)', background:'transparent', color:'var(--text-muted)', fontSize:12, cursor:'pointer' }}>
              <Plus size={11}/>Ajouter une tâche
            </button>
          </div>

          {/* Quick actions */}
          <div style={{ borderRadius:14, border:'1px solid var(--card-border)', background:'var(--card-bg)', padding:16 }}>
            <h3 style={{ fontWeight:700, fontSize:13, color:'var(--text-primary)', marginBottom:12 }}>Actions rapides</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
              {[
                { l:'Envoyer un email',     icon:<Mail size={13}/>,     c:'#2563EB', bg:'#EFF6FF' },
                { l:'Planifier un appel',   icon:<Phone size={13}/>,    c:'#059669', bg:'#ECFDF5' },
                { l:'Créer une réunion',    icon:<Calendar size={13}/>, c:'#7C3AED', bg:'#F5F3FF' },
                { l:'Lancer une séquence',  icon:<Zap size={13}/>,      c:'#D97706', bg:'#FFFBEB' },
              ].map(a=>(
                <button key={a.l} onClick={()=>toast.success(a.l+' pour '+deal.company)}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:10, border:'1px solid var(--card-border)', background:'var(--body-bg)', cursor:'pointer', transition:'background .1s' }}
                  onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background=a.bg}
                  onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='var(--body-bg)'}>
                  <span style={{ color:a.c }}>{a.icon}</span>
                  <span style={{ fontSize:13, color:'var(--text-secondary)', fontWeight:500 }}>{a.l}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Deal metadata */}
          <div style={{ borderRadius:14, border:'1px solid var(--card-border)', background:'var(--card-bg)', padding:16 }}>
            <h3 style={{ fontWeight:700, fontSize:13, color:'var(--text-primary)', marginBottom:10 }}>Informations</h3>
            {[
              { l:'Créé le', v:new Date(deal.createdAt||Date.now()).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}) },
              { l:'Modifié le', v:new Date(deal.updatedAt||Date.now()).toLocaleDateString('fr-FR',{day:'numeric',month:'long'}) },
              { l:'Activités', v:`${activities.length} (${upcoming.length} à faire)` },
            ].map(m=>(
              <div key={m.l} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--card-border)', fontSize:12 }}>
                <span style={{ color:'var(--text-muted)' }}>{m.l}</span>
                <span style={{ color:'var(--text-secondary)', fontWeight:600 }}>{m.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
