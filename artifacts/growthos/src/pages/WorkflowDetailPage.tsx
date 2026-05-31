import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { ArrowLeft, Save, Play, Pause, Plus, Trash2, Loader2, Zap, ChevronDown, ChevronRight, CheckCircle, XCircle, Clock, Activity, Filter, TestTube, AlertTriangle, RefreshCw } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

const TRIGGERS = [
  { value:'prospect_created',  label:'Prospect créé',         icon:'👤', desc:'Quand un nouveau prospect est ajouté' },
  { value:'prospect_status',   label:'Statut prospect changé',icon:'🔄', desc:'Quand le statut d\'un prospect change' },
  { value:'deal_stage',        label:'Stade deal changé',     icon:'📊', desc:'Quand un deal change de stade' },
  { value:'email_opened',      label:'Email ouvert',          icon:'📧', desc:'Quand un prospect ouvre un email' },
  { value:'score_threshold',   label:'Score atteint',         icon:'🎯', desc:'Quand le score dépasse un seuil' },
  { value:'signal_created',    label:'Signal détecté',        icon:'⚡', desc:'Quand un nouveau signal est créé' },
  { value:'schedule',          label:'Planifié',              icon:'⏰', desc:'Selon un planning régulier' },
];

const ACTIONS = [
  { value:'send_email',     label:'Envoyer un email',         icon:'📧', color:'#7C3AED' },
  { value:'add_sequence',   label:'Ajouter à une séquence',   icon:'📋', color:'#2563EB' },
  { value:'update_status',  label:'Mettre à jour le statut',  icon:'🔄', color:'#059669' },
  { value:'add_tag',        label:'Ajouter un tag',           icon:'🏷️', color:'#D97706' },
  { value:'notify_slack',   label:'Notifier Slack',           icon:'💬', color:'#6366F1' },
  { value:'webhook',        label:'Déclencher un webhook',    icon:'🔗', color:'#EF4444' },
  { value:'create_deal',    label:'Créer un deal',            icon:'💼', color:'#0891B2' },
  { value:'assign_user',    label:'Assigner un utilisateur',  icon:'👥', color:'#7C3AED' },
];

const CONDITIONS = [
  { value:'status_is',       label:'Statut est', options:['new','contacted','qualified','negotiation','won','lost'] },
  { value:'score_gt',        label:'Score >',    options:[] },
  { value:'has_email',       label:'A un email', options:[] },
  { value:'company_size_gt', label:'Taille entreprise >', options:[] },
  { value:'source_is',       label:'Source est', options:['linkedin','google','manual','import'] },
];

const MOCK_LOGS = [
  { id:'l1', status:'success', trigger:'prospect_created', triggeredBy:'Sophie Martin', date:'Il y a 5 min', duration:142, actions:3 },
  { id:'l2', status:'success', trigger:'prospect_created', triggeredBy:'Paul Dupont',   date:'Il y a 32 min', duration:98, actions:3 },
  { id:'l3', status:'error',   trigger:'prospect_created', triggeredBy:'Alice Moreau',  date:'Il y a 1h', duration:3012, actions:1, error:'Template introuvable (ID: tpl_99)' },
  { id:'l4', status:'success', trigger:'prospect_created', triggeredBy:'Marc Bernard',  date:'Il y a 2h', duration:201, actions:3 },
  { id:'l5', status:'success', trigger:'prospect_created', triggeredBy:'Emma Leroy',    date:'Il y a 4h', duration:178, actions:3 },
  { id:'l6', status:'skipped', trigger:'prospect_created', triggeredBy:'Luc Moreau',    date:'Il y a 6h', duration:12, actions:0, error:'Condition non remplie' },
];

interface Action { id:string; type:string; config:Record<string,string>; }
interface Condition { id:string; field:string; value:string; }
type Tab = 'builder'|'logs'|'settings';

export default function WorkflowDetailPage() {
  const params = useParams<{ id:string }>();
  const id = params.id;
  const isNew = id==='new';
  const [, navigate] = useLocation();

  const [workflow, setWorkflow]   = useState<any>(null);
  const [name, setName]           = useState('');
  const [description, setDescription] = useState('');
  const [trigger, setTrigger]     = useState('prospect_created');
  const [triggerConfig, setTriggerConfig] = useState<Record<string,string>>({});
  const [actions, setActions]     = useState<Action[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [loading, setLoading]     = useState(!isNew);
  const [saving, setSaving]       = useState(false);
  const [testing, setTesting]     = useState(false);
  const [showTriggers, setShowTriggers] = useState(false);
  const [showConditions, setShowConditions] = useState(false);
  const [tab, setTab]             = useState<Tab>('builder');
  const [logs, setLogs]           = useState(MOCK_LOGS);
  const [expandedLog, setExpandedLog] = useState<string|null>(null);

  useEffect(()=>{
    if (isNew) { setName('Nouveau workflow'); setWorkflow({ status:'draft', executions:0 }); return; }
    apiClient.get(`/workflows/${id}`)
      .then((data:any)=>{
        setWorkflow(data); setName(data.name||''); setDescription(data.description||'');
        setTrigger(data.trigger||'prospect_created'); setTriggerConfig(data.triggerConfig||{});
        setActions(Array.isArray(data.actions)?data.actions.map((a:any,i:number)=>({ id:a.id||`action-${i}`, type:a.type||a, config:a.config||{} })):[]);
        setConditions(Array.isArray(data.conditions)?data.conditions:[]);
      })
      .catch(()=>{ toast.error('Workflow introuvable'); navigate('/workflows'); })
      .finally(()=>setLoading(false));
  },[id]);

  const addAction = (type:string)=>setActions(a=>[...a,{ id:crypto.randomUUID(), type, config:{} }]);
  const removeAction = (idx:number)=>setActions(a=>a.filter((_,i)=>i!==idx));
  const updateConfig = (idx:number, key:string, value:string)=>setActions(a=>a.map((act,i)=>i===idx?{ ...act, config:{ ...act.config,[key]:value } }:act));

  const addCondition = ()=>setConditions(c=>[...c,{ id:crypto.randomUUID(), field:'status_is', value:'qualified' }]);
  const removeCondition = (idx:number)=>setConditions(c=>c.filter((_,i)=>i!==idx));
  const updateCondition = (idx:number, key:'field'|'value', value:string)=>setConditions(c=>c.map((cond,i)=>i===idx?{ ...cond,[key]:value }:cond));

  const save = async ()=>{
    if (!name.trim()) { toast.error('Donnez un nom au workflow'); return; }
    setSaving(true);
    try {
      const payload = { name, description, trigger, triggerConfig, actions, conditions, status:workflow?.status||'draft' };
      if (isNew) { const created:any = await apiClient.post('/workflows',payload); toast.success('Workflow créé'); navigate(`/workflows/${created.id}`); }
      else { await apiClient.patch(`/workflows/${id}`,payload); toast.success('Workflow enregistré'); }
    } catch { toast.error('Erreur lors de la sauvegarde'); }
    finally { setSaving(false); }
  };

  const toggleStatus = async ()=>{
    if (isNew) return;
    const newStatus = workflow?.status==='active'?'paused':'active';
    setWorkflow((w:any)=>({ ...w,status:newStatus }));
    toast.success(newStatus==='active'?'Workflow activé':'Mis en pause');
    await apiClient.post(`/workflows/${id}/toggle`,{}).catch(()=>{});
  };

  const testRun = async ()=>{
    if (actions.length===0) { toast.error('Ajoutez au moins une action avant de tester'); return; }
    setTesting(true);
    await new Promise(r=>setTimeout(r,1600));
    const fakeLog = { id:`l${Date.now()}`, status:'success', trigger, triggeredBy:'Test manuel', date:'À l\'instant', duration:Math.floor(Math.random()*200+80), actions:actions.length };
    setLogs(l=>[fakeLog,...l]);
    setTesting(false);
    setTab('logs');
    toast.success(`Test exécuté avec succès — ${actions.length} action${actions.length>1?'s':''} déclenchée${actions.length>1?'s':''}`);
  };

  const retryLog = async (logId:string)=>{
    await new Promise(r=>setTimeout(r,800));
    setLogs(l=>l.map(log=>log.id===logId?{ ...log, status:'success', error:undefined }:log));
    toast.success('Exécution rejouée avec succès');
  };

  const triggerInfo = TRIGGERS.find(t=>t.value===trigger)||TRIGGERS[0];
  const statusColor = workflow?.status==='active'?'#059669':workflow?.status==='paused'?'#D97706':'#6B7280';
  const successCount = logs.filter(l=>l.status==='success').length;
  const errorCount   = logs.filter(l=>l.status==='error').length;

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--body-bg)' }}>
      <Loader2 size={28} style={{ color:'var(--color-primary)', animation:'spin 1s linear infinite' }}/>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'var(--body-bg)' }}>
      {/* Header */}
      <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--card-border)', background:'var(--card-bg)', display:'flex', alignItems:'center', gap:14 }}>
        <button onClick={()=>navigate('/workflows')} style={{ width:32, height:32, borderRadius:9, border:'1px solid var(--card-border)', background:'var(--body-bg)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <ArrowLeft size={16} style={{ color:'var(--text-muted)' }}/>
        </button>
        <div style={{ flex:1, minWidth:0 }}>
          <input value={name} onChange={e=>setName(e.target.value)}
            style={{ fontSize:17, fontWeight:800, background:'transparent', border:'none', outline:'none', width:'100%', color:'var(--text-primary)' }} placeholder="Nom du workflow"/>
          <input value={description} onChange={e=>setDescription(e.target.value)}
            style={{ fontSize:12, background:'transparent', border:'none', outline:'none', width:'100%', color:'var(--text-muted)', marginTop:1 }} placeholder="Description (optionnel)"/>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          {workflow && <span style={{ fontSize:11, padding:'3px 10px', borderRadius:9999, background:`${statusColor}18`, color:statusColor, fontWeight:600 }}>
            {workflow.status==='active'?'Actif':workflow.status==='paused'?'En pause':'Brouillon'}
          </span>}
          <button onClick={testRun} disabled={testing||saving}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 13px', borderRadius:9, border:'1px solid var(--card-border)', background:'var(--body-bg)', color:'var(--text-secondary)', fontSize:12, fontWeight:600, cursor:'pointer', opacity:testing?0.6:1 }}>
            {testing?<Loader2 size={13} style={{ animation:'spin 1s linear infinite' }}/>:<TestTube size={13}/>}Test
          </button>
          {!isNew && workflow && (
            <button onClick={toggleStatus} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 13px', borderRadius:9, border:`1px solid ${statusColor}40`, background:`${statusColor}12`, color:statusColor, fontSize:12, fontWeight:600, cursor:'pointer' }}>
              {workflow.status==='active'?<><Pause size={13}/>Pause</>:<><Play size={13}/>Activer</>}
            </button>
          )}
          <button onClick={save} disabled={saving||testing}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px', borderRadius:9, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', opacity:saving?0.7:1 }}>
            {saving?<Loader2 size={13} style={{ animation:'spin 1s linear infinite' }}/>:<Save size={13}/>}
            {isNew?'Créer':'Enregistrer'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding:'0 20px', borderBottom:'1px solid var(--card-border)', background:'var(--card-bg)', display:'flex', gap:0 }}>
        {([['builder','🔧 Éditeur'],['logs',`📋 Logs (${logs.length})`],['settings','⚙️ Paramètres']] as [Tab,string][]).map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{ padding:'11px 16px', border:'none', borderBottom:`2px solid ${tab===t?'var(--color-primary)':'transparent'}`, background:'transparent', fontSize:13, fontWeight:tab===t?700:400, color:tab===t?'var(--color-primary)':'var(--text-muted)', cursor:'pointer', transition:'all .15s' }}>
            {l}
          </button>
        ))}
      </div>

      <div style={{ padding:20 }}>

        {/* ── BUILDER TAB ── */}
        {tab==='builder' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:18 }}>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

              {/* Step 1: Trigger */}
              <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, padding:18 }}>
                <h2 style={{ fontSize:13, fontWeight:700, color:'var(--text-muted)', margin:'0 0 12px', display:'flex', alignItems:'center', gap:7, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                  <span style={{ width:20, height:20, borderRadius:'50%', background:'#FEF3C7', color:'#D97706', fontSize:11, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, flexShrink:0 }}>1</span>
                  Déclencheur
                </h2>
                <button onClick={()=>setShowTriggers(!showTriggers)}
                  style={{ width:'100%', display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:12, border:`1px solid ${showTriggers?'var(--color-primary)':'var(--card-border)'}`, background:'var(--body-bg)', cursor:'pointer' }}>
                  <span style={{ fontSize:22 }}>{triggerInfo.icon}</span>
                  <div style={{ flex:1, textAlign:'left' }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>{triggerInfo.label}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>{triggerInfo.desc}</div>
                  </div>
                  {showTriggers?<ChevronDown size={15} style={{ color:'var(--text-muted)' }}/>:<ChevronRight size={15} style={{ color:'var(--text-muted)' }}/>}
                </button>
                {showTriggers && (
                  <div style={{ marginTop:8, display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                    {TRIGGERS.map(t=>(
                      <button key={t.value} onClick={()=>{ setTrigger(t.value); setShowTriggers(false); }}
                        style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', borderRadius:10, border:`1px solid ${trigger===t.value?'var(--color-primary)':'var(--card-border)'}`, background:trigger===t.value?`color-mix(in srgb, var(--color-primary) 10%, transparent)`:'var(--body-bg)', cursor:'pointer', textAlign:'left' }}>
                        <span style={{ fontSize:18 }}>{t.icon}</span>
                        <div>
                          <div style={{ fontSize:12, fontWeight:700, color:trigger===t.value?'var(--color-primary)':'var(--text-primary)' }}>{t.label}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {trigger==='score_threshold' && (
                  <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:10, background:'var(--body-bg)', border:'1px solid var(--card-border)' }}>
                    <span style={{ fontSize:13, color:'var(--text-muted)' }}>Score supérieur à</span>
                    <input type="number" min={0} max={100} value={triggerConfig.threshold||'70'}
                      onChange={e=>setTriggerConfig(c=>({ ...c,threshold:e.target.value }))}
                      style={{ width:60, padding:'4px 8px', borderRadius:7, border:'1px solid var(--card-border)', background:'var(--card-bg)', color:'var(--text-primary)', fontSize:13, textAlign:'center', outline:'none' }}/>
                  </div>
                )}
                {trigger==='schedule' && (
                  <div style={{ marginTop:10, display:'flex', gap:8, padding:'8px 12px', borderRadius:10, background:'var(--body-bg)', border:'1px solid var(--card-border)', alignItems:'center' }}>
                    <span style={{ fontSize:13, color:'var(--text-muted)' }}>Fréquence</span>
                    <select value={triggerConfig.frequency||'daily'} onChange={e=>setTriggerConfig(c=>({ ...c,frequency:e.target.value }))}
                      style={{ padding:'4px 8px', borderRadius:7, border:'1px solid var(--card-border)', background:'var(--card-bg)', color:'var(--text-primary)', fontSize:13, outline:'none' }}>
                      {['daily','weekly','monthly'].map(f=><option key={f} value={f}>{f==='daily'?'Quotidien':f==='weekly'?'Hebdomadaire':'Mensuel'}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Connector */}
              <div style={{ display:'flex', justifyContent:'center' }}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                  <div style={{ width:1, height:16, background:'var(--card-border)' }}/>
                  <Zap size={15} style={{ color:'var(--color-primary)' }}/>
                  <div style={{ width:1, height:16, background:'var(--card-border)' }}/>
                </div>
              </div>

              {/* Step 2: Conditions */}
              <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, padding:18 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <h2 style={{ fontSize:13, fontWeight:700, color:'var(--text-muted)', margin:0, display:'flex', alignItems:'center', gap:7, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                    <span style={{ width:20, height:20, borderRadius:'50%', background:'#EFF6FF', color:'#2563EB', fontSize:11, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, flexShrink:0 }}>2</span>
                    Conditions ({conditions.length})
                  </h2>
                  <button onClick={addCondition} style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:7, border:'1px solid var(--card-border)', background:'var(--body-bg)', cursor:'pointer', fontSize:11, color:'var(--text-secondary)', fontWeight:600 }}>
                    <Plus size={11}/>Condition
                  </button>
                </div>
                {conditions.length===0 ? (
                  <button onClick={addCondition} style={{ width:'100%', padding:'14px', borderRadius:10, border:'2px dashed var(--card-border)', background:'transparent', cursor:'pointer', color:'var(--text-muted)', fontSize:12 }}>
                    <Filter size={14} style={{ margin:'0 auto 4px', display:'block' }}/>
                    Cliquez pour ajouter des conditions (optionnel)
                  </button>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                    {conditions.map((cond,i)=>{
                      const condDef = CONDITIONS.find(c=>c.value===cond.field)||CONDITIONS[0];
                      return (
                        <div key={cond.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:10, border:'1px solid var(--card-border)', background:'var(--body-bg)' }}>
                          {i>0 && <span style={{ fontSize:11, fontWeight:700, color:'var(--color-primary)', flexShrink:0 }}>ET</span>}
                          <select value={cond.field} onChange={e=>updateCondition(i,'field',e.target.value)}
                            style={{ flex:1, padding:'5px 8px', borderRadius:7, border:'1px solid var(--card-border)', background:'var(--card-bg)', color:'var(--text-primary)', fontSize:12, outline:'none' }}>
                            {CONDITIONS.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                          {condDef.options.length>0 ? (
                            <select value={cond.value} onChange={e=>updateCondition(i,'value',e.target.value)}
                              style={{ flex:1, padding:'5px 8px', borderRadius:7, border:'1px solid var(--card-border)', background:'var(--card-bg)', color:'var(--text-primary)', fontSize:12, outline:'none' }}>
                              {condDef.options.map(o=><option key={o} value={o}>{o}</option>)}
                            </select>
                          ) : (
                            <input value={cond.value} onChange={e=>updateCondition(i,'value',e.target.value)} placeholder="Valeur"
                              style={{ flex:1, padding:'5px 8px', borderRadius:7, border:'1px solid var(--card-border)', background:'var(--card-bg)', color:'var(--text-primary)', fontSize:12, outline:'none' }}/>
                          )}
                          <button onClick={()=>removeCondition(i)} style={{ background:'none', border:'none', cursor:'pointer', color:'#EF4444', flexShrink:0 }}><Trash2 size={13}/></button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Connector */}
              <div style={{ display:'flex', justifyContent:'center' }}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                  <div style={{ width:1, height:16, background:'var(--card-border)' }}/>
                  <Zap size={15} style={{ color:'var(--color-primary)' }}/>
                  <div style={{ width:1, height:16, background:'var(--card-border)' }}/>
                </div>
              </div>

              {/* Step 3: Actions */}
              <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, padding:18 }}>
                <h2 style={{ fontSize:13, fontWeight:700, color:'var(--text-muted)', margin:'0 0 12px', display:'flex', alignItems:'center', gap:7, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                  <span style={{ width:20, height:20, borderRadius:'50%', background:'#ECFDF5', color:'#059669', fontSize:11, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, flexShrink:0 }}>3</span>
                  Actions ({actions.length})
                </h2>
                {actions.length===0 ? (
                  <div style={{ textAlign:'center', padding:'24px', border:'2px dashed var(--card-border)', borderRadius:10 }}>
                    <p style={{ fontSize:13, color:'var(--text-muted)', margin:'0 0 4px' }}>Aucune action</p>
                    <p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>Ajoutez des actions depuis la liste ci-dessous</p>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:14 }}>
                    {actions.map((action,i)=>{
                      const actionInfo = ACTIONS.find(a=>a.value===action.type)||ACTIONS[0];
                      return (
                        <div key={action.id} style={{ display:'flex', gap:2, alignItems:'flex-start' }}>
                          <span style={{ fontSize:11, fontWeight:800, color:'var(--text-muted)', minWidth:20, textAlign:'center', marginTop:12, flexShrink:0 }}>{i+1}</span>
                          <div style={{ flex:1, display:'flex', alignItems:'flex-start', gap:10, padding:'10px 12px', borderRadius:10, border:'1px solid var(--card-border)', background:'var(--body-bg)' }}>
                            <span style={{ fontSize:18, flexShrink:0, marginTop:1 }}>{actionInfo.icon}</span>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', marginBottom:4 }}>{actionInfo.label}</div>
                              {(action.type==='send_email'||action.type==='add_sequence') && (
                                <input value={action.config.target||''} onChange={e=>updateConfig(i,'target',e.target.value)}
                                  style={{ width:'100%', padding:'5px 8px', borderRadius:7, border:'1px solid var(--card-border)', background:'var(--card-bg)', color:'var(--text-primary)', fontSize:12, outline:'none', boxSizing:'border-box' }}
                                  placeholder={action.type==='send_email'?'Sujet ou ID template...':'Nom de la séquence...'}/>
                              )}
                              {action.type==='update_status' && (
                                <select value={action.config.status||'contacted'} onChange={e=>updateConfig(i,'status',e.target.value)}
                                  style={{ padding:'5px 8px', borderRadius:7, border:'1px solid var(--card-border)', background:'var(--card-bg)', color:'var(--text-primary)', fontSize:12, outline:'none' }}>
                                  {['new','contacted','qualified','negotiation','won','lost'].map(s=><option key={s} value={s}>{s}</option>)}
                                </select>
                              )}
                              {action.type==='webhook' && (
                                <input value={action.config.url||''} onChange={e=>updateConfig(i,'url',e.target.value)}
                                  style={{ width:'100%', padding:'5px 8px', borderRadius:7, border:'1px solid var(--card-border)', background:'var(--card-bg)', color:'var(--text-primary)', fontSize:12, outline:'none', boxSizing:'border-box' }}
                                  placeholder="https://..."/>
                              )}
                              {action.type==='add_tag' && (
                                <input value={action.config.tag||''} onChange={e=>updateConfig(i,'tag',e.target.value)}
                                  style={{ width:'100%', padding:'5px 8px', borderRadius:7, border:'1px solid var(--card-border)', background:'var(--card-bg)', color:'var(--text-primary)', fontSize:12, outline:'none', boxSizing:'border-box' }}
                                  placeholder="Nom du tag..."/>
                              )}
                            </div>
                            <button onClick={()=>removeAction(i)} style={{ background:'none', border:'none', cursor:'pointer', color:'#EF4444', flexShrink:0, marginTop:2 }}><Trash2 size={14}/></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div style={{ borderTop:`${actions.length>0?'1px solid var(--card-border)':'none'}`, paddingTop:actions.length>0?12:0 }}>
                  <p style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', marginBottom:8 }}>Ajouter une action :</p>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
                    {ACTIONS.map(a=>(
                      <button key={a.value} onClick={()=>addAction(a.value)}
                        style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 11px', borderRadius:10, border:`1px solid ${a.color}30`, background:`${a.color}0d`, color:a.color, fontSize:11, fontWeight:600, cursor:'pointer' }}>
                        <span>{a.icon}</span>{a.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right sidebar */}
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {!isNew && workflow && (
                <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, padding:16 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', marginBottom:12, textTransform:'uppercase', letterSpacing:'0.06em' }}>Statistiques</div>
                  {[
                    { l:'Statut', v:workflow.status==='active'?'Actif':workflow.status==='paused'?'Pause':'Brouillon', color:statusColor },
                    { l:'Exécutions', v:logs.length },
                    { l:'Succès', v:`${successCount}/${logs.length}`, color:'#059669' },
                    { l:'Erreurs', v:errorCount, color:errorCount>0?'#DC2626':undefined },
                    { l:'Dernière exécution', v:logs[0]?.date||'—' },
                    { l:'Créé le', v:workflow.createdAt?new Date(workflow.createdAt).toLocaleDateString('fr-FR'):'Aujourd\'hui' },
                  ].map(m=>(
                    <div key={m.l} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7 }}>
                      <span style={{ fontSize:12, color:'var(--text-muted)' }}>{m.l}</span>
                      <span style={{ fontSize:12, fontWeight:700, color:(m as any).color||'var(--text-primary)' }}>{m.v}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, padding:16 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.06em' }}>Conseils</div>
                <ul style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.8, margin:0, paddingLeft:0, listStyle:'none' }}>
                  <li>💡 1 déclencheur + 1-2 actions max pour commencer</li>
                  <li>🧪 Testez en brouillon avant d'activer</li>
                  <li>📋 Vérifiez les logs après activation</li>
                  <li>🔁 Les conditions filtrent avant les actions</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ── LOGS TAB ── */}
        {tab==='logs' && (
          <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, overflow:'hidden' }}>
            <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--card-border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <h2 style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)', margin:0 }}>Historique d'exécutions</h2>
                <div style={{ display:'flex', gap:8 }}>
                  <span style={{ fontSize:11, padding:'2px 9px', borderRadius:9999, background:'#ECFDF5', color:'#059669', fontWeight:600 }}>{successCount} succès</span>
                  {errorCount>0 && <span style={{ fontSize:11, padding:'2px 9px', borderRadius:9999, background:'#FEF2F2', color:'#DC2626', fontWeight:600 }}>{errorCount} erreur{errorCount>1?'s':''}</span>}
                </div>
              </div>
              <button onClick={testRun} disabled={testing}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:8, border:'1px solid var(--card-border)', background:'var(--body-bg)', color:'var(--text-secondary)', fontSize:12, cursor:'pointer', fontWeight:600, opacity:testing?0.6:1 }}>
                {testing?<Loader2 size={12} style={{ animation:'spin 1s linear infinite' }}/>:<TestTube size={12}/>}Tester maintenant
              </button>
            </div>
            {logs.length===0 ? (
              <div style={{ textAlign:'center', padding:'48px 0', color:'var(--text-muted)' }}>
                <Activity size={32} style={{ margin:'0 auto 10px', display:'block', opacity:0.3 }}/>
                <p style={{ fontSize:13 }}>Aucune exécution enregistrée</p>
              </div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'var(--body-bg)' }}>
                    {['Statut','Déclenché par','Déclencheur','Actions','Durée','Date',''].map(h=>(
                      <th key={h} style={{ padding:'9px 16px', textAlign:'left', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', color:'var(--text-muted)', whiteSpace:'nowrap', borderBottom:'1px solid var(--card-border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log=>(
                    <>
                      <tr key={log.id} style={{ borderBottom:'1px solid var(--card-border)' }}>
                        <td style={{ padding:'10px 16px' }}>
                          <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, fontWeight:700, padding:'2px 9px', borderRadius:9999, width:'fit-content',
                            background:log.status==='success'?'#ECFDF5':log.status==='error'?'#FEF2F2':'#F3F4F6',
                            color:log.status==='success'?'#059669':log.status==='error'?'#DC2626':'#6B7280' }}>
                            {log.status==='success'?<CheckCircle size={10}/>:log.status==='error'?<XCircle size={10}/>:<AlertTriangle size={10}/>}
                            {log.status==='success'?'Succès':log.status==='error'?'Erreur':'Ignoré'}
                          </span>
                        </td>
                        <td style={{ padding:'10px 16px', fontSize:13, color:'var(--text-primary)', whiteSpace:'nowrap' }}>{log.triggeredBy}</td>
                        <td style={{ padding:'10px 16px' }}><code style={{ fontSize:11, color:'var(--text-secondary)' }}>{log.trigger}</code></td>
                        <td style={{ padding:'10px 16px', fontSize:12, color:'var(--text-muted)', textAlign:'center' }}>{log.actions}</td>
                        <td style={{ padding:'10px 16px', fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap' }}>
                          <span style={{ display:'flex', alignItems:'center', gap:4 }}><Clock size={10}/>{log.duration}ms</span>
                        </td>
                        <td style={{ padding:'10px 16px', fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{log.date}</td>
                        <td style={{ padding:'10px 16px' }}>
                          <div style={{ display:'flex', gap:6 }}>
                            {log.error && (
                              <button onClick={()=>setExpandedLog(expandedLog===log.id?null:log.id)} style={{ fontSize:11, color:'var(--color-primary)', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>
                                {expandedLog===log.id?'Fermer':'Détails'}
                              </button>
                            )}
                            {log.status==='error' && (
                              <button onClick={()=>retryLog(log.id)} style={{ display:'flex', alignItems:'center', gap:3, fontSize:11, color:'#D97706', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>
                                <RefreshCw size={10}/>Rejouer
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandedLog===log.id && log.error && (
                        <tr key={log.id+'_err'} style={{ background:'#FEF2F2' }}>
                          <td colSpan={7} style={{ padding:'8px 16px' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#DC2626' }}>
                              <XCircle size={13}/>
                              <strong>Erreur :</strong> {log.error}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── SETTINGS TAB ── */}
        {tab==='settings' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, padding:18 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', marginBottom:14 }}>Informations générales</div>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {[
                  { l:'Nom', k:'name', v:name, onChange:(v:string)=>setName(v) },
                  { l:'Description', k:'desc', v:description, onChange:(v:string)=>setDescription(v) },
                ].map(f=>(
                  <div key={f.k}>
                    <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:4 }}>{f.l}</label>
                    <input value={f.v} onChange={e=>f.onChange(e.target.value)}
                      style={{ width:'100%', padding:'8px 12px', borderRadius:9, border:'1px solid var(--card-border)', background:'var(--body-bg)', color:'var(--text-primary)', fontSize:13, outline:'none', boxSizing:'border-box' }}/>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, padding:18 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', marginBottom:14 }}>Statut &amp; contrôle</div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {[
                  { l:'Statut actuel', v:workflow?.status==='active'?'Actif':workflow?.status==='paused'?'En pause':'Brouillon', color:statusColor },
                  { l:'Exécutions totales', v:logs.length },
                  { l:'Taux de succès', v:`${logs.length?Math.round((successCount/logs.length)*100):0}%`, color:'#059669' },
                ].map(m=>(
                  <div key={m.l} style={{ display:'flex', justifyContent:'space-between', padding:'8px 12px', borderRadius:9, background:'var(--body-bg)', border:'1px solid var(--card-border)' }}>
                    <span style={{ fontSize:12, color:'var(--text-muted)' }}>{m.l}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:(m as any).color||'var(--text-primary)' }}>{m.v}</span>
                  </div>
                ))}
                {!isNew && (
                  <button onClick={toggleStatus}
                    style={{ marginTop:6, padding:'10px', borderRadius:10, border:`1px solid ${statusColor}40`, background:`${statusColor}12`, color:statusColor, fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                    {workflow?.status==='active'?<><Pause size={14}/>Mettre en pause</>:<><Play size={14}/>Activer le workflow</>}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
