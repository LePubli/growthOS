'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Mail, Edit2, Save, Play, Pause, Users, Eye, MousePointer, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { SequenceExtensionSlot } from '@/plugins/ui-slots';

const MOCK = { id:'new', name:'Nouvelle séquence', description:'', status:'draft', enrolled:0, completed:0, openRate:0, replyRate:0,
  steps:[
    { id:'s1', day:0, subject:'Bonjour {{firstName}}, découvrez GrowthOS', body:'Bonjour {{firstName}},\n\nJe me permets de vous contacter...\n\n{{sender}}', openRate:0, replyRate:0 },
    { id:'s2', day:3, subject:'Suite de mon précédent message', body:'Bonjour {{firstName}},\n\nJe reviens vers vous...\n\n{{sender}}', openRate:0, replyRate:0 },
  ],
};

export default function SequenceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [seq, setSeq] = useState<any>(MOCK);
  const [selectedStep, setSelectedStep] = useState<string>('s1');
  const [editingStep, setEditingStep] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [toast, setToast] = useState<{msg:string;type:'success'|'error'}|null>(null);

  const showToast = (msg:string, type:'success'|'error'='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  useEffect(() => {
    if (id === 'new') return;
    const fetch_ = async () => {
      try {
        const res = await apiClient.get(`/api/v1/sequences/${id}`);
        setSeq(res.data || res); setSelectedStep(res.data?.steps?.[0]?.id||'');
      } catch {}
    };
    fetch_();
  }, [id]);

  const saveSequence = async () => {
    setSaving(true);
    try {
      const url = id==='new'?`/api/v1/sequences`:`/api/v1/sequences/${id}`;
      const method = id==='new'?'POST':'PATCH';
      const res = await apiClient[method === 'POST' ? 'post' : 'patch'](url, {name:seq.name,description:seq.description,steps:seq.steps,status:seq.status});
      const saved = res.data || res;
      setSeq(saved);
      showToast('Séquence sauvegardée ✓');
      if (id==='new') router.replace(`/sequences/${saved.id}`);
    } catch(e:any) { showToast(e.message,'error'); }
    finally { setSaving(false); }
  };

  const toggleStatus = async () => {
    if (id==='new') return;
    setToggling(true);
    try {
      await apiClient.post(`/api/v1/sequences/${id}/toggle`);
      setSeq((s:any)=>({...s,status:s.status==='active'?'paused':'active'}));
      // Émettre un hook pour les plugins
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sequence:toggled', { detail: { sequenceId: id, status: seq.status } }));
      }
    } catch {} finally { setToggling(false); }
  };

  const addStep = () => {
    const lastDay = seq.steps?.[seq.steps.length-1]?.day || 0;
    const newStep = { id:`s${Date.now()}`, day:lastDay+3, subject:'Nouvel email', body:'', openRate:0, replyRate:0 };
    setSeq((s:any)=>({...s,steps:[...(s.steps||[]),newStep]}));
    setSelectedStep(newStep.id);
    setEditingStep(newStep);
  };

  const deleteStep = (sid:string) => {
    setSeq((s:any)=>({...s,steps:s.steps.filter((x:any)=>x.id!==sid)}));
    setSelectedStep(seq.steps?.[0]?.id||'');
  };

  const saveStep = () => {
    if (!editingStep) return;
    setSeq((s:any)=>({...s,steps:s.steps.map((x:any)=>x.id===editingStep.id?editingStep:x)}));
    setEditingStep(null);
    showToast('Étape sauvegardée');
  };

  const currentStep = editingStep || seq.steps?.find((s:any)=>s.id===selectedStep);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {toast && <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${toast.type==='success'?'bg-teal-600 text-white':'bg-red-500 text-white'}`}>
        {toast.type==='success'?<CheckCircle className="w-4 h-4"/>:<AlertCircle className="w-4 h-4"/>}{toast.msg}
      </div>}

      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 flex-shrink-0">
        <button onClick={()=>router.back()} className="p-2 hover:bg-gray-100 rounded-xl"><ArrowLeft className="w-5 h-5 text-gray-600"/></button>
        <input value={seq.name} onChange={e=>setSeq((s:any)=>({...s,name:e.target.value}))} className="flex-1 text-lg font-bold text-gray-900 bg-transparent border-none outline-none"/>
        <div className="flex items-center gap-3">
          {seq.steps?.length>0 && <div className="flex gap-4 text-sm">
            <span className="text-gray-500"><Eye className="w-4 h-4 inline mr-1"/>{seq.openRate||0}%</span>
            <span className="text-gray-500"><Users className="w-4 h-4 inline mr-1"/>{seq.enrolled||0}</span>
          </div>}
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${seq.status==='active'?'bg-green-50 text-green-600':seq.status==='paused'?'bg-amber-50 text-amber-600':'bg-gray-100 text-gray-500'}`}>{seq.status}</span>
          {id!=='new' && <button onClick={toggleStatus} disabled={toggling} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${seq.status==='active'?'bg-amber-50 text-amber-600':'bg-green-50 text-green-600'}`}>
            {toggling?<Loader2 className="w-4 h-4 animate-spin"/>:seq.status==='active'?<><Pause className="w-4 h-4"/>Pause</>:<><Play className="w-4 h-4"/>Activer</>}
          </button>}
          <button onClick={saveSequence} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
            {saving?<Loader2 className="w-4 h-4 animate-spin"/>:<Save className="w-4 h-4"/>}Sauvegarder
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <textarea value={seq.description} onChange={e=>setSeq((s:any)=>({...s,description:e.target.value}))} placeholder="Description de la séquence..." rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none mb-3"/>
            <button onClick={addStep} className="w-full flex items-center justify-center gap-2 py-2 bg-teal-50 text-teal-600 rounded-xl text-sm font-medium hover:bg-teal-100">
              <Plus className="w-4 h-4"/>Ajouter une étape
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {(seq.steps||[]).map((step:any,i:number)=>(
              <div key={step.id} className="relative">
                {i>0&&<div className="absolute -top-2 left-6 w-0.5 h-2 bg-gray-200"/>}
                <button onClick={()=>{setSelectedStep(step.id);setEditingStep(null);}}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${selectedStep===step.id?'border-teal-300 bg-teal-50':'border-gray-200 hover:border-gray-300 bg-white'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-full bg-teal-600 text-white text-xs flex items-center justify-center font-bold">{i+1}</div>
                    <span className="text-xs text-gray-400">Jour {step.day}</span>
                    <button onClick={e=>{e.stopPropagation();deleteStep(step.id);}} className="ml-auto text-gray-300 hover:text-red-400"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                  <div className="text-sm font-medium text-gray-900 truncate">{step.subject}</div>
                  {step.openRate>0&&<div className="text-xs text-gray-400 mt-1">{step.openRate}% ouv · {step.replyRate}% rép</div>}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          {currentStep ? (
            <div className="max-w-2xl">
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-semibold text-gray-900">Étape {(seq.steps||[]).findIndex((s:any)=>s.id===selectedStep)+1}</h2>
                  <div className="flex gap-2">
                    {editingStep?(<>
                      <button onClick={()=>setEditingStep(null)} className="px-3 py-1.5 border border-gray-200 rounded-xl text-sm text-gray-600">Annuler</button>
                      <button onClick={saveStep} className="px-3 py-1.5 bg-teal-600 text-white rounded-xl text-sm font-medium"><Save className="w-3.5 h-3.5 inline mr-1"/>Sauvegarder</button>
                    </>):(
                      <button onClick={()=>setEditingStep({...currentStep})} className="px-3 py-1.5 border border-gray-200 rounded-xl text-sm text-gray-600"><Edit2 className="w-3.5 h-3.5 inline mr-1"/>Modifier</button>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Délai d'envoi</label>
                    {editingStep?<div className="flex items-center gap-2"><input type="number" value={editingStep.day} onChange={e=>setEditingStep((x:any)=>({...x,day:+e.target.value}))} className="w-24 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/><span className="text-sm text-gray-500">jours après inscription</span></div>
                    :<p className="text-sm text-gray-900">Jour {currentStep.day} après inscription</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Objet de l'email</label>
                    {editingStep?<input value={editingStep.subject} onChange={e=>setEditingStep((x:any)=>({...x,subject:e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
                    :<p className="text-sm font-medium text-gray-900">{currentStep.subject}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Corps de l'email</label>
                    <div className="text-xs text-gray-400 mb-1">Variables: {'{{firstName}}'} {'{{company}}'} {'{{sender}}'}</div>
                    {editingStep?<textarea value={editingStep.body} onChange={e=>setEditingStep((x:any)=>({...x,body:e.target.value}))} rows={10} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"/>
                    :<div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">{currentStep.body||'Aucun contenu'}</div>}
                  </div>
                  {currentStep.openRate>0&&<div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                    <div className="bg-blue-50 rounded-xl p-3 text-center"><div className="text-xl font-bold text-blue-600">{currentStep.openRate}%</div><div className="text-xs text-gray-500">Taux d'ouverture</div></div>
                    <div className="bg-green-50 rounded-xl p-3 text-center"><div className="text-xl font-bold text-green-600">{currentStep.replyRate}%</div><div className="text-xs text-gray-500">Taux de réponse</div></div>
                  </div>}
                </div>
              </div>
            </div>
          ):(
            <div className="flex items-center justify-center h-full"><div className="text-center"><Mail className="w-12 h-12 text-gray-200 mx-auto mb-3"/><p className="text-gray-400">Sélectionnez ou créez une étape</p></div></div>
          )}
        </div>
      </div>

      {/* Slot d'extension pour plugins */}
      {id !== 'new' && <SequenceExtensionSlot sequenceId={id as string} tenantId="" />}
    </div>
  );
}
