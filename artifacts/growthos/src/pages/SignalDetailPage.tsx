import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { ArrowLeft, Loader2, Zap, Building2, Star, CheckCircle, ExternalLink, Mail, Phone, Plus, Clock, User, XCircle, Bell, BellOff, MessageSquare, TrendingUp, ChevronRight } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  funding:    { icon:'💰', color:'#059669', bg:'#ECFDF5', label:'Levée de fonds' },
  hiring:     { icon:'👥', color:'#2563EB', bg:'#EFF6FF', label:'Recrutement' },
  news:       { icon:'📰', color:'#D97706', bg:'#FEF3C7', label:'Actualité' },
  technology: { icon:'🔧', color:'#7C3AED', bg:'#EDE9FE', label:'Technologie' },
  expansion:  { icon:'🌍', color:'#0891B2', bg:'#ECFEFF', label:'Expansion' },
};


const ACTION_COLORS: Record<string, string> = { email:'#7C3AED', call:'#059669', deal:'#2563EB', sequence:'#D97706', view:'#6B7280', star:'#F59E0B', ignore:'#EF4444' };
const ACTION_ICONS: Record<string, any> = { email:<Mail size={12}/>, call:<Phone size={12}/>, deal:<TrendingUp size={12}/>, sequence:<Zap size={12}/>, view:<CheckCircle size={12}/>, star:<Star size={12}/>, ignore:<XCircle size={12}/> };

export default function SignalDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [, navigate] = useLocation();
  const [signal, setSignal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actions, setActions] = useState<any[]>([]);
  const [note, setNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [snoozed, setSnoozed] = useState(false);
  const [tab, setTab] = useState<'overview'|'contacts'|'history'>('overview');

  useEffect(()=>{
    apiClient.get(`/signals/${id}`)
      .then((data: any)=>{
        setSignal(data);
        if (!data.isRead) apiClient.post(`/signals/${id}/read`,{}).catch(()=>{});
      })
      .catch(()=>{
        apiClient.get('/signals')
          .then((all: any)=>{
            const list = Array.isArray(all)?all:all.data||[];
            const found = list.find((s:any)=>s.id===id) ?? null;
            setSignal(found);
            if (found && !found.isRead) apiClient.post(`/signals/${id}/read`,{}).catch(()=>{});
          })
          .catch(()=>setSignal(null))
          .finally(()=>setLoading(false));
        return;
      })
      .finally(()=>setLoading(false));
  },[id]);

  const toggleStar = async ()=>{
    setSignal((s:any)=>({ ...s, isStarred:!s.isStarred }));
    toast.success(signal.isStarred?'Retiré des favoris':'Ajouté aux favoris');
    await apiClient.patch(`/signals/${id}`,{ isStarred:!signal.isStarred }).catch(()=>{});
  };

  const logAction = (type: string, label: string)=>{
    const entry = { id: Date.now().toString(), type, label, user:'Vous', date:'À l\'instant', status:'done', note };
    setActions(a=>[entry,...a]);
    setNote('');
    setAddingNote(false);
    toast.success('Action enregistrée');
    if (type==='deal') navigate('/pipeline');
    if (type==='sequence') navigate('/sequences');
  };

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--body-bg)' }}>
      <Loader2 size={28} style={{ color:'var(--color-primary)', animation:'spin 1s linear infinite' }}/>
    </div>
  );
  if (!signal) return null;

  const typeInfo = TYPE_CONFIG[signal.type]||{ icon:'⚡', color:'#6B7280', bg:'#F3F4F6', label:signal.type };
  const scoreData = signal.scoreBreakdown || [];
  const contacts  = signal.contacts       || [];
  const related   = signal.relatedSignals || [];

  return (
    <div style={{ minHeight:'100vh', background:'var(--body-bg)' }}>
      {/* Header */}
      <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--card-border)', background:'var(--card-bg)', display:'flex', alignItems:'center', gap:14 }}>
        <button onClick={()=>navigate('/signals')} style={{ width:34, height:34, borderRadius:10, border:'1px solid var(--card-border)', background:'var(--body-bg)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', flexShrink:0 }}>
          <ArrowLeft size={16}/>
        </button>
        <div style={{ width:42, height:42, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, background:typeInfo.bg, flexShrink:0 }}>{typeInfo.icon}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:17, fontWeight:800, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{signal.title}</div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:2 }}>
            <Building2 size={12} style={{ color:'var(--text-muted)', flexShrink:0 }}/>
            <span style={{ fontSize:12, color:'var(--text-muted)' }}>{signal.company}</span>
            <span style={{ fontSize:11, padding:'2px 8px', borderRadius:9999, fontWeight:600, background:typeInfo.bg, color:typeInfo.color }}>{typeInfo.label}</span>
            {snoozed && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:9999, background:'#FEF3C7', color:'#D97706', fontWeight:600 }}>⏸ Snoozé</span>}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <button onClick={()=>{ setSnoozed(s=>!s); toast.success(snoozed?'Signal réactivé':'Signal mis en veille 7j'); }}
            style={{ padding:'6px 12px', borderRadius:9, border:'1px solid var(--card-border)', background:'var(--body-bg)', cursor:'pointer', fontSize:12, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:5 }}>
            {snoozed?<Bell size={13}/>:<BellOff size={13}/>}{snoozed?'Réactiver':'Snooze 7j'}
          </button>
          <button onClick={toggleStar} style={{ width:34, height:34, borderRadius:9, border:'1px solid var(--card-border)', background:signal.isStarred?'#FEF3C7':'var(--body-bg)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Star size={16} style={{ color:signal.isStarred?'#F59E0B':'var(--text-muted)', fill:signal.isStarred?'#F59E0B':'none' }}/>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding:'0 24px', borderBottom:'1px solid var(--card-border)', background:'var(--card-bg)', display:'flex', gap:0 }}>
        {([['overview','Aperçu'],['contacts','Contacts'],['history','Historique']] as const).map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{ padding:'12px 18px', border:'none', borderBottom:`2px solid ${tab===t?'var(--color-primary)':'transparent'}`, background:'transparent', fontSize:13, fontWeight:tab===t?700:400, color:tab===t?'var(--color-primary)':'var(--text-muted)', cursor:'pointer', transition:'all .15s' }}>
            {l}
          </button>
        ))}
      </div>

      <div style={{ padding:24, display:'grid', gridTemplateColumns:'1fr 300px', gap:20 }}>
        {/* Main content */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* Overview tab */}
          {tab==='overview' && (
            <>
              <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, padding:20 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.06em' }}>Détails du signal</div>
                <p style={{ fontSize:14, color:'var(--text-secondary)', lineHeight:1.7, margin:0 }}>
                  {signal.description || MOCK_SIGNAL.description}
                </p>
                <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid var(--card-border)', display:'flex', gap:20, flexWrap:'wrap' }}>
                  {[
                    { l:'Source', v:signal.source||'LinkedIn' },
                    { l:'Détecté', v:new Date(signal.createdAt).toLocaleDateString('fr-FR',{ day:'numeric', month:'long', year:'numeric' }) },
                    { l:'Secteur', v:signal.sector||MOCK_SIGNAL.sector },
                    { l:'Effectif', v:signal.employees||MOCK_SIGNAL.employees },
                  ].map(m=>(
                    <div key={m.l}>
                      <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em' }}>{m.l}</div>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', marginTop:2 }}>{m.v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommended actions */}
              <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, padding:20 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', marginBottom:12, textTransform:'uppercase', letterSpacing:'0.06em' }}>Actions recommandées</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {[
                    { icon:'✉️', label:'Email de prospection', sub:'Contextualisé sur la levée', type:'email', color:'#7C3AED' },
                    { icon:'📞', label:'Appel dans les 24h', sub:'Signal chaud — fenêtre courte', type:'call', color:'#059669' },
                    { icon:'💼', label:'Créer un deal', sub:'Pipeline avec probabilité 60%', type:'deal', color:'#2563EB' },
                    { icon:'📋', label:'Ajouter à une séquence', sub:'Séquence Funded Series B', type:'sequence', color:'#D97706' },
                  ].map((action,i)=>(
                    <button key={i} onClick={()=>logAction(action.type, action.label)}
                      style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:12, border:`1px solid ${action.color}30`, background:`${action.color}06`, cursor:'pointer', textAlign:'left' }}>
                      <span style={{ fontSize:20, flexShrink:0 }}>{action.icon}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{action.label}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:1 }}>{action.sub}</div>
                      </div>
                      <ChevronRight size={14} style={{ color:'var(--text-muted)', flexShrink:0 }}/>
                    </button>
                  ))}
                </div>
              </div>

              {/* Related signals */}
              <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, padding:20 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', marginBottom:12, textTransform:'uppercase', letterSpacing:'0.06em' }}>Signaux liés — {signal.company}</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {related.map((r:any)=>{
                    const ri = TYPE_CONFIG[r.type]||{ icon:'⚡', color:'#6B7280', bg:'#F3F4F6', label:r.type };
                    return (
                      <div key={r.id} onClick={()=>navigate(`/signals/${r.id}`)} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:10, border:'1px solid var(--card-border)', background:'var(--body-bg)', cursor:'pointer' }}>
                        <span style={{ fontSize:18 }}>{ri.icon}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{r.title}</div>
                          <div style={{ fontSize:11, color:'var(--text-muted)' }}>{r.date}</div>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ fontSize:12, fontWeight:700, color:ri.color }}>{r.score}</span>
                          <ChevronRight size={13} style={{ color:'var(--text-muted)' }}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Contacts tab */}
          {tab==='contacts' && (
            <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, padding:20 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', marginBottom:14, textTransform:'uppercase', letterSpacing:'0.06em' }}>Contacts chez {signal.company}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {contacts.map((c:any,i:number)=>(
                  <div key={i} style={{ padding:'14px 16px', borderRadius:12, border:'1px solid var(--card-border)', background:'var(--body-bg)', display:'flex', alignItems:'center', gap:14 }}>
                    <div style={{ width:40, height:40, borderRadius:'50%', background:'var(--color-primary)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:14, flexShrink:0 }}>
                      {c.name.split(' ').map((n:string)=>n[0]).join('')}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>{c.name}</span>
                        {i===0 && <span style={{ fontSize:10, padding:'2px 7px', borderRadius:9999, background:'#EDE9FE', color:'#7C3AED', fontWeight:700 }}>DÉCIDEUR</span>}
                      </div>
                      <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{c.title}</div>
                      <div style={{ display:'flex', gap:12, marginTop:6, flexWrap:'wrap' }}>
                        <a href={`mailto:${c.email}`} style={{ fontSize:11, color:'var(--color-primary)', display:'flex', alignItems:'center', gap:4 }}><Mail size={11}/>{c.email}</a>
                        <a href={`tel:${c.phone}`} style={{ fontSize:11, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:4 }}><Phone size={11}/>{c.phone}</a>
                      </div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8, flexShrink:0 }}>
                      <div style={{ fontSize:13, fontWeight:800, color:typeInfo.color }}>{c.score}</div>
                      <div style={{ fontSize:10, color:'var(--text-muted)' }}>score</div>
                      <div style={{ display:'flex', gap:5 }}>
                        <button onClick={()=>logAction('email',`Email à ${c.name}`)} style={{ padding:'4px 10px', borderRadius:7, border:'1px solid var(--card-border)', background:'var(--card-bg)', cursor:'pointer', fontSize:11, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:4 }}>
                          <Mail size={11}/>Email
                        </button>
                        <button onClick={()=>logAction('call',`Appel ${c.name}`)} style={{ padding:'4px 10px', borderRadius:7, border:'1px solid var(--card-border)', background:'var(--card-bg)', cursor:'pointer', fontSize:11, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:4 }}>
                          <Phone size={11}/>Appel
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* History tab */}
          {tab==='history' && (
            <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, padding:20 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Historique des actions</div>
                <button onClick={()=>setAddingNote(v=>!v)}
                  style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:8, border:'1px solid var(--card-border)', background:'var(--body-bg)', cursor:'pointer', fontSize:12, color:'var(--color-primary)', fontWeight:600 }}>
                  <Plus size={12}/>Ajouter une note
                </button>
              </div>
              {addingNote && (
                <div style={{ marginBottom:14, padding:12, borderRadius:12, background:'var(--body-bg)', border:'1px solid var(--card-border)' }}>
                  <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Note ou action réalisée..." rows={2}
                    style={{ width:'100%', border:'none', background:'transparent', color:'var(--text-primary)', fontSize:13, outline:'none', resize:'none', boxSizing:'border-box' }}/>
                  <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
                    <button onClick={()=>setAddingNote(false)} style={{ padding:'5px 12px', borderRadius:8, border:'1px solid var(--card-border)', background:'transparent', cursor:'pointer', fontSize:12, color:'var(--text-muted)' }}>Annuler</button>
                    <button onClick={()=>logAction('view',note||'Note ajoutée')} style={{ padding:'5px 12px', borderRadius:8, border:'none', background:'var(--color-primary)', color:'#fff', cursor:'pointer', fontSize:12, fontWeight:600 }}>Enregistrer</button>
                  </div>
                </div>
              )}
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {actions.map((a,i)=>(
                  <div key={a.id} style={{ display:'flex', gap:12 }}>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
                      <div style={{ width:28, height:28, borderRadius:'50%', background:`${ACTION_COLORS[a.type]}18`, color:ACTION_COLORS[a.type], display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {ACTION_ICONS[a.type]}
                      </div>
                      {i<actions.length-1 && <div style={{ width:1, flex:1, background:'var(--card-border)', margin:'4px 0' }}/>}
                    </div>
                    <div style={{ flex:1, paddingBottom:10 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{a.label}</div>
                      {a.note && <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:3 }}>{a.note}</div>}
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
                        <User size={10} style={{ color:'var(--text-muted)' }}/>
                        <span style={{ fontSize:11, color:'var(--text-muted)' }}>{a.user}</span>
                        <Clock size={10} style={{ color:'var(--text-muted)' }}/>
                        <span style={{ fontSize:11, color:'var(--text-muted)' }}>{a.date}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {actions.length===0 && (
                  <div style={{ textAlign:'center', padding:'24px 0', color:'var(--text-muted)', fontSize:13 }}>Aucune action enregistrée</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {/* Score */}
          <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, padding:18 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', marginBottom:14, textTransform:'uppercase', letterSpacing:'0.06em' }}>Score d'intention</div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12 }}>
              <div style={{ position:'relative', width:88, height:88 }}>
                <svg viewBox="0 0 36 36" style={{ width:88, height:88, transform:'rotate(-90deg)' }}>
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--body-bg)" strokeWidth="3"/>
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke={typeInfo.color} strokeWidth="3"
                    strokeDasharray={`${signal.score||50} 100`} strokeLinecap="round"/>
                </svg>
                <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <span style={{ fontSize:22, fontWeight:800, color:typeInfo.color }}>{signal.score||50}</span>
                </div>
              </div>
            </div>
            <p style={{ fontSize:11, textAlign:'center', color:'var(--text-muted)', marginBottom:14 }}>
              {(signal.score||50)>=80?'🔥 Signal très fort — agissez maintenant':(signal.score||50)>=60?'⚡ Signal fort — à traiter rapidement':'📊 Signal modéré — à surveiller'}
            </p>
            {/* Score breakdown */}
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', marginBottom:8 }}>Décomposition</div>
            {scoreData.map((s:any,i:number)=>(
              <div key={i} style={{ marginBottom:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <span style={{ fontSize:11, color:'var(--text-secondary)' }}>{s.label}</span>
                  <span style={{ fontSize:11, fontWeight:700, color:typeInfo.color }}>{s.value}/{s.max}</span>
                </div>
                <div style={{ height:4, borderRadius:9999, background:'var(--card-border)', overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${(s.value/s.max)*100}%`, background:typeInfo.color, borderRadius:9999 }}/>
                </div>
                <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:1 }}>{s.desc}</div>
              </div>
            ))}
          </div>

          {/* Company info */}
          <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, padding:18 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', marginBottom:12, textTransform:'uppercase', letterSpacing:'0.06em' }}>Informations</div>
            {[
              { l:'Entreprise',  v:signal.company },
              { l:'Type signal', v:typeInfo.label },
              { l:'Secteur',     v:signal.sector||MOCK_SIGNAL.sector },
              { l:'Effectif',    v:signal.employees||MOCK_SIGNAL.employees },
              { l:'CA estimé',   v:signal.revenue||MOCK_SIGNAL.revenue },
              { l:'Statut',      v:signal.isRead?'Lu':'Non lu' },
              { l:'Favori',      v:signal.isStarred?'⭐ Oui':'Non' },
            ].map(m=>(
              <div key={m.l} style={{ display:'flex', justifyContent:'space-between', marginBottom:7 }}>
                <span style={{ fontSize:12, color:'var(--text-muted)' }}>{m.l}</span>
                <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)' }}>{m.v}</span>
              </div>
            ))}
          </div>

          <button onClick={()=>navigate('/signals')} style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderRadius:12, border:'1px solid var(--card-border)', background:'var(--card-bg)', cursor:'pointer', fontSize:12, color:'var(--text-secondary)', width:'100%' }}>
            <Zap size={13} style={{ color:'var(--color-primary)' }}/>Voir tous les signaux
          </button>
        </div>
      </div>
    </div>
  );
}
