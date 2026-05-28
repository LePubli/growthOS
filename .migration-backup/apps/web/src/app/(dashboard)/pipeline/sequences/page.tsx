'use client';

import { useState } from 'react';
import {
  Mail, Plus, Play, Pause, MoreHorizontal, Users,
  Clock, CheckCircle, BarChart2, ArrowRight, Edit2,
  Copy, Trash2, Send, Eye, TrendingUp, Loader2, RefreshCw
} from 'lucide-react';

interface Step {
  id: string;
  type: 'email' | 'wait' | 'condition';
  subject?: string;
  delay?: number;
  delayUnit?: 'hours' | 'days';
  condition?: string;
}

interface Sequence {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'paused' | 'draft';
  steps: Step[];
  enrolled: number;
  completed: number;
  openRate?: number;
  replyRate?: number;
  lastActivity?: string;
}

const STATUS_CFG = {
  active: { label:'Active', color:'text-green-600', bg:'bg-green-50', dot:'bg-green-400' },
  paused: { label:'Pausée', color:'text-amber-600', bg:'bg-amber-50', dot:'bg-amber-400' },
  draft:  { label:'Brouillon', color:'text-gray-500', bg:'bg-gray-100', dot:'bg-gray-300' },
};

const MOCK_SEQUENCES: Sequence[] = [
  {
    id:'1', name:'Prospection SaaS B2B', description:'Séquence de 5 emails pour prospecter les décideurs SaaS',
    status:'active', enrolled:234, completed:89, openRate:48.2, replyRate:8.4, lastActivity:'il y a 5 min',
    steps:[
      { id:'s1', type:'email', subject:'Bonjour {{prenom}}, une question rapide', delay:0 },
      { id:'s2', type:'wait', delay:3, delayUnit:'days' },
      { id:'s3', type:'email', subject:'Suite à mon précédent message...', delay:3 },
      { id:'s4', type:'wait', delay:5, delayUnit:'days' },
      { id:'s5', type:'email', subject:'Dernière tentative — {{entreprise}}', delay:5 },
    ],
  },
  {
    id:'2', name:'Onboarding nouveaux clients', description:'Accompagnement post-signature sur 30 jours',
    status:'active', enrolled:45, completed:28, openRate:72.1, replyRate:15.2, lastActivity:'il y a 1h',
    steps:[
      { id:'s1', type:'email', subject:'Bienvenue chez nous, {{prenom}} !', delay:0 },
      { id:'s2', type:'wait', delay:1, delayUnit:'days' },
      { id:'s3', type:'email', subject:'Vos premiers pas avec GrowthOS', delay:1 },
      { id:'s4', type:'wait', delay:7, delayUnit:'days' },
      { id:'s5', type:'email', subject:'Comment se passe votre expérience ?', delay:7 },
      { id:'s6', type:'wait', delay:14, delayUnit:'days' },
      { id:'s7', type:'email', subject:'Bilan de votre premier mois', delay:14 },
    ],
  },
  {
    id:'3', name:'Relance inactifs 90j', description:'Réactivation des prospects inactifs depuis 90 jours',
    status:'paused', enrolled:567, completed:0, openRate:31.5, replyRate:4.2, lastActivity:'il y a 2j',
    steps:[
      { id:'s1', type:'email', subject:'{{prenom}}, on ne s\'est pas parlé depuis longtemps...', delay:0 },
      { id:'s2', type:'wait', delay:5, delayUnit:'days' },
      { id:'s3', type:'email', subject:'Dernière chance de profiter de notre offre', delay:5 },
    ],
  },
  {
    id:'4', name:'Séquence Agences', description:'Spéciale agences digitales — approche consultative',
    status:'draft', enrolled:0, completed:0,
    steps:[
      { id:'s1', type:'email', subject:'Comment vous aidez vos clients à scaler ?', delay:0 },
      { id:'s2', type:'wait', delay:4, delayUnit:'days' },
      { id:'s3', type:'email', subject:'Cas client : +40% de leads qualifiés', delay:4 },
    ],
  },
];

function StepBadge({ step }: { step: Step }) {
  if (step.type === 'email') return (
    <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5">
      <Mail className="w-3.5 h-3.5 text-blue-500" />
      <span className="text-xs text-blue-700 truncate max-w-[140px]">{step.subject}</span>
    </div>
  );
  if (step.type === 'wait') return (
    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
      <Clock className="w-3.5 h-3.5 text-gray-400" />
      <span className="text-xs text-gray-500">Attendre {step.delay} {step.delayUnit === 'days' ? 'j' : 'h'}</span>
    </div>
  );
  return null;
}

export default function SequencesPage() {
  const [sequences, setSequences] = useState<Sequence[]>(MOCK_SEQUENCES);
  const [loading, setLoading] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const handleToggle = (seq: Sequence) => {
    setLoading(seq.id);
    setTimeout(() => {
      setSequences(prev => prev.map(s =>
        s.id === seq.id ? { ...s, status: s.status === 'active' ? 'paused' : 'active' } : s
      ));
      showToast(`Séquence "${seq.name}" ${seq.status === 'active' ? 'mise en pause' : 'activée'}`);
      setLoading(null);
    }, 1000);
  };

  const handleDuplicate = (seq: Sequence) => {
    const copy: Sequence = { ...seq, id: Date.now().toString(), name: `${seq.name} (copie)`, status:'draft', enrolled:0, completed:0 };
    setSequences(prev => [copy, ...prev]);
    showToast(`"${seq.name}" dupliquée`);
  };

  const total = { enrolled: sequences.reduce((s,q) => s + q.enrolled, 0), active: sequences.filter(s => s.status==='active').length };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-teal-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />{toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Séquences Email</h1>
          <p className="text-sm text-gray-400 mt-0.5">{total.active} actives · {total.enrolled.toLocaleString()} contacts enrollés</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700">
          <Plus className="w-4 h-4" /> Nouvelle séquence
        </button>
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label:'Séquences actives', value:total.active, icon:<Play className="w-5 h-5" />, color:'text-green-600 bg-green-50' },
          { label:'Contacts enrollés', value:total.enrolled.toLocaleString(), icon:<Users className="w-5 h-5" />, color:'text-blue-600 bg-blue-50' },
          { label:'Taux d\'ouverture moy.', value:'50.6%', icon:<Eye className="w-5 h-5" />, color:'text-purple-600 bg-purple-50' },
          { label:'Taux de réponse moy.', value:'9.3%', icon:<Send className="w-5 h-5" />, color:'text-teal-600 bg-teal-50' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>{s.icon}</div>
            <div>
              <div className="text-xl font-bold text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-400">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Liste séquences */}
      <div className="space-y-4">
        {sequences.map(seq => {
          const cfg = STATUS_CFG[seq.status];
          const isExpanded = expanded === seq.id;
          const isToggling = loading === seq.id;
          const completionRate = seq.enrolled > 0 ? Math.round((seq.completed / seq.enrolled) * 100) : 0;

          return (
            <div key={seq.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-all">
              {/* Header card */}
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 flex-shrink-0">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-gray-900">{seq.name}</h3>
                      <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color} ${cfg.bg}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </div>
                    {seq.description && <p className="text-sm text-gray-500 mb-3">{seq.description}</p>}

                    {/* Métriques */}
                    <div className="flex flex-wrap gap-6 text-sm">
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <Users className="w-4 h-4" />
                        <span><strong className="text-gray-900">{seq.enrolled}</strong> enrollés</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <CheckCircle className="w-4 h-4" />
                        <span><strong className="text-gray-900">{completionRate}%</strong> complétés</span>
                      </div>
                      {seq.openRate && (
                        <div className="flex items-center gap-1.5 text-gray-500">
                          <Eye className="w-4 h-4" />
                          <span><strong className="text-gray-900">{seq.openRate}%</strong> ouverture</span>
                        </div>
                      )}
                      {seq.replyRate && (
                        <div className="flex items-center gap-1.5 text-gray-500">
                          <Send className="w-4 h-4" />
                          <span><strong className="text-gray-900">{seq.replyRate}%</strong> réponse</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                        <Clock className="w-3.5 h-3.5" />
                        {seq.lastActivity || 'Jamais lancée'}
                      </div>
                    </div>

                    {/* Barre progression */}
                    {seq.enrolled > 0 && (
                      <div className="mt-3 flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-teal-500 transition-all" style={{ width:`${completionRate}%` }} />
                        </div>
                        <span className="text-xs text-gray-400">{completionRate}%</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExpanded(isExpanded ? null : seq.id)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-100"
                    >
                      {isExpanded ? 'Masquer' : `${seq.steps.length} étapes`}
                    </button>
                    {seq.status !== 'draft' && (
                      <button
                        onClick={() => handleToggle(seq)}
                        disabled={!!loading}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                          seq.status === 'active' ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-green-50 text-green-600 hover:bg-green-100'
                        }`}
                      >
                        {isToggling ? <Loader2 className="w-4 h-4 animate-spin" /> :
                          seq.status === 'active' ? <><Pause className="w-4 h-4" /> Pause</> : <><Play className="w-4 h-4" /> Activer</>
                        }
                      </button>
                    )}
                    {seq.status === 'draft' && (
                      <button className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700">
                        <Play className="w-4 h-4" /> Lancer
                      </button>
                    )}
                    <div className="flex gap-1">
                      <button onClick={() => handleDuplicate(seq)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg" title="Dupliquer">
                        <Copy className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg" title="Modifier">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Steps expanded */}
              {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Étapes de la séquence</h4>
                  <div className="flex items-center gap-2 flex-wrap">
                    {seq.steps.map((step, i) => (
                      <div key={step.id} className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-400 font-mono w-4">{i+1}.</span>
                          <StepBadge step={step} />
                        </div>
                        {i < seq.steps.length - 1 && <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
