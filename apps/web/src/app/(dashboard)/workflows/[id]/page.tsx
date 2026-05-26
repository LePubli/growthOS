'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Play, Pause, Save, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

const TRIGGER_TYPES = [
  { id:'prospect_created', label:'Prospect créé', icon:'👤', desc:'Se déclenche à chaque nouveau prospect' },
  { id:'email_opened', label:'Email ouvert', icon:'📧', desc:'Quand un prospect ouvre un email' },
  { id:'score_threshold', label:'Score atteint', icon:'🎯', desc:'Quand le score dépasse un seuil' },
  { id:'deal_stage', label:'Changement d\'étape', icon:'📊', desc:'Lors d\'un déplacement dans le pipeline' },
  { id:'schedule', label:'Planifié', icon:'⏰', desc:'Selon un planning défini' },
];

const ACTION_TYPES = [
  { id:'send_email', label:'Envoyer un email', icon:'📧', color:'bg-purple-50 text-purple-600' },
  { id:'add_sequence', label:'Ajouter à une séquence', icon:'📋', color:'bg-blue-50 text-blue-600' },
  { id:'update_status', label:'Mettre à jour le statut', icon:'🔄', color:'bg-yellow-50 text-yellow-600' },
  { id:'add_tag', label:'Ajouter un tag', icon:'🏷️', color:'bg-green-50 text-green-600' },
  { id:'notify_slack', label:'Notification Slack', icon:'💬', color:'bg-indigo-50 text-indigo-600' },
  { id:'webhook', label:'Appeler un webhook', icon:'⚡', color:'bg-orange-50 text-orange-600' },
  { id:'wait', label:'Attendre', icon:'⏳', color:'bg-gray-50 text-gray-600' },
  { id:'condition', label:'Condition (si/sinon)', icon:'🔀', color:'bg-teal-50 text-teal-600' },
];

export default function WorkflowDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [name, setName] = useState('Nouveau workflow');
  const [status, setStatus] = useState<'active'|'paused'|'draft'>('draft');
  const [trigger, setTrigger] = useState(TRIGGER_TYPES[0]);
  const [steps, setSteps] = useState<any[]>([]);
  const [showAddStep, setShowAddStep] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{msg:string;type:'success'|'error'}|null>(null);
  const API = process.env.NEXT_PUBLIC_API_URL || '';

  const showToast = (msg:string, type:'success'|'error'='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  useEffect(() => {
    if (id==='new') return;
    const fetch_ = async () => {
      try {
        const token = localStorage.getItem('access_token')||'';
        const res = await fetch(`${API}/api/v1/workflows/${id}`,{headers:{Authorization:`Bearer ${token}`}});
        if (res.ok) {
          const d = await res.json();
          setName(d.name); setStatus(d.status);
          const t = TRIGGER_TYPES.find(x=>x.id===d.trigger)||TRIGGER_TYPES[0];
          setTrigger(t); setSteps(d.steps||[]);
        }
      } catch {}
    };
    fetch_();
  }, [id]);

  const save = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('access_token')||'';
      const url = id==='new'?`${API}/api/v1/workflows`:`${API}/api/v1/workflows/${id}`;
      const method = id==='new'?'POST':'PATCH';
      const res = await fetch(url,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({name,trigger:trigger.id,steps,status})});
      if (!res.ok) throw new Error('Erreur sauvegarde');
      const saved = await res.json();
      showToast('Workflow sauvegardé ✓');
      if (id==='new') router.replace(`/workflows/${saved.id}`);
    } catch(e:any) { showToast(e.message,'error'); }
    finally { setSaving(false); }
  };

  const toggle = async () => {
    if (id==='new') return save();
    try {
      const token = localStorage.getItem('access_token')||'';
      await fetch(`${API}/api/v1/workflows/${id}/toggle`,{method:'POST',headers:{Authorization:`Bearer ${token}`}});
      setStatus(s=>s==='active'?'paused':'active');
    } catch {}
  };

  const addStep = (type:typeof ACTION_TYPES[0]) => {
    setSteps(s=>[...s,{id:Date.now().toString(),type:type.id,label:type.label,config:{}}]);
    setShowAddStep(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {toast && <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${toast.type==='success'?'bg-teal-600 text-white':'bg-red-500 text-white'}`}>
        {toast.type==='success'?<CheckCircle className="w-4 h-4"/>:<AlertCircle className="w-4 h-4"/>}{toast.msg}
      </div>}

      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 flex-shrink-0">
        <button onClick={()=>router.back()} className="p-2 hover:bg-gray-100 rounded-xl"><ArrowLeft className="w-5 h-5 text-gray-600"/></button>
        <input value={name} onChange={e=>setName(e.target.value)} className="flex-1 text-lg font-bold text-gray-900 bg-transparent border-none outline-none"/>
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${status==='active'?'bg-green-50 text-green-600':status==='paused'?'bg-amber-50 text-amber-600':'bg-gray-100 text-gray-500'}`}>{status}</span>
          {id!=='new' && <button onClick={toggle} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${status==='active'?'bg-amber-50 text-amber-600':'bg-green-50 text-green-600'}`}>
            {status==='active'?<><Pause className="w-4 h-4"/>Pause</>:<><Play className="w-4 h-4"/>Activer</>}
          </button>}
          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
            {saving?<Loader2 className="w-4 h-4 animate-spin"/>:<Save className="w-4 h-4"/>}Sauvegarder
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-sm mx-auto">
            {/* Déclencheur */}
            <div className="rounded-2xl p-4 mb-2 shadow-lg text-white" style={{background:'var(--color-primary,#0D9488)'}}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{trigger.icon}</span>
                <div><div className="text-xs font-medium opacity-75">Déclencheur</div><div className="font-semibold">{trigger.label}</div></div>
              </div>
            </div>
            <div className="flex justify-center"><div className="w-0.5 h-6 bg-gray-300"/></div>

            {steps.map((step,i)=>{
              const action=ACTION_TYPES.find(a=>a.id===step.type)||ACTION_TYPES[0];
              return (
                <div key={step.id}>
                  <div className="rounded-2xl p-4 mb-1 border-2 border-gray-200 bg-white shadow-sm hover:border-teal-300 transition-all group">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{action.icon}</span>
                      <div className="flex-1"><div className="text-xs text-gray-400">Étape {i+1}</div><div className="font-medium text-gray-900 text-sm">{step.label}</div></div>
                      <button onClick={()=>setSteps(s=>s.filter(x=>x.id!==step.id))} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400"><X className="w-4 h-4"/></button>
                    </div>
                  </div>
                  <div className="flex justify-center"><div className="w-0.5 h-4 bg-gray-300"/></div>
                </div>
              );
            })}

            <button onClick={()=>setShowAddStep(true)} className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-2xl text-sm text-gray-400 hover:border-teal-400 hover:text-teal-600 transition-all">
              <Plus className="w-4 h-4"/>Ajouter une étape
            </button>
          </div>
        </div>

        {/* Panel actions */}
        {showAddStep && (
          <div className="w-72 bg-white border-l border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Ajouter une étape</h3>
              <button onClick={()=>setShowAddStep(false)}><X className="w-4 h-4 text-gray-400"/></button>
            </div>
            <div className="space-y-2">
              {ACTION_TYPES.map(a=>(
                <button key={a.id} onClick={()=>addStep(a)} className={`w-full flex items-center gap-3 p-3 rounded-xl hover:opacity-80 border border-gray-100 text-left ${a.color}`}>
                  <span className="text-xl">{a.icon}</span><span className="text-sm font-medium">{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Panel triggers */}
        <div className="w-64 bg-white border-l border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Déclencheur</h3>
          <div className="space-y-2">
            {TRIGGER_TYPES.map(t=>(
              <button key={t.id} onClick={()=>setTrigger(t)} className={`w-full text-left p-3 rounded-xl border transition-all ${trigger.id===t.id?'border-teal-400 bg-teal-50':'border-gray-200 hover:border-gray-300'}`}>
                <div className="flex items-center gap-2 mb-1"><span>{t.icon}</span><span className="text-sm font-medium text-gray-900">{t.label}</span></div>
                <p className="text-xs text-gray-400 leading-relaxed">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
