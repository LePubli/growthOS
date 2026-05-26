'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Edit2, Save, X, Building2, Euro, Calendar, TrendingUp, CheckCircle, Clock, AlertCircle } from 'lucide-react';

const STAGES = ['lead','contact','qualified','proposal','negotiation','won','lost'];
const STAGE_LABELS: Record<string,string> = { lead:'Lead', contact:'Contact', qualified:'Qualifié', proposal:'Proposition', negotiation:'Négociation', won:'Gagné', lost:'Perdu' };
const STAGE_COLORS: Record<string,string> = { lead:'bg-gray-100 text-gray-700', contact:'bg-blue-50 text-blue-700', qualified:'bg-purple-50 text-purple-700', proposal:'bg-yellow-50 text-yellow-700', negotiation:'bg-amber-50 text-amber-700', won:'bg-green-50 text-green-700', lost:'bg-red-50 text-red-700' };

const MOCK_DEAL = { id:'1', title:'Acme Corp — Licence Enterprise', company:'Acme Corp', contact:'Sophie Martin', value:24600, probability:75, stage:'negotiation', dueDate:'2026-06-15', tags:['Enterprise','SaaS'], notes:'Négociation en cours sur le nombre de licences. Sophie demande un rabais de 10% pour 50 licences.' };

const MOCK_TIMELINE = [
  { id:'1', icon:'🎯', title:'Deal créé', desc:'Pipeline commercial', time:'20 Mai 2026' },
  { id:'2', icon:'📧', title:'Email envoyé', desc:'Présentation de l\'offre Enterprise', time:'22 Mai 2026' },
  { id:'3', icon:'📞', title:'Appel commercial', desc:'Durée: 45 min — Très positif', time:'24 Mai 2026' },
  { id:'4', icon:'📄', title:'Proposition envoyée', desc:'Devis 24 600€ — 50 licences', time:'25 Mai 2026' },
  { id:'5', icon:'🔄', title:'Étape mise à jour', desc:'Contact → Négociation', time:'Aujourd\'hui' },
];

export default function DealDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [deal, setDeal] = useState(MOCK_DEAL);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(MOCK_DEAL);
  const set = (k: string, v: any) => setForm(f => ({...f, [k]:v}));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-200 rounded-xl"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{deal.title}</h1>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${STAGE_COLORS[deal.stage]}`}>{STAGE_LABELS[deal.stage]}</span>
        </div>
        {editing ? (
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600"><X className="w-4 h-4 inline mr-1" />Annuler</button>
            <button onClick={() => { setDeal(form); setEditing(false); }} className="px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium"><Save className="w-4 h-4 inline mr-1" />Sauvegarder</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600"><Edit2 className="w-4 h-4 inline mr-1" />Modifier</button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label:'Valeur', value:`${deal.value.toLocaleString()}€`, icon:<Euro className="w-5 h-5" />, color:'text-green-600 bg-green-50' },
              { label:'Probabilité', value:`${deal.probability}%`, icon:<TrendingUp className="w-5 h-5" />, color:'text-blue-600 bg-blue-50' },
              { label:'Closing prévu', value:new Date(deal.dueDate).toLocaleDateString('fr-FR'), icon:<Calendar className="w-5 h-5" />, color:'text-purple-600 bg-purple-50' },
            ].map((k,i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${k.color}`}>{k.icon}</div>
                <div><div className="text-xl font-bold text-gray-900">{k.value}</div><div className="text-xs text-gray-400">{k.label}</div></div>
              </div>
            ))}
          </div>

          {/* Pipeline stages */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Progression pipeline</h2>
            <div className="flex items-center gap-1">
              {STAGES.filter(s=>s!=='lost').map((s,i) => {
                const stageIdx = STAGES.indexOf(deal.stage);
                const curIdx = STAGES.indexOf(s);
                const done = curIdx <= stageIdx && deal.stage !== 'lost';
                return (
                  <div key={s} className="flex-1 flex flex-col items-center gap-1">
                    <button onClick={() => !editing && setDeal(d => ({...d,stage:s}))}
                      className={`w-full h-2 rounded-full transition-all ${done?'bg-teal-500':'bg-gray-200'}`} />
                    <span className={`text-xs ${deal.stage===s?'font-bold text-teal-600':'text-gray-400'}`}>{STAGE_LABELS[s]}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Détails */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Détails</h2>
            <div className="grid grid-cols-2 gap-4">
              {[{k:'title',l:'Titre'},{k:'company',l:'Entreprise'},{k:'contact',l:'Contact'},{k:'value',l:'Valeur (€)'},{k:'probability',l:'Probabilité (%)'},{k:'dueDate',l:'Date closing'}].map(f => (
                <div key={f.k}>
                  <label className="block text-xs text-gray-400 mb-1">{f.l}</label>
                  {editing ? <input value={(form as any)[f.k]} onChange={e => set(f.k, e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  : <p className="text-sm text-gray-900">{(deal as any)[f.k]}</p>}
                </div>
              ))}
            </div>
            <div className="mt-4">
              <label className="block text-xs text-gray-400 mb-1">Notes</label>
              {editing ? <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              : <p className="text-sm text-gray-700">{deal.notes}</p>}
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Timeline</h3>
            <div className="space-y-3">
              {MOCK_TIMELINE.map((t,i) => (
                <div key={t.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="text-lg">{t.icon}</span>
                    {i < MOCK_TIMELINE.length-1 && <div className="w-0.5 h-6 bg-gray-200 my-1" />}
                  </div>
                  <div className="pb-2">
                    <div className="text-sm font-medium text-gray-900">{t.title}</div>
                    <div className="text-xs text-gray-500">{t.desc}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{t.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Actions</h3>
            <div className="space-y-2">
              {['📧 Envoyer un email','📞 Planifier un appel','📄 Créer un devis','✅ Marquer comme gagné','❌ Marquer comme perdu'].map((a,i) => (
                <button key={i} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-xl">{a}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
