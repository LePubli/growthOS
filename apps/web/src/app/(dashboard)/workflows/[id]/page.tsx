'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Play, Pause, Save, Zap, Mail, Clock, Filter, Users, GitBranch, CheckCircle, X } from 'lucide-react';

const TRIGGER_TYPES = [
  { id:'prospect_created', label:'Prospect créé', icon:'👤', desc:'Déclenche quand un nouveau prospect est ajouté' },
  { id:'email_opened', label:'Email ouvert', icon:'📧', desc:'Déclenche quand un prospect ouvre un email' },
  { id:'score_threshold', label:'Score atteint', icon:'🎯', desc:'Déclenche quand le score dépasse un seuil' },
  { id:'deal_stage', label:'Étape pipeline', icon:'📊', desc:'Déclenche lors d\'un changement d\'étape' },
  { id:'schedule', label:'Planifié', icon:'⏰', desc:'Déclenche selon un planning défini' },
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
  const router = useRouter();
  const [name, setName] = useState('Workflow de nurturing B2B');
  const [status, setStatus] = useState<'active'|'paused'>('paused');
  const [trigger, setTrigger] = useState(TRIGGER_TYPES[0]);
  const [steps, setSteps] = useState([
    { id:'1', type:'send_email', label:'Envoyer email de bienvenue', config:{ subject:'Bienvenue chez GrowthOS', delay:0 } },
    { id:'2', type:'wait', label:'Attendre 3 jours', config:{ days:3 } },
    { id:'3', type:'condition', label:'Si email ouvert', config:{ condition:'email_opened' } },
    { id:'4', type:'add_sequence', label:'Ajouter à séquence nurturing', config:{ sequence:'Onboarding SaaS' } },
  ]);
  const [showAddStep, setShowAddStep] = useState(false);

  const addStep = (type: typeof ACTION_TYPES[0]) => {
    setSteps(s => [...s, { id:Date.now().toString(), type:type.id, label:type.label, config:{} }]);
    setShowAddStep(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-xl"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
        <input value={name} onChange={e => setName(e.target.value)} className="flex-1 text-lg font-bold text-gray-900 bg-transparent border-none outline-none" />
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${status==='active'?'bg-green-50 text-green-600':'bg-gray-100 text-gray-500'}`}>{status==='active'?'Actif':'En pause'}</span>
          <button onClick={() => setStatus(s => s==='active'?'paused':'active')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${status==='active'?'bg-amber-50 text-amber-600':'bg-green-50 text-green-600'}`}>
            {status==='active' ? <><Pause className="w-4 h-4"/>Pause</> : <><Play className="w-4 h-4"/>Activer</>}
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium"><Save className="w-4 h-4" />Sauvegarder</button>
        </div>
      </div>

      <div className="flex flex-1">
        {/* Canvas workflow */}
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-md mx-auto">
            {/* Déclencheur */}
            <div className="bg-teal-600 text-white rounded-2xl p-4 mb-2 shadow-lg">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{trigger.icon}</span>
                <div><div className="text-xs font-medium text-teal-100">Déclencheur</div><div className="font-semibold">{trigger.label}</div></div>
              </div>
            </div>

            {/* Connecteur */}
            <div className="flex justify-center"><div className="w-0.5 h-6 bg-gray-300" /></div>

            {/* Étapes */}
            {steps.map((step, i) => {
              const action = ACTION_TYPES.find(a => a.id === step.type) || ACTION_TYPES[0];
              return (
                <div key={step.id}>
                  <div className={`rounded-2xl p-4 mb-1 border-2 border-gray-200 bg-white shadow-sm hover:border-teal-300 transition-all group`}>
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{action.icon}</span>
                      <div className="flex-1"><div className="text-xs text-gray-400">Étape {i+1}</div><div className="font-medium text-gray-900 text-sm">{step.label}</div></div>
                      <button onClick={() => setSteps(s => s.filter(x => x.id !== step.id))} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="flex justify-center"><div className="w-0.5 h-4 bg-gray-300" /></div>
                </div>
              );
            })}

            {/* Bouton ajouter */}
            <button onClick={() => setShowAddStep(true)} className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-2xl text-sm text-gray-400 hover:border-teal-400 hover:text-teal-600 transition-all">
              <Plus className="w-4 h-4" /> Ajouter une étape
            </button>
          </div>
        </div>

        {/* Panel ajout étape */}
        {showAddStep && (
          <div className="w-72 bg-white border-l border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Ajouter une étape</h3>
              <button onClick={() => setShowAddStep(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <div className="space-y-2">
              {ACTION_TYPES.map(a => (
                <button key={a.id} onClick={() => addStep(a)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 border border-gray-100 text-left">
                  <span className="text-xl">{a.icon}</span>
                  <span className="text-sm font-medium text-gray-700">{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Panel trigger */}
        <div className="w-64 bg-white border-l border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Déclencheur</h3>
          <div className="space-y-2">
            {TRIGGER_TYPES.map(t => (
              <button key={t.id} onClick={() => setTrigger(t)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${trigger.id===t.id?'border-teal-400 bg-teal-50':'border-gray-200 hover:border-gray-300'}`}>
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
