'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Euro, Calendar, MoreHorizontal, Loader2, X, CheckCircle, AlertCircle } from 'lucide-react';

interface Deal { id:string; title:string; company:string; contact?:string; value:number; probability:number; stage:string; dueDate?:string; tags?:string[]; }

const STAGES = [
  { id:'lead', label:'Lead', color:'bg-gray-50 border-gray-200' },
  { id:'qualified', label:'Qualifié', color:'bg-blue-50 border-blue-200' },
  { id:'proposal', label:'Proposition', color:'bg-purple-50 border-purple-200' },
  { id:'negotiation', label:'Négociation', color:'bg-amber-50 border-amber-200' },
  { id:'won', label:'Gagné', color:'bg-green-50 border-green-200' },
];

function CreateDealModal({ onClose, onSave, apiUrl }: { onClose:()=>void; onSave:(deal:Deal)=>void; apiUrl:string }) {
  const [form, setForm] = useState({ title:'', company:'', contact:'', value:'', probability:'50', stage:'lead', dueDate:'' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const set = (k:string, v:string) => setForm(f=>({...f,[k]:v}));

  const save = async () => {
    if (!form.title) { setError('Le titre est requis'); return; }
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem('access_token')||'';
      const res = await fetch(`${apiUrl}/api/v1/deals`, {
        method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
        body:JSON.stringify({...form,value:parseFloat(form.value)||0,probability:parseInt(form.probability)||50}),
      });
      if (!res.ok) { const d=await res.json(); throw new Error(d.message||'Erreur'); }
      const deal = await res.json();
      onSave(deal); onClose();
    } catch(e:any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Nouveau deal</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
        </div>
        <div className="space-y-3 mb-4">
          {[{k:'title',l:'Titre *',p:'Ex: Acme Corp — Enterprise'},{k:'company',l:'Entreprise',p:'Nom de l\'entreprise'},{k:'contact',l:'Contact',p:'Nom du contact'}].map(f=>(
            <div key={f.k}>
              <label className="block text-xs font-medium text-gray-500 mb-1">{f.l}</label>
              <input value={(form as any)[f.k]} onChange={e=>set(f.k,e.target.value)} placeholder={f.p} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Valeur (€)</label>
              <input type="number" value={form.value} onChange={e=>set('value',e.target.value)} placeholder="0" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Probabilité (%)</label>
              <input type="number" min="0" max="100" value={form.probability} onChange={e=>set('probability',e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Étape</label>
              <select value={form.stage} onChange={e=>set('stage',e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                {STAGES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date closing</label>
              <input type="date" value={form.dueDate} onChange={e=>set('dueDate',e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
            </div>
          </div>
        </div>
        {error && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 mb-3"><AlertCircle className="w-4 h-4"/>{error}</div>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Annuler</button>
          <button onClick={save} disabled={loading} className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
            {loading?<Loader2 className="w-4 h-4 animate-spin"/>:<CheckCircle className="w-4 h-4"/>}Créer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<string|null>(null);
  const [moving, setMoving] = useState<string|null>(null);
  const API = process.env.NEXT_PUBLIC_API_URL || '';

  const showToast = (msg:string) => { setToast(msg); setTimeout(()=>setToast(null),3000); };

  const fetchDeals = async () => {
    try {
      const token = localStorage.getItem('access_token')||'';
      const res = await fetch(`${API}/api/v1/deals`,{headers:{Authorization:`Bearer ${token}`}});
      if (res.ok) { const d=await res.json(); setDeals(Array.isArray(d)?d:d.data||[]); }
    } catch {}
  };

  useEffect(()=>{ fetchDeals(); },[]);

  const moveStage = async (dealId:string, newStage:string) => {
    setMoving(dealId);
    try {
      const token = localStorage.getItem('access_token')||'';
      await fetch(`${API}/api/v1/deals/${dealId}/move`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({stage:newStage})});
      setDeals(d=>d.map(x=>x.id===dealId?{...x,stage:newStage}:x));
    } catch { showToast('Erreur lors du déplacement'); }
    finally { setMoving(null); }
  };

  const totalPipeline = deals.filter(d=>!['won','lost'].includes(d.stage)).reduce((s,d)=>s+d.value,0);
  const wonValue = deals.filter(d=>d.stage==='won').reduce((s,d)=>s+d.value,0);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {toast && <div className="fixed top-6 right-6 z-50 bg-teal-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4"/>{toast}</div>}
      {showCreate && <CreateDealModal apiUrl={API} onClose={()=>setShowCreate(false)} onSave={d=>{setDeals(prev=>[...prev,d]);showToast('Deal créé ✓');}}/>}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pipeline Commercial</h1>
          <p className="text-sm text-gray-400">{deals.length} deals · {totalPipeline.toLocaleString()}€ en cours · {wonValue.toLocaleString()}€ gagnés</p>
        </div>
        <button onClick={()=>setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700">
          <Plus className="w-4 h-4"/>Nouveau deal
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4" style={{minHeight:'calc(100vh - 200px)'}}>
        {STAGES.map(stage => {
          const stageDeals = deals.filter(d=>d.stage===stage.id);
          const stageValue = stageDeals.reduce((s,d)=>s+d.value,0);
          return (
            <div key={stage.id} className="flex-shrink-0 w-72">
              <div className={`${stage.color} border rounded-xl px-3 py-2 mb-3 flex items-center justify-between`}>
                <span className="font-semibold text-gray-800 text-sm">{stage.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-600">{stageDeals.length}</span>
                  {stageValue>0 && <span className="text-xs text-gray-400">{stageValue.toLocaleString()}€</span>}
                </div>
              </div>
              <div className="space-y-3">
                {stageDeals.map(deal => {
                  const stageIdx = STAGES.findIndex(s=>s.id===deal.stage);
                  return (
                    <div key={deal.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-teal-200 transition-all">
                      <div className="flex items-start justify-between mb-2 cursor-pointer" onClick={()=>router.push(`/pipeline/${deal.id}`)}>
                        <h3 className="font-medium text-gray-900 text-sm leading-tight flex-1">{deal.title}</h3>
                        <MoreHorizontal className="w-4 h-4 text-gray-300 ml-1 flex-shrink-0"/>
                      </div>
                      <p className="text-xs text-gray-400 mb-3 cursor-pointer" onClick={()=>router.push(`/pipeline/${deal.id}`)}>
                        {deal.company}{deal.contact?` · ${deal.contact}`:''}
                      </p>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-gray-900 text-sm">{deal.value.toLocaleString()}€</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${deal.probability>=70?'bg-green-50 text-green-600':deal.probability>=40?'bg-amber-50 text-amber-600':'bg-gray-100 text-gray-500'}`}>{deal.probability}%</span>
                      </div>
                      {deal.dueDate && <div className="flex items-center gap-1 text-xs text-gray-400 mb-3"><Calendar className="w-3 h-3"/>{new Date(deal.dueDate).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}</div>}
                      {/* Boutons déplacer stage */}
                      <div className="flex gap-1.5 pt-2 border-t border-gray-100">
                        {stageIdx > 0 && (
                          <button onClick={()=>moveStage(deal.id,STAGES[stageIdx-1].id)} disabled={moving===deal.id}
                            className="flex-1 py-1.5 text-xs bg-gray-50 text-gray-500 rounded-lg hover:bg-gray-100 transition-all">
                            ← {STAGES[stageIdx-1].label}
                          </button>
                        )}
                        {stageIdx < STAGES.length-1 && (
                          <button onClick={()=>moveStage(deal.id,STAGES[stageIdx+1].id)} disabled={moving===deal.id}
                            className="flex-1 py-1.5 text-xs bg-teal-50 text-teal-600 rounded-lg hover:bg-teal-100 transition-all font-medium">
                            {STAGES[stageIdx+1].label} →
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                <button onClick={()=>setShowCreate(true)} className="w-full py-2 text-sm text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-xl border border-dashed border-gray-200 hover:border-teal-300 transition-all">
                  <Plus className="w-4 h-4 inline mr-1"/>Ajouter
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
