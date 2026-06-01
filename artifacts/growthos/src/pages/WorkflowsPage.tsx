import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import {
  Plus, Play, Pause, ChevronRight, Zap, Clock, CheckCircle, X,
  ArrowRight, Trash2, Copy, Search, TrendingUp, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';

const TRIGGERS = [
  { id:'prospect_created',   icon:'👤', label:'Nouveau prospect',       desc:'Déclenche dès qu\'un prospect est créé' },
  { id:'email_opened',       icon:'📧', label:'Email ouvert',           desc:'Quand un prospect ouvre un email' },
  { id:'email_replied',      icon:'💬', label:'Email répondu',          desc:'Quand un prospect répond à un email' },
  { id:'score_threshold',    icon:'🎯', label:'Score > seuil',          desc:'Quand le score dépasse un seuil défini' },
  { id:'deal_stage',         icon:'📊', label:'Deal changé de stage',   desc:'Quand un deal change d\'étape pipeline' },
  { id:'deal_won',           icon:'🏆', label:'Deal gagné',             desc:'Quand un deal est marqué Gagné' },
  { id:'signal_detected',    icon:'⚡', label:'Signal détecté',         desc:'Quand un nouveau signal est détecté' },
  { id:'schedule',           icon:'⏰', label:'Planifié',               desc:'Déclenchement périodique (cron)' },
  { id:'form_submitted',     icon:'📝', label:'Formulaire soumis',      desc:'Quand un formulaire inbound est rempli' },
];

const ACTIONS = [
  { id:'send_email',      icon:'📧', label:'Envoyer un email',          color:'#7C3AED' },
  { id:'add_sequence',    icon:'📨', label:'Ajouter à une séquence',    color:'#7C3AED' },
  { id:'update_status',   icon:'🔄', label:'Changer le statut',         color:'#2563EB' },
  { id:'add_tag',         icon:'🏷️', label:'Ajouter un tag',            color:'#059669' },
  { id:'notify_slack',    icon:'💬', label:'Notification Slack',        color:'#1D9BF0' },
  { id:'notify_email',    icon:'📬', label:'Notification email équipe', color:'#D97706' },
  { id:'webhook',         icon:'🔗', label:'Appel Webhook',             color:'#6B7280' },
  { id:'create_task',     icon:'✅', label:'Créer une tâche',           color:'#065F46' },
  { id:'assign_prospect', icon:'👥', label:'Assigner à un utilisateur', color:'#9333EA' },
  { id:'update_score',    icon:'📈', label:'Modifier le score',         color:'#DC2626' },
];

const TEMPLATES = [
  { name:'Bienvenue nouveau prospect', trigger:'prospect_created', actions:['send_email','add_sequence'], desc:'Email auto + ajout à séquence Cold B2B' },
  { name:'Alerte score élevé', trigger:'score_threshold',  actions:['notify_email','add_tag'],   desc:'Notifie l\'équipe quand score > 80' },
  { name:'Email ouvert → Qualifier', trigger:'email_opened',   actions:['update_status','create_task'],desc:'Passe en "Qualifié" si email ouvert 3×' },
  { name:'Deal gagné → CRM Sync', trigger:'deal_won',       actions:['webhook','notify_slack'],   desc:'Sync CRM + alerte Slack sur victoire' },
];

const MOCK_WORKFLOWS: any[] = [
  { id:'1', name:'Nouveau prospect → Email bienvenue', trigger:'prospect_created', actions:['send_email','add_sequence'], status:'active',  executions:127, lastRun:'il y a 5 min', errors:0 },
  { id:'2', name:'Score > 80 → Notification équipe',  trigger:'score_threshold',  actions:['notify_email','add_tag'],   status:'active',  executions:43,  lastRun:'il y a 1h',   errors:0 },
  { id:'3', name:'Email ouvert × 3 → Passage qualifié',trigger:'email_opened',    actions:['update_status','webhook'],  status:'paused',  executions:0,   lastRun:'—',           errors:0 },
  { id:'4', name:'Deal gagné → CRM Sync',             trigger:'deal_won',         actions:['webhook','send_email'],     status:'active',  executions:18,  lastRun:'il y a 2j',   errors:2 },
  { id:'5', name:'Signal détecté → Tag + Tâche',      trigger:'signal_detected',  actions:['add_tag','create_task'],    status:'active',  executions:61,  lastRun:'il y a 3h',   errors:0 },
];

const ACTION_LABELS: Record<string,string> = ACTIONS.reduce((acc,a)=>({...acc,[a.id]:a.label}),{});
const ACTION_COLORS: Record<string,string> = ACTIONS.reduce((acc,a)=>({...acc,[a.id]:a.color}),{});
const TRIGGER_META: Record<string,{icon:string;label:string}> = TRIGGERS.reduce((acc,t)=>({...acc,[t.id]:{icon:t.icon,label:t.label}}),{} as any);

function NewWorkflowModal({ onClose, onCreate }: { onClose:()=>void; onCreate:(w:any)=>void }) {
  const [step, setStep] = useState<1|2|3>(1);
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState('');
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const toggleAction = (id:string) =>
    setSelectedActions(a=>a.includes(id)?a.filter(x=>x!==id):[...a,id]);

  const applyTemplate = (tpl:typeof TEMPLATES[0]) => {
    setTrigger(tpl.trigger);
    setSelectedActions(tpl.actions);
    setName(tpl.name);
    setStep(3);
  };

  const create = async () => {
    if(!name.trim()) { toast.error('Nom requis'); return; }
    if(!trigger) { toast.error('Choisissez un déclencheur'); return; }
    if(selectedActions.length===0) { toast.error('Au moins une action requise'); return; }
    setLoading(true);
    const wf = { name, trigger, actions:selectedActions, status:'active', executions:0, lastRun:'—', errors:0 };
    try {
      const saved = await apiClient.post('/workflows', wf).catch(()=>null);
      onCreate(saved || { ...wf, id: Date.now().toString() });
      toast.success('Workflow créé et activé');
      onClose();
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600"><Zap size={16}/></div>
            <h2 className="text-base font-bold text-gray-900">Nouveau workflow</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              {[1,2,3].map(n=>(
                <div key={n} className="flex items-center gap-1">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${step>=n?'bg-amber-500 text-white':'bg-gray-100 text-gray-400'}`}>{n}</span>
                  {n<3&&<div className={`w-8 h-0.5 ${step>n?'bg-amber-500':'bg-gray-200'}`}/>}
                </div>
              ))}
            </div>
            <button onClick={onClose}><X size={18} className="text-gray-400"/></button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {/* Step 1: Template ou blank */}
          {step===1 && (
            <>
              <h3 className="font-semibold text-gray-800 mb-1">Partez d'un template</h3>
              <p className="text-xs text-gray-400 mb-4">Ou créez un workflow entièrement personnalisé</p>
              <div className="space-y-2 mb-5">
                {TEMPLATES.map((tpl,i)=>(
                  <button key={i} onClick={()=>applyTemplate(tpl)}
                    className="w-full flex items-start gap-3 p-3.5 rounded-xl border-2 border-gray-200 hover:border-amber-300 hover:bg-amber-50 transition-all text-left">
                    <span className="text-xl flex-shrink-0">{TRIGGER_META[tpl.trigger]?.icon||'⚡'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-gray-900">{tpl.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{tpl.desc}</div>
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {tpl.actions.map(a=>(
                          <span key={a} className="text-xs px-1.5 py-0.5 rounded-md font-medium" style={{background:`${ACTION_COLORS[a]}18`,color:ACTION_COLORS[a]}}>{ACTION_LABELS[a]||a}</span>
                        ))}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-gray-400 flex-shrink-0 mt-1"/>
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Annuler</button>
                <button onClick={()=>setStep(2)} className="flex-1 py-2.5 border-2 border-amber-300 text-amber-700 rounded-xl text-sm font-medium hover:bg-amber-50">Créer depuis zéro →</button>
              </div>
            </>
          )}

          {/* Step 2: Trigger + Actions */}
          {step===2 && (
            <>
              <div className="mb-5">
                <h3 className="font-semibold text-gray-800 mb-3">Déclencheur</h3>
                <div className="grid grid-cols-2 gap-2">
                  {TRIGGERS.map(t=>(
                    <button key={t.id} onClick={()=>setTrigger(t.id)}
                      className={`flex items-start gap-2.5 p-3 rounded-xl border-2 text-left transition-all ${trigger===t.id?'border-amber-400 bg-amber-50':'border-gray-200 hover:border-gray-300'}`}>
                      <span className="text-lg flex-shrink-0">{t.icon}</span>
                      <div>
                        <div className="font-semibold text-xs text-gray-900">{t.label}</div>
                        <div className="text-xs text-gray-400">{t.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-5">
                <h3 className="font-semibold text-gray-800 mb-3">Actions <span className="text-xs font-normal text-gray-400">(sélection multiple)</span></h3>
                <div className="grid grid-cols-2 gap-2">
                  {ACTIONS.map(a=>{
                    const selected = selectedActions.includes(a.id);
                    return (
                      <button key={a.id} onClick={()=>toggleAction(a.id)}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-left transition-all ${selected?'border-2':'border-gray-200 hover:border-gray-300'}`}
                        style={selected?{borderColor:a.color,background:`${a.color}08`}:{}}>
                        <span className="text-base">{a.icon}</span>
                        <span className="text-xs font-medium" style={{color:selected?a.color:'var(--text-secondary)'}}>{a.label}</span>
                        {selected&&<CheckCircle size={12} className="ml-auto flex-shrink-0" style={{color:a.color}}/>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={()=>setStep(1)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">← Retour</button>
                <button onClick={()=>setStep(3)} disabled={!trigger||selectedActions.length===0}
                  className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium disabled:opacity-50">Suivant →</button>
              </div>
            </>
          )}

          {/* Step 3: Name + preview */}
          {step===3 && (
            <>
              <h3 className="font-semibold text-gray-800 mb-4">Nommez votre workflow</h3>

              {/* Visual preview */}
              <div className="rounded-xl bg-gray-50 p-4 mb-4 flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-amber-300 bg-amber-50">
                  <span>{TRIGGER_META[trigger]?.icon||'⚡'}</span>
                  <span className="text-xs font-semibold text-amber-800">{TRIGGER_META[trigger]?.label||trigger}</span>
                </div>
                {selectedActions.map((a,i)=>(
                  <div key={a} className="flex items-center gap-1.5">
                    <ArrowRight size={14} className="text-gray-400 flex-shrink-0"/>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold" style={{background:`${ACTION_COLORS[a]||'#6B7280'}18`,color:ACTION_COLORS[a]||'#6B7280',border:`1.5px solid ${ACTION_COLORS[a]||'#6B7280'}40`}}>
                      <span>{ACTIONS.find(x=>x.id===a)?.icon||'⚡'}</span>
                      {ACTION_LABELS[a]||a}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mb-5">
                <label className="block text-xs font-medium text-gray-500 mb-1">Nom du workflow *</label>
                <input value={name} onChange={e=>setName(e.target.value)} autoFocus
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="Ex: Nurturing prospect score élevé"/>
              </div>

              <div className="flex gap-3">
                <button onClick={()=>setStep(2)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">← Retour</button>
                <button onClick={create} disabled={!name.trim()||loading}
                  className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading?<><Clock size={14} className="animate-spin"/>Création...</>:<><Zap size={14}/>Créer & Activer</>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WorkflowsPage() {
  const [, navigate] = useLocation();
  const [workflows, setWorkflows] = useState(MOCK_WORKFLOWS);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(()=>{
    apiClient.get('/workflows').then((d:any)=>{
      const l = Array.isArray(d)?d:d?.data||[];
      if(l.length>0) setWorkflows(l.map((w:any)=>({...w,actions:Array.isArray(w.actions)?w.actions:[],trigger:w.trigger||'prospect_created',errors:w.errors||0})));
    }).catch(()=>{});
  },[]);

  const toggle = async (id:string, e:React.MouseEvent) => {
    e.stopPropagation();
    setWorkflows(ws=>ws.map(w=>w.id===id?{...w,status:w.status==='active'?'paused':'active'}:w));
    await apiClient.patch(`/workflows/${id}`, {}).catch(()=>{});
    toast.success('Statut mis à jour');
  };

  const duplicate = (wf:any, e:React.MouseEvent) => {
    e.stopPropagation();
    const copy = {...wf, id:Date.now().toString(), name:`${wf.name} (copie)`, status:'paused', executions:0, errors:0};
    setWorkflows(ws=>[...ws,copy]);
    toast.success('Workflow dupliqué');
  };

  const remove = (id:string, e:React.MouseEvent) => {
    e.stopPropagation();
    if(!confirm('Supprimer ce workflow ?')) return;
    setWorkflows(ws=>ws.filter(w=>w.id!==id));
    apiClient.delete(`/workflows/${id}`).catch(()=>{});
    toast.success('Workflow supprimé');
  };

  const filtered = workflows.filter(w=>{
    const q = search.toLowerCase();
    const matchSearch = !q || `${w.name} ${w.trigger}`.toLowerCase().includes(q);
    const matchStatus = statusFilter==='all' || w.status===statusFilter;
    return matchSearch && matchStatus;
  });

  const active = workflows.filter(w=>w.status==='active').length;
  const totalExec = workflows.reduce((s,w)=>s+w.executions,0);
  const withErrors = workflows.filter(w=>w.errors>0).length;

  return (
    <div className="min-h-screen p-6" style={{background:'var(--body-bg)'}}>
      {showNew && <NewWorkflowModal onClose={()=>setShowNew(false)} onCreate={w=>setWorkflows(ws=>[w,...ws])}/>}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>Workflows</h1>
          <p className="text-sm" style={{color:'var(--text-muted)'}}>{active} actif{active>1?'s':''} · {totalExec} exécutions totales</p>
        </div>
        <button onClick={()=>setShowNew(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{background:'var(--color-primary)'}}>
          <Plus size={14}/>Nouveau workflow
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          {l:'Actifs',           v:active,                                             icon:<Zap size={16}/>,          color:'text-teal-600 bg-teal-50'},
          {l:'Exécutions total', v:totalExec,                                          icon:<CheckCircle size={16}/>,  color:'text-green-600 bg-green-50'},
          {l:'En pause',        v:workflows.length-active,                             icon:<Clock size={16}/>,        color:'text-amber-600 bg-amber-50'},
          {l:'Avec erreurs',    v:withErrors, icon:<AlertTriangle size={16}/>,         color:withErrors>0?'text-red-600 bg-red-50':'text-gray-400 bg-gray-50'},
        ].map((m,i)=>(
          <div key={i} className="rounded-2xl border p-4 flex items-center gap-3" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${m.color}`}>{m.icon}</div>
            <div>
              <div className="text-xl font-bold" style={{color:'var(--text-primary)'}}>{m.v}</div>
              <div className="text-xs" style={{color:'var(--text-muted)'}}>{m.l}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{color:'var(--text-muted)'}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un workflow..."
            className="w-full pl-8 pr-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            style={{background:'var(--card-bg)',border:'1px solid var(--card-border)',color:'var(--text-primary)'}}/>
        </div>
        <div className="flex gap-1 p-1 rounded-xl" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
          {[{v:'all',l:'Tous'},{v:'active',l:'Actifs'},{v:'paused',l:'En pause'}].map(f=>(
            <button key={f.v} onClick={()=>setStatusFilter(f.v)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={statusFilter===f.v?{background:'var(--color-primary)',color:'#fff'}:{color:'var(--text-muted)',background:'transparent',border:'none',cursor:'pointer'}}>
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length===0 ? (
        <div className="rounded-2xl border py-16 text-center" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
          <Zap size={40} className="mx-auto mb-3" style={{color:'var(--card-border)'}}/>
          <p className="text-sm mb-4" style={{color:'var(--text-muted)'}}>Aucun workflow trouvé</p>
          <button onClick={()=>setShowNew(true)} className="px-4 py-2 rounded-xl text-sm text-white" style={{background:'var(--color-primary)'}}>
            + Créer un workflow
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(wf=>{
            const tm = TRIGGER_META[wf.trigger]||{icon:'⚡',label:wf.trigger};
            return (
              <div key={wf.id} onClick={()=>navigate(`/workflows/${wf.id}`)}
                className="rounded-2xl border p-4 cursor-pointer transition-all hover:shadow-md"
                style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}
                onMouseEnter={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--color-primary)'}
                onMouseLeave={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--card-border)'}>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{background:'var(--body-bg)'}}>{tm.icon}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-sm" style={{color:'var(--text-primary)'}}>{wf.name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={wf.status==='active'?{background:'#ECFDF5',color:'#059669'}:{background:'#F3F4F6',color:'#6B7280'}}>
                        {wf.status==='active'?'Actif':'En pause'}
                      </span>
                      {wf.errors>0&&(
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium flex items-center gap-1">
                          <AlertTriangle size={10}/>{wf.errors} erreur{wf.errors>1?'s':''}
                        </span>
                      )}
                    </div>

                    {/* Flow visualization */}
                    <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700">
                        <span>{tm.icon}</span>{tm.label}
                      </div>
                      {wf.actions.map((a:string,i:number)=>(
                        <div key={a} className="flex items-center gap-1">
                          <ArrowRight size={11} className="text-gray-300"/>
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium"
                            style={{background:`${ACTION_COLORS[a]||'#6B7280'}18`,color:ACTION_COLORS[a]||'#6B7280'}}>
                            <span>{ACTIONS.find(x=>x.id===a)?.icon||'⚡'}</span>
                            {ACTION_LABELS[a]||a}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-4 text-xs" style={{color:'var(--text-muted)'}}>
                      <span className="flex items-center gap-1"><CheckCircle size={11}/>{wf.executions} exéc.</span>
                      <span className="flex items-center gap-1"><Clock size={11}/>Dernière : {wf.lastRun}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e=>e.stopPropagation()}>
                    <button onClick={e=>toggle(wf.id,e)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all"
                      style={wf.status==='active'?{background:'#FFFBEB',color:'#D97706'}:{background:'#ECFDF5',color:'#059669'}}>
                      {wf.status==='active'?<><Pause size={11}/>Pause</>:<><Play size={11}/>Activer</>}
                    </button>
                    <button onClick={e=>duplicate(wf,e)} className="p-1.5 rounded-xl hover:bg-gray-100 transition-colors"><Copy size={13} style={{color:'var(--text-muted)'}}/></button>
                    <button onClick={e=>remove(wf.id,e)} className="p-1.5 rounded-xl hover:bg-red-50 transition-colors"><Trash2 size={13} className="text-red-400"/></button>
                    <ChevronRight size={15} style={{color:'var(--text-muted)'}}/>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
