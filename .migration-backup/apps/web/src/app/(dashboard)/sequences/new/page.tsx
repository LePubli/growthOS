'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Mail, Save, Loader2, CheckCircle, AlertCircle, Wand2 } from 'lucide-react';

const TEMPLATES = [
  { id:'cold', name:'Prospection froide', desc:'3 emails sur 7 jours pour cold outreach B2B', steps:[
    { day:0, subject:'{{firstName}}, une question rapide', body:'Bonjour {{firstName}},\n\nJe travaille avec des entreprises comme {{company}} pour [bénéfice].\n\nSeriez-vous disponible 15 min cette semaine ?\n\n{{sender}}' },
    { day:3, subject:'Suite: {{firstName}}', body:'Bonjour {{firstName}},\n\nJe me permets de revenir vers vous suite à mon précédent message.\n\n{{sender}}' },
    { day:7, subject:'Dernière tentative — {{company}}', body:'Bonjour {{firstName}},\n\nDernier message de ma part. Si le timing n\'est pas bon, pas de souci.\n\n{{sender}}' },
  ]},
  { id:'nurturing', name:'Nurturing qualifiés', desc:'5 emails sur 30 jours pour prospects chauds', steps:[
    { day:0, subject:'Bienvenue, {{firstName}} !', body:'Bonjour {{firstName}},\n\nMerci pour votre intérêt...\n\n{{sender}}' },
    { day:3, subject:'Cas client similaire à {{company}}', body:'Bonjour {{firstName}},\n\nVoici un exemple concret...\n\n{{sender}}' },
    { day:7, subject:'Ressource gratuite pour {{company}}', body:'Bonjour {{firstName}},\n\nJe voulais partager...\n\n{{sender}}' },
    { day:14, subject:'Question directe', body:'Bonjour {{firstName}},\n\nOù en est votre projet ?\n\n{{sender}}' },
    { day:30, subject:'Dernières nouvelles', body:'Bonjour {{firstName}},\n\nUn point rapide...\n\n{{sender}}' },
  ]},
  { id:'post-demo', name:'Post-démo', desc:'3 emails de suivi après une démonstration', steps:[
    { day:0, subject:'Merci pour la démo, {{firstName}}', body:'Bonjour {{firstName}},\n\nMerci pour le temps que vous avez consacré à notre démonstration...\n\n{{sender}}' },
    { day:2, subject:'Réponses à vos questions', body:'Bonjour {{firstName}},\n\nSuite à votre question sur [sujet]...\n\n{{sender}}' },
    { day:5, subject:'Prochaine étape ?', body:'Bonjour {{firstName}},\n\nJe voulais faire un point...\n\n{{sender}}' },
  ]},
  { id:'blank', name:'Séquence vierge', desc:'Commencer de zéro', steps:[] },
];

export default function NewSequencePage() {
  const router = useRouter();
  const [step, setStep] = useState<'template'|'edit'>('template');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string|null>(null);
  const [steps, setSteps] = useState<any[]>([]);
  const [selectedStep, setSelectedStep] = useState<string|null>(null);
  const [editingStep, setEditingStep] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const API = process.env.NEXT_PUBLIC_API_URL || '';

  const chooseTemplate = (tpl: typeof TEMPLATES[0]) => {
    setSelectedTemplate(tpl.id);
    if (tpl.id !== 'blank') setName(tpl.name);
    setDescription(tpl.desc);
    setSteps(tpl.steps.map((s,i) => ({ id:`s${i}`, ...s })));
    setStep('edit');
    if (tpl.steps.length > 0) setSelectedStep('s0');
  };

  const addStep = () => {
    const lastDay = steps[steps.length-1]?.day || 0;
    const id = `s${Date.now()}`;
    const ns = { id, day:lastDay+3, subject:'Nouvel email', body:'' };
    setSteps(s=>[...s,ns]);
    setSelectedStep(id);
    setEditingStep(ns);
  };

  const deleteStep = (id:string) => {
    setSteps(s=>s.filter(x=>x.id!==id));
    setSelectedStep(steps[0]?.id||null);
    setEditingStep(null);
  };

  const saveStep = () => {
    if (!editingStep) return;
    setSteps(s=>s.map(x=>x.id===editingStep.id?editingStep:x));
    setEditingStep(null);
  };

  const save = async () => {
    if (!name.trim()) { setError('Le nom est requis'); return; }
    if (steps.length === 0) { setError('Ajoutez au moins une étape'); return; }
    setSaving(true); setError(null);
    try {
      const token = localStorage.getItem('access_token')||'';
      const res = await fetch(`${API}/api/v1/sequences`, {
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
        body:JSON.stringify({ name, description, steps, status:'draft' }),
      });
      if (!res.ok) throw new Error('Erreur création');
      const seq = await res.json();
      router.replace(`/sequences/${seq.id}`);
    } catch(e:any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const currentStep = editingStep || steps.find(s=>s.id===selectedStep);

  if (step === 'template') return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={()=>router.back()} className="p-2 hover:bg-gray-200 rounded-xl"><ArrowLeft className="w-5 h-5 text-gray-600"/></button>
        <div><h1 className="text-2xl font-bold text-gray-900">Nouvelle séquence email</h1>
          <p className="text-sm text-gray-400">Choisissez un modèle ou commencez de zéro</p></div>
      </div>
      <div className="max-w-3xl grid grid-cols-2 gap-4">
        {TEMPLATES.map(tpl=>(
          <button key={tpl.id} onClick={()=>chooseTemplate(tpl)}
            className={`text-left p-5 bg-white rounded-2xl border-2 hover:border-teal-400 hover:shadow-md transition-all ${selectedTemplate===tpl.id?'border-teal-500':'border-gray-200'}`}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
                {tpl.id==='blank'?<Plus className="w-5 h-5"/>:<Mail className="w-5 h-5"/>}
              </div>
              <div>
                <div className="font-semibold text-gray-900">{tpl.name}</div>
                <div className="text-xs text-gray-400">{tpl.steps.length} étapes</div>
              </div>
            </div>
            <p className="text-sm text-gray-500">{tpl.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 flex-shrink-0">
        <button onClick={()=>setStep('template')} className="p-2 hover:bg-gray-100 rounded-xl"><ArrowLeft className="w-5 h-5 text-gray-600"/></button>
        <div className="flex-1">
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Nom de la séquence *" className="text-lg font-bold text-gray-900 bg-transparent border-none outline-none w-full"/>
          <input value={description} onChange={e=>setDescription(e.target.value)} placeholder="Description (optionnel)" className="text-xs text-gray-400 bg-transparent border-none outline-none w-full mt-0.5"/>
        </div>
        {error && <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 px-3 py-2 rounded-xl"><AlertCircle className="w-4 h-4"/>{error}</div>}
        <button onClick={save} disabled={saving||!name||steps.length===0} className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-teal-700">
          {saving?<Loader2 className="w-4 h-4 animate-spin"/>:<CheckCircle className="w-4 h-4"/>}Créer la séquence
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <button onClick={addStep} className="w-full flex items-center justify-center gap-2 py-2 bg-teal-50 text-teal-600 rounded-xl text-sm font-medium hover:bg-teal-100">
              <Plus className="w-4 h-4"/>Ajouter une étape
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {steps.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <Mail className="w-10 h-10 mx-auto mb-2 text-gray-200"/>
                <p className="text-sm">Aucune étape</p>
                <p className="text-xs mt-1">Cliquez sur "+ Ajouter"</p>
              </div>
            )}
            {steps.map((step,i)=>(
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
                  <h2 className="font-semibold text-gray-900">Étape {steps.findIndex(s=>s.id===selectedStep)+1}</h2>
                  <div className="flex gap-2">
                    {editingStep ? (
                      <>
                        <button onClick={()=>setEditingStep(null)} className="px-3 py-1.5 border border-gray-200 rounded-xl text-sm text-gray-600">Annuler</button>
                        <button onClick={saveStep} className="px-3 py-1.5 bg-teal-600 text-white rounded-xl text-sm font-medium"><Save className="w-3.5 h-3.5 inline mr-1"/>OK</button>
                      </>
                    ):(
                      <button onClick={()=>setEditingStep({...currentStep})} className="px-3 py-1.5 border border-gray-200 rounded-xl text-sm text-gray-600">Modifier</button>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Délai d'envoi</label>
                    {editingStep ? <div className="flex items-center gap-2"><input type="number" value={editingStep.day} onChange={e=>setEditingStep((x:any)=>({...x,day:+e.target.value}))} className="w-24 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/><span className="text-sm text-gray-500">jours après inscription</span></div>
                    :<p className="text-sm text-gray-900">Jour {currentStep.day}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Objet</label>
                    {editingStep ? <input value={editingStep.subject} onChange={e=>setEditingStep((x:any)=>({...x,subject:e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
                    :<p className="text-sm font-medium text-gray-900">{currentStep.subject}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Corps</label>
                    <p className="text-xs text-gray-400 mb-1">Variables: {'{{firstName}}'} {'{{company}}'} {'{{sender}}'}</p>
                    {editingStep ? <textarea value={editingStep.body} onChange={e=>setEditingStep((x:any)=>({...x,body:e.target.value}))} rows={10} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"/>
                    :<div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">{currentStep.body||'Aucun contenu'}</div>}
                  </div>
                </div>
              </div>
            </div>
          ):(
            <div className="flex items-center justify-center h-full">
              <div className="text-center"><Mail className="w-12 h-12 text-gray-200 mx-auto mb-3"/><p className="text-gray-400">Sélectionnez ou créez une étape</p></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
