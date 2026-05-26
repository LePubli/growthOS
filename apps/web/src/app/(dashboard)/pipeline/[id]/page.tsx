'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Edit2, Save, X, Euro, Calendar, TrendingUp, Loader2, CheckCircle, AlertCircle, Trophy, XCircle, Mail, Phone, Plus, Clock } from 'lucide-react';

const STAGES = [
  { id:'lead', label:'Lead' },{ id:'qualified', label:'Qualifié' },
  { id:'proposal', label:'Proposition' },{ id:'negotiation', label:'Négociation' },
  { id:'won', label:'Gagné' },{ id:'lost', label:'Perdu' },
];

export default function DealDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [deal, setDeal] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState<'won'|'lost'|null>(null);
  const [lostReason, setLostReason] = useState('');
  const [showCloseModal, setShowCloseModal] = useState<'won'|'lost'|null>(null);
  const [toast, setToast] = useState<{msg:string;type:'success'|'error'}|null>(null);
  const API = process.env.NEXT_PUBLIC_API_URL || '';

  const showToast = (msg:string, type:'success'|'error'='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3500); };

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const token = localStorage.getItem('access_token')||'';
        const res = await fetch(`${API}/api/v1/deals/${id}`,{headers:{Authorization:`Bearer ${token}`}});
        if (res.ok) { const d=await res.json(); setDeal(d); setForm(d); }
        else setDeal({ id, title:'Deal', company:'', value:0, probability:50, stage:'lead', tags:[] });
      } catch {}
    };
    fetch_();
  }, [id]);

  const save = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('access_token')||'';
      const res = await fetch(`${API}/api/v1/deals/${id}`, {
        method:'PATCH', headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
        body:JSON.stringify(form),
      });
      if (res.ok) { const d=await res.json(); setDeal(d); setEditing(false); showToast('Deal mis à jour ✓'); }
    } catch { showToast('Erreur','error'); }
    finally { setSaving(false); }
  };

  const moveStage = async (stage:string) => {
    try {
      const token = localStorage.getItem('access_token')||'';
      await fetch(`${API}/api/v1/deals/${id}/move`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({stage})});
      setDeal((d:any)=>({...d,stage}));
    } catch {}
  };

  const closeDeal = async (result: 'won'|'lost') => {
    setClosing(result);
    try {
      const token = localStorage.getItem('access_token')||'';
      const notes = result==='lost' ? `${deal?.notes||''}\n\nRaison perte: ${lostReason}` : deal?.notes;
      await fetch(`${API}/api/v1/deals/${id}`, {
        method:'PATCH', headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
        body:JSON.stringify({ stage:result, probability:result==='won'?100:0, notes }),
      });
      setDeal((d:any)=>({...d,stage:result,probability:result==='won'?100:0}));
      setShowCloseModal(null);
      showToast(result==='won'?'🎉 Deal gagné ! Félicitations !':'Deal perdu. Dommage !');
    } catch { showToast('Erreur','error'); }
    finally { setClosing(null); }
  };

  if (!deal) return <div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-teal-600"/></div>;

  const stageIdx = STAGES.findIndex(s=>s.id===deal.stage);
  const isActive = !['won','lost'].includes(deal.stage);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {toast && <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${toast.type==='success'?'bg-teal-600 text-white':'bg-red-500 text-white'}`}>
        {toast.type==='success'?<CheckCircle className="w-4 h-4"/>:<AlertCircle className="w-4 h-4"/>}{toast.msg}
      </div>}

      {/* Modal closing gagné */}
      {showCloseModal==='won' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl text-center">
            <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4"/>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Marquer comme gagné ?</h2>
            <p className="text-sm text-gray-500 mb-2">Valeur : <strong className="text-green-600">{deal.value?.toLocaleString()}€</strong></p>
            <p className="text-sm text-gray-400 mb-6">Bravo ! Cette action fermera le deal et mettra à jour vos statistiques.</p>
            <div className="flex gap-3">
              <button onClick={()=>setShowCloseModal(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm">Annuler</button>
              <button onClick={()=>closeDeal('won')} disabled={!!closing} className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                {closing?<Loader2 className="w-4 h-4 animate-spin"/>:<Trophy className="w-4 h-4"/>}Confirmer Gagné
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal closing perdu */}
      {showCloseModal==='lost' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4"><XCircle className="w-8 h-8 text-red-500"/><h2 className="text-lg font-bold text-gray-900">Marquer comme perdu</h2></div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-1">Raison de la perte (optionnel)</label>
              <select value={lostReason} onChange={e=>setLostReason(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 mb-2">
                <option value="">Sélectionner une raison...</option>
                <option value="Prix trop élevé">Prix trop élevé</option>
                <option value="Concurrent choisi">Concurrent choisi</option>
                <option value="Pas de budget">Pas de budget</option>
                <option value="Timing inadapté">Timing inadapté</option>
                <option value="Besoins non satisfaits">Besoins non satisfaits</option>
                <option value="Sans réponse">Sans réponse</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>setShowCloseModal(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm">Annuler</button>
              <button onClick={()=>closeDeal('lost')} disabled={!!closing} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                {closing?<Loader2 className="w-4 h-4 animate-spin"/>:<XCircle className="w-4 h-4"/>}Confirmer Perdu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={()=>router.back()} className="p-2 hover:bg-gray-200 rounded-xl"><ArrowLeft className="w-5 h-5 text-gray-600"/></button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{deal.title}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${deal.stage==='won'?'bg-green-50 text-green-600':deal.stage==='lost'?'bg-red-50 text-red-500':'bg-blue-50 text-blue-600'}`}>{STAGES.find(s=>s.id===deal.stage)?.label}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {isActive && <>
            <button onClick={()=>setShowCloseModal('won')} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700">
              <Trophy className="w-4 h-4"/>Gagné
            </button>
            <button onClick={()=>setShowCloseModal('lost')} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-500 rounded-xl text-sm font-medium hover:bg-red-100">
              <XCircle className="w-4 h-4"/>Perdu
            </button>
          </>}
          {editing?(
            <>
              <button onClick={()=>setEditing(false)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600"><X className="w-4 h-4 inline mr-1"/>Annuler</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium flex items-center gap-2">
                {saving?<Loader2 className="w-4 h-4 animate-spin"/>:<Save className="w-4 h-4"/>}Sauvegarder
              </button>
            </>
          ):(
            <button onClick={()=>setEditing(true)} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-teal-300"><Edit2 className="w-4 h-4"/>Modifier</button>
          )}
        </div>
      </div>

      {/* Deal fermé */}
      {!isActive && (
        <div className={`rounded-2xl p-4 mb-5 flex items-center gap-4 ${deal.stage==='won'?'bg-green-50 border border-green-200':'bg-red-50 border border-red-200'}`}>
          {deal.stage==='won'?<Trophy className="w-8 h-8 text-yellow-500"/>:<XCircle className="w-8 h-8 text-red-400"/>}
          <div>
            <div className={`font-bold text-lg ${deal.stage==='won'?'text-green-700':'text-red-600'}`}>{deal.stage==='won'?`🎉 Deal gagné — ${deal.value?.toLocaleString()}€`:'Deal perdu'}</div>
            <div className="text-sm text-gray-500">Ce deal est clôturé. Vous pouvez le rouvrir en changeant l'étape.</div>
          </div>
        </div>
      )}

      {/* Progression pipeline */}
      {isActive && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
          <h2 className="font-semibold text-gray-900 mb-4">Progression</h2>
          <div className="flex items-center gap-1">
            {STAGES.filter(s=>!['won','lost'].includes(s.id)).map((s,i)=>{
              const done = i<=stageIdx;
              return (
                <div key={s.id} className="flex-1 flex flex-col items-center gap-1">
                  <button onClick={()=>moveStage(s.id)} className={`w-full h-2.5 rounded-full transition-all ${done?'bg-teal-500 hover:bg-teal-600':'bg-gray-200 hover:bg-gray-300'}`}/>
                  <span className={`text-xs ${deal.stage===s.id?'font-bold text-teal-600':'text-gray-400'}`}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-4">
            {[
              {label:'Valeur',value:`${(deal.value||0).toLocaleString()}€`,icon:<Euro className="w-5 h-5"/>,color:'text-green-600 bg-green-50'},
              {label:'Probabilité',value:`${deal.probability||0}%`,icon:<TrendingUp className="w-5 h-5"/>,color:'text-blue-600 bg-blue-50'},
              {label:'Closing',value:deal.dueDate?new Date(deal.dueDate).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}):'—',icon:<Calendar className="w-5 h-5"/>,color:'text-purple-600 bg-purple-50'},
            ].map((k,i)=>(
              <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${k.color}`}>{k.icon}</div>
                <div><div className="text-xl font-bold text-gray-900">{k.value}</div><div className="text-xs text-gray-400">{k.label}</div></div>
              </div>
            ))}
          </div>

          {/* Détails éditables */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Détails du deal</h2>
            <div className="grid grid-cols-2 gap-4">
              {[{k:'title',l:'Titre'},{k:'company',l:'Entreprise'},{k:'contact',l:'Contact principal'},{k:'value',l:'Valeur (€)'},{k:'probability',l:'Probabilité (%)'},{k:'dueDate',l:'Date de closing',type:'date'}].map(f=>(
                <div key={f.k}>
                  <label className="block text-xs text-gray-400 mb-1">{f.l}</label>
                  {editing?<input type={f.type||'text'} value={form[f.k]||''} onChange={e=>setForm((x:any)=>({...x,[f.k]:e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
                  :<p className="text-sm text-gray-900">{deal[f.k]||'—'}</p>}
                </div>
              ))}
            </div>
            <div className="mt-4">
              <label className="block text-xs text-gray-400 mb-1">Notes</label>
              {editing?<textarea value={form.notes||''} onChange={e=>setForm((x:any)=>({...x,notes:e.target.value}))} rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
              :<p className="text-sm text-gray-700 whitespace-pre-wrap">{deal.notes||'Aucune note'}</p>}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Actions rapides</h3>
            <div className="space-y-2">
              {[
                {icon:'📧',label:'Envoyer un email',color:'text-purple-600 bg-purple-50'},
                {icon:'📞',label:'Planifier un appel',color:'text-blue-600 bg-blue-50'},
                {icon:'📄',label:'Créer un devis',color:'text-yellow-600 bg-yellow-50'},
                {icon:'👤',label:'Voir le prospect',href:`/prospects`,color:'text-teal-600 bg-teal-50'},
              ].map((a,i)=>(
                <button key={i} onClick={()=>a.href?router.push(a.href):showToast(`${a.label} — à configurer`)} className={`w-full flex items-center gap-3 p-2.5 rounded-xl hover:opacity-80 transition-all ${a.color}`}>
                  <span>{a.icon}</span><span className="text-sm font-medium">{a.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Fermeture du deal */}
          {isActive && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Clôturer ce deal</h3>
              <div className="space-y-2">
                <button onClick={()=>setShowCloseModal('won')} className="w-full flex items-center gap-3 p-3 bg-green-50 text-green-700 rounded-xl text-sm font-medium hover:bg-green-100">
                  <Trophy className="w-4 h-4"/>Marquer comme Gagné
                </button>
                <button onClick={()=>setShowCloseModal('lost')} className="w-full flex items-center gap-3 p-3 bg-red-50 text-red-500 rounded-xl text-sm font-medium hover:bg-red-100">
                  <XCircle className="w-4 h-4"/>Marquer comme Perdu
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
