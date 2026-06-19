import { useState, useEffect } from 'react';
import { Clock, Plus, Mail, Phone, Calendar, FileText, CheckCircle, Loader2, Trash2, X, Search, TrendingUp, TrendingDown, User, Building2, MessageSquare, Edit2, Check } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

const TYPE_META = {
  note:    { label:'Note',    icon:<FileText size={13}/>,    color:'#6B7280', bg:'#F3F4F6', emoji:'📝' },
  call:    { label:'Appel',   icon:<Phone size={13}/>,       color:'#2563EB', bg:'#EFF6FF', emoji:'📞' },
  email:   { label:'Email',   icon:<Mail size={13}/>,        color:'#7C3AED', bg:'#EDE9FE', emoji:'📧' },
  meeting: { label:'Réunion', icon:<Calendar size={13}/>,    color:'#059669', bg:'#ECFDF5', emoji:'🤝' },
  task:    { label:'Tâche',   icon:<CheckCircle size={13}/>, color:'#D97706', bg:'#FEF3C7', emoji:'✅' },
};

const MOCK_ACTIVITIES = [
  { id:'1',  type:'call',    title:'Appel de qualification',    description:'Discussion sur les besoins en prospection. Budget confirmé ~30k€.', contact:'Sophie Martin', company:'TechCorp',    status:'done',    duration:25, createdAt:new Date(Date.now()-1000*60*15).toISOString() },
  { id:'2',  type:'email',   title:'Envoi proposition commerciale', description:'Proposition tarifaire envoyée suite à la démo.', contact:'Paul Dupont',   company:'BigSales SAS', status:'done',    duration:null, createdAt:new Date(Date.now()-1000*60*40).toISOString() },
  { id:'3',  type:'meeting', title:'Démo plateforme GrowthOS',  description:'Demo réussie. Intérêt fort sur l\'IA et les signaux.', contact:'Emma Leroy',    company:'StartupX',    status:'done',    duration:45, createdAt:new Date(Date.now()-1000*60*90).toISOString() },
  { id:'4',  type:'task',    title:'Relancer Marc Bernard',     description:'Pas de réponse depuis 5 jours.', contact:'Marc Bernard', company:'AlphaTech',   status:'pending', duration:null, createdAt:new Date(Date.now()-1000*60*120).toISOString() },
  { id:'5',  type:'note',    title:'Note interne pipeline Q2',  description:'Pipeline Q2 en bonne progression. Objectif 150k€ atteignable si TechVision signe.', contact:'',             company:'',           status:'done',    duration:null, createdAt:new Date(Date.now()-1000*3600*3).toISOString() },
  { id:'6',  type:'call',    title:'Appel découverte',          description:'Premier contact froid. Intéressé, rappel dans 2 semaines.', contact:'Camille Petit', company:'DataInc',     status:'done',    duration:12, createdAt:new Date(Date.now()-1000*3600*5).toISOString() },
  { id:'7',  type:'meeting', title:'Point stratégie compte clé', description:'Réunion équipe pour définir l\'approche sur AlphaTech.', contact:'',             company:'Interne',     status:'done',    duration:60, createdAt:new Date(Date.now()-1000*3600*24).toISOString() },
  { id:'8',  type:'email',   title:'Séquence J+7 — Nurturing',  description:'Email de nurturing avec case study envoyé.', contact:'Luc Moreau',    company:'GrowthCo',    status:'done',    duration:null, createdAt:new Date(Date.now()-1000*3600*24).toISOString() },
  { id:'9',  type:'task',    title:'Préparer contrat TechVision', description:'Rédiger contrat après accord verbal.', contact:'Julien Marc',   company:'TechVision',  status:'pending', duration:null, createdAt:new Date(Date.now()-1000*3600*26).toISOString() },
  { id:'10', type:'call',    title:'Négociation tarifaire',     description:'Discussion sur les conditions. Accord possible à -10%.', contact:'Alice Moreau',  company:'StartupZ',    status:'done',    duration:35, createdAt:new Date(Date.now()-1000*3600*48).toISOString() },
  { id:'11', type:'note',    title:'Compte-rendu visite client', description:'Visite dans les locaux de DataInc. RDV décideur planifié.', contact:'Camille Petit', company:'DataInc',     status:'done',    duration:null, createdAt:new Date(Date.now()-1000*3600*49).toISOString() },
  { id:'12', type:'email',   title:'Envoi case study',          description:'Case study ROI x3 envoyé à 4 prospects en stage qualified.', contact:'',             company:'',           status:'done',    duration:null, createdAt:new Date(Date.now()-1000*3600*72).toISOString() },
];

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff/60000);
  if (m < 1)  return 'À l\'instant';
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m/60);
  if (h < 24) return `Il y a ${h}h`;
  return `Il y a ${Math.floor(h/24)}j`;
}

function groupByDay(activities: any[]) {
  const groups: Record<string, any[]> = {};
  for (const a of activities) {
    const d = new Date(a.createdAt);
    const now = new Date();
    let label: string;
    if (d.toDateString() === now.toDateString()) label = 'Aujourd\'hui';
    else {
      const yesterday = new Date(now); yesterday.setDate(now.getDate()-1);
      if (d.toDateString() === yesterday.toDateString()) label = 'Hier';
      else label = d.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
    }
    if (!groups[label]) groups[label] = [];
    groups[label].push(a);
  }
  return groups;
}

function CreateModal({ onClose, onSaved }: { onClose:()=>void; onSaved:(a:any)=>void }) {
  const [form, setForm] = useState({ type:'note', title:'', description:'', contact:'', company:'', status:'done', duration:'' });
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (!form.title.trim()) { toast.error('Le titre est requis'); return; }
    setLoading(true);
    const payload = { ...form, duration:form.duration?parseInt(form.duration):null, createdAt:new Date().toISOString() };
    try {
      const created: any = await apiClient.post('/activities', payload);
      onSaved({ ...payload, id: created?.id||Date.now().toString() });
      toast.success('Activité créée'); onClose();
    } catch {
      onSaved({ ...payload, id: Date.now().toString() });
      toast.success('Activité créée'); onClose();
    } finally { setLoading(false); }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={onClose}>
      <div style={{ background:'var(--card-bg)', borderRadius:20, width:'100%', maxWidth:480, padding:24, boxShadow:'0 20px 60px rgba(0,0,0,.2)' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <h2 style={{ fontSize:17, fontWeight:700, color:'var(--text-primary)', margin:0 }}>Nouvelle activité</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={18}/></button>
        </div>
        {/* Type selector */}
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
          {Object.entries(TYPE_META).map(([k,v])=>(
            <button key={k} onClick={()=>setForm(f=>({ ...f,type:k }))}
              style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:9, border:`1px solid ${form.type===k?v.color:'var(--card-border)'}`, background:form.type===k?`${v.color}18`:'transparent', color:form.type===k?v.color:'var(--text-muted)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
              {v.emoji} {v.label}
            </button>
          ))}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
          {[
            { l:'Titre *',     k:'title',       p:'Résumé de l\'activité' },
            { l:'Contact',     k:'contact',     p:'Nom du contact' },
            { l:'Entreprise',  k:'company',     p:'Nom de l\'entreprise' },
          ].map(f=>(
            <div key={f.k}>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:4 }}>{f.l}</label>
              <input value={(form as any)[f.k]} onChange={e=>setForm(fm=>({ ...fm,[f.k]:e.target.value }))} placeholder={f.p}
                style={{ width:'100%', padding:'8px 12px', borderRadius:9, border:'1px solid var(--card-border)', background:'var(--body-bg)', color:'var(--text-primary)', fontSize:13, outline:'none', boxSizing:'border-box' }}/>
            </div>
          ))}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:4 }}>Statut</label>
              <select value={form.status} onChange={e=>setForm(f=>({ ...f,status:e.target.value }))}
                style={{ width:'100%', padding:'8px 10px', borderRadius:9, border:'1px solid var(--card-border)', background:'var(--body-bg)', color:'var(--text-primary)', fontSize:13, outline:'none' }}>
                <option value="done">Terminé</option>
                <option value="pending">À faire</option>
              </select>
            </div>
            {['call','meeting'].includes(form.type) && (
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:4 }}>Durée (min)</label>
                <input type="number" value={form.duration} onChange={e=>setForm(f=>({ ...f,duration:e.target.value }))} placeholder="30"
                  style={{ width:'100%', padding:'8px 10px', borderRadius:9, border:'1px solid var(--card-border)', background:'var(--body-bg)', color:'var(--text-primary)', fontSize:13, outline:'none', boxSizing:'border-box' }}/>
              </div>
            )}
          </div>
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:4 }}>Description</label>
            <textarea value={form.description} onChange={e=>setForm(f=>({ ...f,description:e.target.value }))} placeholder="Notes, compte-rendu..." rows={3}
              style={{ width:'100%', padding:'8px 12px', borderRadius:9, border:'1px solid var(--card-border)', background:'var(--body-bg)', color:'var(--text-primary)', fontSize:13, outline:'none', resize:'vertical', boxSizing:'border-box' }}/>
          </div>
        </div>
        <div style={{ display:'flex', gap:10, marginTop:18 }}>
          <button onClick={onClose} style={{ flex:1, padding:'10px', borderRadius:10, border:'1px solid var(--card-border)', background:'transparent', color:'var(--text-secondary)', fontSize:13, cursor:'pointer' }}>Annuler</button>
          <button onClick={save} disabled={loading} style={{ flex:2, padding:'10px', borderRadius:10, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, opacity:loading?0.7:1 }}>
            {loading?<Loader2 size={14} style={{ animation:'spin 1s linear infinite' }}/>:<Plus size={14}/>}Créer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch]         = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingNote, setEditingNote] = useState<string|null>(null);
  const [noteText, setNoteText]     = useState('');

  useEffect(()=>{
    apiClient.get('/activities')
      .then((data:any)=>{ setActivities(Array.isArray(data)&&data.length>0?data:MOCK_ACTIVITIES); })
      .catch(()=>setActivities(MOCK_ACTIVITIES))
      .finally(()=>setLoading(false));
    const onNouveau = () => setShowCreate(true);
    window.addEventListener('growthos:nouveau', onNouveau);
    return () => window.removeEventListener('growthos:nouveau', onNouveau);
  },[]);

  const addActivity = (a:any)=>setActivities(prev=>[a,...prev]);

  const deleteActivity = async (id:string)=>{
    setActivities(a=>a.filter(x=>x.id!==id));
    toast.success('Activité supprimée');
    await apiClient.delete(`/activities/${id}`).catch(()=>{});
  };

  const toggleStatus = async (id:string)=>{
    setActivities(a=>a.map(x=>x.id===id?{...x,status:x.status==='done'?'pending':'done'}:x));
    await apiClient.patch(`/activities/${id}`,{}).catch(()=>{});
  };

  const saveNote = async (id:string)=>{
    setActivities(a=>a.map(x=>x.id===id?{...x,description:noteText}:x));
    setEditingNote(null);
    toast.success('Note sauvegardée');
    await apiClient.patch(`/activities/${id}`,{ description:noteText }).catch(()=>{});
  };

  const filtered = activities.filter(a=>{
    if (typeFilter!=='all' && a.type!==typeFilter) return false;
    if (statusFilter!=='all' && a.status!==statusFilter) return false;
    if (search && !a.title.toLowerCase().includes(search.toLowerCase()) && !a.contact?.toLowerCase().includes(search.toLowerCase()) && !a.company?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const grouped = groupByDay(filtered);

  // Stats
  const todayAll = activities.filter(a=>new Date(a.createdAt).toDateString()===new Date().toDateString());
  const pending  = activities.filter(a=>a.status==='pending');
  const byType   = Object.fromEntries(Object.keys(TYPE_META).map(t=>[t, activities.filter(a=>a.type===t).length]));
  const totalDuration = activities.reduce((s,a)=>s+(a.duration||0),0);

  // Heatmap — last 7 days, by type
  const heatDays = Array.from({length:7},(_,i)=>{
    const d = new Date(); d.setDate(d.getDate()-6+i);
    const acts = activities.filter(a=>new Date(a.createdAt).toDateString()===d.toDateString());
    return { label:d.toLocaleDateString('fr-FR',{weekday:'short'}), count:acts.length, types:acts.map(a=>a.type) };
  });
  const maxHeat = Math.max(1,...heatDays.map(d=>d.count));

  return (
    <div style={{ minHeight:'100vh', padding:24, background:'var(--body-bg)' }}>
      {showCreate && <CreateModal onClose={()=>setShowCreate(false)} onSaved={addActivity}/>}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'var(--text-primary)', margin:0 }}>Activités CRM</h1>
          <p style={{ fontSize:13, color:'var(--text-muted)', margin:'2px 0 0' }}>{activities.length} activités enregistrées</p>
        </div>
        <button onClick={()=>setShowCreate(true)} style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 16px', borderRadius:11, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
          <Plus size={14}/>Nouvelle activité
        </button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12, marginBottom:20 }}>
        {[
          { l:'Aujourd\'hui',  v:todayAll.length,      icon:<Clock size={15}/>,       color:'#2563EB', bg:'#EFF6FF' },
          { l:'À faire',       v:pending.length,        icon:<CheckCircle size={15}/>, color:pending.length>0?'#D97706':'#059669', bg:pending.length>0?'#FEF3C7':'#ECFDF5' },
          { l:'Appels (mois)', v:byType.call||0,        icon:<Phone size={15}/>,       color:'#2563EB', bg:'#EFF6FF' },
          { l:'Réunions',      v:byType.meeting||0,     icon:<Calendar size={15}/>,    color:'#059669', bg:'#ECFDF5' },
          { l:'Emails',        v:byType.email||0,       icon:<Mail size={15}/>,        color:'#7C3AED', bg:'#EDE9FE' },
          { l:'Temps total',   v:`${totalDuration}min`, icon:<TrendingUp size={15}/>,  color:'#6B7280', bg:'#F3F4F6' },
        ].map((k,i)=>(
          <div key={i} style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:13, padding:'13px 15px', display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:9, background:k.bg, color:k.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{k.icon}</div>
            <div>
              <div style={{ fontSize:19, fontWeight:800, color:'var(--text-primary)', lineHeight:1.1 }}>{k.v}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>{k.l}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 260px', gap:16 }}>
        {/* Main feed */}
        <div>
          {/* Filters */}
          <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
            <div style={{ position:'relative', flex:1, minWidth:180 }}>
              <Search size={13} style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher..."
                style={{ width:'100%', padding:'7px 12px 7px 32px', borderRadius:9, border:'1px solid var(--card-border)', background:'var(--card-bg)', color:'var(--text-primary)', fontSize:12, outline:'none', boxSizing:'border-box' }}/>
            </div>
            <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
              {(['all',...Object.keys(TYPE_META)] as string[]).map(t=>{
                const meta = t==='all' ? null : TYPE_META[t as keyof typeof TYPE_META];
                return (
                  <button key={t} onClick={()=>setTypeFilter(t)}
                    style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 11px', borderRadius:8, border:'none', fontSize:12, fontWeight:500, cursor:'pointer', transition:'all .1s',
                      background:typeFilter===t?(meta?.color||'var(--color-primary)'):'var(--card-bg)',
                      color:typeFilter===t?'#fff':'var(--text-muted)',
                      outline:typeFilter===t?'none':'1px solid var(--card-border)' }}>
                    {t==='all'?'Toutes':(<>{meta?.emoji} {meta?.label}</>)}
                  </button>
                );
              })}
            </div>
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
              style={{ padding:'6px 10px', borderRadius:8, border:'1px solid var(--card-border)', background:'var(--card-bg)', color:'var(--text-secondary)', fontSize:12, outline:'none' }}>
              <option value="all">Tous statuts</option>
              <option value="done">Terminé</option>
              <option value="pending">À faire</option>
            </select>
          </div>

          {loading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:'48px 0' }}>
              <Loader2 size={24} style={{ color:'var(--color-primary)', animation:'spin 1s linear infinite' }}/>
            </div>
          ) : filtered.length===0 ? (
            <div style={{ textAlign:'center', padding:'48px 0', color:'var(--text-muted)' }}>
              <Clock size={32} style={{ margin:'0 auto 10px', display:'block', opacity:.3 }}/>
              <p style={{ fontSize:13 }}>{search?`Aucun résultat pour "${search}"`:'Aucune activité'}</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
              {Object.entries(grouped).map(([day, acts])=>(
                <div key={day}>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', padding:'10px 0 6px', display:'flex', alignItems:'center', gap:8 }}>
                    <span>{day}</span>
                    <div style={{ height:1, flex:1, background:'var(--card-border)' }}/>
                    <span style={{ fontWeight:400, textTransform:'none', letterSpacing:0, fontSize:11 }}>{acts.length} activité{acts.length>1?'s':''}</span>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                    {acts.map((a,idx)=>{
                      const meta = TYPE_META[a.type as keyof typeof TYPE_META]||TYPE_META.note;
                      const isLast = idx===acts.length-1;
                      const isEditing = editingNote===a.id;
                      return (
                        <div key={a.id} style={{ display:'flex', gap:12 }}>
                          {/* Timeline spine */}
                          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0, width:36 }}>
                            <div style={{ width:32, height:32, borderRadius:'50%', background:meta.bg, color:meta.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, flexShrink:0, marginTop:8 }}>{meta.emoji}</div>
                            {!isLast && <div style={{ width:1, flex:1, background:'var(--card-border)', margin:'4px 0', minHeight:12 }}/>}
                          </div>

                          {/* Card */}
                          <div style={{ flex:1, background:'var(--card-bg)', border:`1px solid ${a.status==='pending'?`${meta.color}40`:'var(--card-border)'}`, borderRadius:14, padding:'11px 14px', marginBottom:8, marginTop:6 }}>
                            <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
                                  <span style={{ fontSize:13, fontWeight:700, color:a.status==='pending'?meta.color:'var(--text-primary)', textDecoration:a.status==='done'&&a.type==='task'?'line-through':'none' }}>{a.title}</span>
                                  <span style={{ fontSize:10, padding:'1px 7px', borderRadius:9999, background:meta.bg, color:meta.color, fontWeight:600 }}>{meta.label}</span>
                                  {a.status==='pending' && <span style={{ fontSize:10, padding:'1px 7px', borderRadius:9999, background:'#FEF3C7', color:'#D97706', fontWeight:600 }}>À faire</span>}
                                  {a.duration && <span style={{ fontSize:10, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:3 }}><Clock size={9}/>{a.duration}min</span>}
                                </div>
                                {(a.contact||a.company) && (
                                  <div style={{ display:'flex', gap:10, marginTop:3, flexWrap:'wrap' }}>
                                    {a.contact && <span style={{ fontSize:11, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:3 }}><User size={9}/>{a.contact}</span>}
                                    {a.company && <span style={{ fontSize:11, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:3 }}><Building2 size={9}/>{a.company}</span>}
                                  </div>
                                )}
                                {isEditing ? (
                                  <div style={{ marginTop:7 }}>
                                    <textarea value={noteText} onChange={e=>setNoteText(e.target.value)} rows={2}
                                      style={{ width:'100%', padding:'7px 10px', borderRadius:8, border:'1px solid var(--color-primary)', background:'var(--body-bg)', color:'var(--text-primary)', fontSize:12, outline:'none', resize:'none', boxSizing:'border-box' }}/>
                                    <div style={{ display:'flex', gap:6, marginTop:5 }}>
                                      <button onClick={()=>setEditingNote(null)} style={{ padding:'3px 10px', borderRadius:6, border:'1px solid var(--card-border)', background:'transparent', color:'var(--text-muted)', fontSize:11, cursor:'pointer' }}>Annuler</button>
                                      <button onClick={()=>saveNote(a.id)} style={{ padding:'3px 10px', borderRadius:6, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:11, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}><Check size={10}/>Sauvegarder</button>
                                    </div>
                                  </div>
                                ) : a.description ? (
                                  <p style={{ fontSize:12, color:'var(--text-muted)', margin:'4px 0 0', lineHeight:1.5 }}>{a.description}</p>
                                ) : null}
                              </div>
                              <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
                                <span style={{ fontSize:11, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{formatRelative(a.createdAt)}</span>
                                {a.type==='task' && (
                                  <button onClick={()=>toggleStatus(a.id)} style={{ width:22, height:22, borderRadius:6, border:`1px solid ${a.status==='done'?'#059669':'var(--card-border)'}`, background:a.status==='done'?'#ECFDF5':'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:a.status==='done'?'#059669':'var(--text-muted)' }}>
                                    <Check size={11}/>
                                  </button>
                                )}
                                <button onClick={()=>{ setEditingNote(a.id); setNoteText(a.description||''); }}
                                  style={{ width:22, height:22, borderRadius:6, border:'none', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)' }}>
                                  <Edit2 size={11}/>
                                </button>
                                <button onClick={()=>deleteActivity(a.id)}
                                  style={{ width:22, height:22, borderRadius:6, border:'none', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#EF4444' }}>
                                  <Trash2 size={11}/>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {/* Heatmap */}
          <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, padding:16 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', marginBottom:12, textTransform:'uppercase', letterSpacing:'0.05em' }}>7 derniers jours</div>
            <div style={{ display:'flex', gap:6, alignItems:'flex-end', justifyContent:'space-between' }}>
              {heatDays.map((d,i)=>{
                const pct = d.count/maxHeat;
                const dominant = d.types[0] as keyof typeof TYPE_META;
                const col = dominant ? TYPE_META[dominant]?.color : 'var(--color-primary)';
                return (
                  <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flex:1 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)' }}>{d.count||''}</div>
                    <div style={{ width:'100%', minHeight:6, height:`${Math.max(6,pct*64)}px`, borderRadius:4, background:d.count>0?col:'var(--card-border)', transition:'height .3s' }}/>
                    <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'capitalize' }}>{d.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Activity breakdown */}
          <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, padding:16 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', marginBottom:12, textTransform:'uppercase', letterSpacing:'0.05em' }}>Par type</div>
            {Object.entries(TYPE_META).map(([k,v])=>{
              const count = activities.filter(a=>a.type===k).length;
              const pct   = activities.length ? Math.round((count/activities.length)*100) : 0;
              return (
                <div key={k} style={{ marginBottom:9 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                    <span style={{ fontSize:12, color:'var(--text-secondary)' }}>{v.emoji} {v.label}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:v.color }}>{count}</span>
                  </div>
                  <div style={{ height:4, borderRadius:9999, background:'var(--card-border)', overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, background:v.color, borderRadius:9999, transition:'width .4s' }}/>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pending tasks */}
          <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, padding:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>À faire</div>
              <span style={{ fontSize:11, padding:'1px 7px', borderRadius:9999, background:pending.length>0?'#FEF3C7':'#ECFDF5', color:pending.length>0?'#D97706':'#059669', fontWeight:700 }}>{pending.length}</span>
            </div>
            {pending.length===0 ? (
              <p style={{ fontSize:12, color:'var(--text-muted)', textAlign:'center', padding:'8px 0' }}>Aucune tâche en attente 🎉</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {pending.slice(0,5).map(a=>{
                  const meta = TYPE_META[a.type as keyof typeof TYPE_META]||TYPE_META.note;
                  return (
                    <div key={a.id} style={{ display:'flex', alignItems:'center', gap:7, padding:'7px 9px', borderRadius:9, border:'1px solid var(--card-border)', background:'var(--body-bg)' }}>
                      <span style={{ fontSize:14 }}>{meta.emoji}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.title}</div>
                        {a.contact && <div style={{ fontSize:10, color:'var(--text-muted)' }}>{a.contact}</div>}
                      </div>
                      <button onClick={()=>toggleStatus(a.id)} style={{ width:20, height:20, borderRadius:5, border:'1px solid var(--card-border)', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', flexShrink:0 }}>
                        <Check size={10}/>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
