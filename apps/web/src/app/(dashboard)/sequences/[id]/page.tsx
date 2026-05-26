'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Mail, Clock, Edit2, Save, Play, Pause, Users, TrendingUp, Eye, MousePointer } from 'lucide-react';

const MOCK_SEQUENCE = {
  id:'1', name:'Onboarding SaaS', description:'Séquence de bienvenue pour les nouveaux leads SaaS', status:'active',
  enrolled:47, completed:12, openRate:48.2, replyRate:8.4,
  steps: [
    { id:'s1', day:0, subject:'Bonjour {{firstName}}, découvrez GrowthOS', body:'Bonjour {{firstName}},\n\nJe me permets de vous contacter car votre profil correspond exactement à nos clients qui obtiennent les meilleurs résultats avec GrowthOS.\n\nEn 2 minutes, GrowthOS vous permet de :\n✅ Trouver 100+ prospects qualifiés par semaine\n✅ Automatiser vos séquences email\n✅ Scorer vos leads automatiquement\n\nSeriez-vous disponible pour une démo de 20 minutes cette semaine ?\n\nCordialement,\n{{sender}}', openRate:52.3, replyRate:12.1 },
    { id:'s2', day:3, subject:'Suite : GrowthOS pour {{company}}', body:'Bonjour {{firstName}},\n\nJe reviens vers vous suite à mon précédent email.\n\nJ\'ai remarqué que vous n\'avez pas eu le temps de me répondre — ce qui est tout à fait normal !\n\nJe voulais juste vous partager un cas client similaire à {{company}} : +340% de prospects qualifiés en 3 mois.\n\nCela vous intéresse-t-il ?\n\n{{sender}}', openRate:38.4, replyRate:6.2 },
    { id:'s3', day:7, subject:'Dernière tentative — valeur ajoutée pour {{company}}', body:'Bonjour {{firstName}},\n\nJe ne veux pas vous importuner, donc voici mon dernier message.\n\nSi vous cherchez à :\n→ Automatiser votre prospection B2B\n→ Trouver des leads qualifiés plus rapidement\n→ Booster votre CA\n\nGrowthOS est fait pour vous. Je vous offre 14 jours gratuits sans CB.\n\nLien direct : app.growthos.io/trial\n\nBonne continuation,\n{{sender}}', openRate:28.1, replyRate:4.8 },
  ]
};

export default function SequenceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [seq, setSeq] = useState(MOCK_SEQUENCE);
  const [selectedStep, setSelectedStep] = useState<string|null>('s1');
  const [editingStep, setEditingStep] = useState<any>(null);

  const currentStep = editingStep || seq.steps.find(s => s.id === selectedStep);

  const addStep = () => {
    const lastDay = seq.steps[seq.steps.length-1]?.day || 0;
    const newStep = { id:`s${Date.now()}`, day:lastDay+4, subject:'Nouvel email', body:'', openRate:0, replyRate:0 };
    setSeq(s => ({ ...s, steps:[...s.steps, newStep] }));
    setSelectedStep(newStep.id);
    setEditingStep(newStep);
  };

  const deleteStep = (sid: string) => {
    setSeq(s => ({ ...s, steps: s.steps.filter(x => x.id !== sid) }));
    setSelectedStep(seq.steps[0]?.id || null);
  };

  const saveStep = () => {
    if (!editingStep) return;
    setSeq(s => ({ ...s, steps: s.steps.map(x => x.id === editingStep.id ? editingStep : x) }));
    setEditingStep(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-xl"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
        <div className="flex-1">
          <h1 className="font-bold text-gray-900">{seq.name}</h1>
          <p className="text-xs text-gray-400">{seq.steps.length} étapes · {seq.enrolled} inscrits</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-4 text-sm">
            <span className="text-gray-500"><Eye className="w-4 h-4 inline mr-1" />{seq.openRate}% ouverture</span>
            <span className="text-gray-500"><MousePointer className="w-4 h-4 inline mr-1" />{seq.replyRate}% réponse</span>
            <span className="text-gray-500"><Users className="w-4 h-4 inline mr-1" />{seq.enrolled} inscrits</span>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${seq.status==='active'?'bg-green-50 text-green-600':'bg-amber-50 text-amber-600'}`}>{seq.status}</span>
          <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium">
            {seq.status==='active' ? <><Pause className="w-4 h-4" />Pause</> : <><Play className="w-4 h-4" />Lancer</>}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Timeline étapes */}
        <div className="w-72 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <button onClick={addStep} className="w-full flex items-center justify-center gap-2 py-2 bg-teal-50 text-teal-600 rounded-xl text-sm font-medium hover:bg-teal-100">
              <Plus className="w-4 h-4" /> Ajouter une étape
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {seq.steps.map((step, i) => (
              <div key={step.id} className="relative">
                {i > 0 && <div className="absolute -top-2 left-6 w-0.5 h-2 bg-gray-200" />}
                <button onClick={() => { setSelectedStep(step.id); setEditingStep(null); }}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${selectedStep===step.id?'border-teal-300 bg-teal-50':'border-gray-200 hover:border-gray-300 bg-white'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-full bg-teal-600 text-white text-xs flex items-center justify-center font-bold">{i+1}</div>
                    <span className="text-xs text-gray-400">Jour {step.day}</span>
                    <button onClick={e => { e.stopPropagation(); deleteStep(step.id); }} className="ml-auto text-gray-300 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="text-sm font-medium text-gray-900 truncate">{step.subject}</div>
                  {step.openRate > 0 && <div className="text-xs text-gray-400 mt-1">{step.openRate}% ouv · {step.replyRate}% rép</div>}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Éditeur email */}
        <div className="flex-1 p-6 overflow-y-auto">
          {currentStep ? (
            <div className="max-w-2xl">
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-semibold text-gray-900">Étape {seq.steps.findIndex(s=>s.id===selectedStep)+1}</h2>
                  <div className="flex gap-2">
                    {editingStep ? (
                      <>
                        <button onClick={() => setEditingStep(null)} className="px-3 py-1.5 border border-gray-200 rounded-xl text-sm text-gray-600">Annuler</button>
                        <button onClick={saveStep} className="px-3 py-1.5 bg-teal-600 text-white rounded-xl text-sm font-medium"><Save className="w-3.5 h-3.5 inline mr-1" />Sauvegarder</button>
                      </>
                    ) : (
                      <button onClick={() => setEditingStep({...currentStep})} className="px-3 py-1.5 border border-gray-200 rounded-xl text-sm text-gray-600"><Edit2 className="w-3.5 h-3.5 inline mr-1" />Modifier</button>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Délai d'envoi</label>
                    {editingStep ? (
                      <div className="flex items-center gap-2">
                        <input type="number" value={editingStep.day} onChange={e => setEditingStep((x:any) => ({...x,day:+e.target.value}))}
                          className="w-24 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                        <span className="text-sm text-gray-500">jours après inscription</span>
                      </div>
                    ) : <p className="text-sm text-gray-900">Jour {currentStep.day} après inscription</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Objet de l'email</label>
                    {editingStep ? (
                      <input value={editingStep.subject} onChange={e => setEditingStep((x:any) => ({...x,subject:e.target.value}))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                    ) : <p className="text-sm font-medium text-gray-900">{currentStep.subject}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Corps de l'email</label>
                    <div className="text-xs text-gray-400 mb-2">Variables: {'{{firstName}}'} {'{{lastName}}'} {'{{company}}'} {'{{sender}}'}</div>
                    {editingStep ? (
                      <textarea value={editingStep.body} onChange={e => setEditingStep((x:any) => ({...x,body:e.target.value}))} rows={12}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500" />
                    ) : (
                      <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">{currentStep.body}</div>
                    )}
                  </div>
                  {currentStep.openRate > 0 && (
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                      <div className="bg-blue-50 rounded-xl p-3 text-center"><div className="text-xl font-bold text-blue-600">{currentStep.openRate}%</div><div className="text-xs text-gray-500">Taux d'ouverture</div></div>
                      <div className="bg-green-50 rounded-xl p-3 text-center"><div className="text-xl font-bold text-green-600">{currentStep.replyRate}%</div><div className="text-xs text-gray-500">Taux de réponse</div></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full"><div className="text-center"><Mail className="w-12 h-12 text-gray-200 mx-auto mb-3" /><p className="text-gray-400">Sélectionnez une étape</p></div></div>
          )}
        </div>
      </div>
    </div>
  );
}
