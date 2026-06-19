import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import {
  Mail, Play, Pause, Plus, Loader2, Users, Search, X,
  Copy, Trash2, TrendingUp, BarChart2, ChevronRight, Clock,
  CheckCircle, MessageSquare, Phone, Calendar,
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

const STATUS_LABELS: Record<string,string> = { active:'Active', paused:'En pause', draft:'Brouillon' };
const STATUS_COLORS: Record<string,string> = {
  active:'bg-green-50 text-green-600', paused:'bg-amber-50 text-amber-600', draft:'bg-gray-100 text-gray-500',
};

const STEP_ICONS: Record<string,React.ReactNode> = {
  email:   <Mail size={10}/>,
  delay:   <Clock size={10}/>,
  task:    <CheckCircle size={10}/>,
  call:    <Phone size={10}/>,
  linkedin:<MessageSquare size={10}/>,
  meeting: <Calendar size={10}/>,
};

const TEMPLATES = [
  {
    id:'cold_b2b', name:'Cold Outreach B2B', icon:'🎯',
    description:'5 touches sur 14 jours — email + LinkedIn + relance',
    steps:[
      {type:'email',  label:'Email J1 — Accroche personnalisée', delay:0},
      {type:'delay',  label:'Attente 3 jours', delay:3},
      {type:'linkedin',label:'Message LinkedIn', delay:0},
      {type:'delay',  label:'Attente 4 jours', delay:4},
      {type:'email',  label:'Email J7 — Valeur ajoutée', delay:0},
      {type:'delay',  label:'Attente 7 jours', delay:7},
      {type:'email',  label:'Email J14 — Breakup', delay:0},
    ],
  },
  {
    id:'nurturing', name:'Nurturing Qualifiés', icon:'🌱',
    description:'Séquence longue 30j pour prospects qualifiés',
    steps:[
      {type:'email',  label:'Email J1 — Bienvenue', delay:0},
      {type:'delay',  label:'Attente 7 jours', delay:7},
      {type:'email',  label:'Email J7 — Étude de cas', delay:0},
      {type:'delay',  label:'Attente 7 jours', delay:7},
      {type:'call',   label:'Appel J14 — Qualification', delay:0},
      {type:'delay',  label:'Attente 7 jours', delay:7},
      {type:'email',  label:'Email J21 — Démo / Offre', delay:0},
      {type:'delay',  label:'Attente 9 jours', delay:9},
      {type:'email',  label:'Email J30 — Décision finale', delay:0},
    ],
  },
  {
    id:'onboarding', name:'Onboarding Client', icon:'🚀',
    description:'3 emails de bienvenue sur 7 jours',
    steps:[
      {type:'email',  label:'Email J1 — Bienvenue & accès', delay:0},
      {type:'delay',  label:'Attente 3 jours', delay:3},
      {type:'email',  label:'Email J3 — Premiers pas', delay:0},
      {type:'delay',  label:'Attente 4 jours', delay:4},
      {type:'email',  label:'Email J7 — Check-in', delay:0},
    ],
  },
  {
    id:'reactivation', name:'Réactivation Inactifs', icon:'🔄',
    description:'2 emails pour relancer des prospects froids',
    steps:[
      {type:'email',  label:'Email — "Êtes-vous encore intéressé ?"', delay:0},
      {type:'delay',  label:'Attente 5 jours', delay:5},
      {type:'email',  label:'Email — Dernière tentative', delay:0},
    ],
  },
  { id:'blank', name:'Séquence vide', icon:'✏️', description:'Partez de zéro', steps:[] },
];


function NewSequenceModal({ onClose, onCreate }: { onClose:()=>void; onCreate:(s:any)=>void }) {
  const [step, setStep] = useState<1|2>(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [loading, setLoading] = useState(false);

  const create = async () => {
    if (!name.trim()) { toast.error('Nom requis'); return; }
    setLoading(true);
    const tpl = TEMPLATES.find(t=>t.id===selectedTemplate);
    const newSeq = {
      name, description,
      status:'draft',
      steps: tpl?.steps || [],
      enrolled:0, completed:0, openRate:0, replyRate:0,
      createdAt: new Date().toISOString().slice(0,10),
    };
    try {
      const saved = await apiClient.post('/sequences', newSeq).catch(()=>null);
      onCreate(saved || { ...newSeq, id: Date.now().toString() });
      toast.success('Séquence créée');
      onClose();
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600"><Mail size={16}/></div>
            <h2 className="text-base font-bold text-gray-900">Nouvelle séquence</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${step>=1?'bg-purple-600 text-white':'bg-gray-100 text-gray-400'}`}>1</span>
              <div className={`w-10 h-0.5 ${step>=2?'bg-purple-600':'bg-gray-200'}`}/>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${step>=2?'bg-purple-600 text-white':'bg-gray-100 text-gray-400'}`}>2</span>
            </div>
            <button onClick={onClose}><X size={18} className="text-gray-400"/></button>
          </div>
        </div>

        <div className="p-6">
          {step === 1 ? (
            <>
              <h3 className="font-semibold text-gray-800 mb-4">Choisissez un template</h3>
              <div className="grid grid-cols-2 gap-3 mb-5">
                {TEMPLATES.map(t=>(
                  <button key={t.id} onClick={()=>setSelectedTemplate(t.id)}
                    className={`text-left p-3 rounded-xl border-2 transition-all ${selectedTemplate===t.id?'border-purple-500 bg-purple-50':'border-gray-200 hover:border-gray-300'}`}>
                    <div className="text-xl mb-1.5">{t.icon}</div>
                    <div className="font-semibold text-sm text-gray-900 mb-0.5">{t.name}</div>
                    <div className="text-xs text-gray-400">{t.description}</div>
                    {t.steps.length>0 && (
                      <div className="flex items-center gap-0.5 mt-2">
                        {t.steps.slice(0,6).map((s,i)=>(
                          <div key={i} className={`w-4 h-4 rounded flex items-center justify-center ${s.type==='delay'?'bg-gray-100 text-gray-400':'bg-purple-100 text-purple-600'}`}>
                            {STEP_ICONS[s.type]||<Mail size={10}/>}
                          </div>
                        ))}
                        {t.steps.length>6&&<span className="text-xs text-gray-400">+{t.steps.length-6}</span>}
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Annuler</button>
                <button onClick={()=>setStep(2)} disabled={!selectedTemplate} className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">Suivant →</button>
              </div>
            </>
          ) : (
            <>
              <h3 className="font-semibold text-gray-800 mb-4">Nommez votre séquence</h3>
              <div className="space-y-3 mb-5">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Nom de la séquence *</label>
                  <input value={name} onChange={e=>setName(e.target.value)} autoFocus
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Ex: Cold Outreach Fintech Q2 2026"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                  <textarea value={description} onChange={e=>setDescription(e.target.value)} rows={2}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    placeholder="Objectif, cible, contexte..."/>
                </div>
                {/* Template preview */}
                {selectedTemplate && selectedTemplate !== 'blank' && (
                  <div className="rounded-xl bg-gray-50 p-3">
                    <div className="text-xs font-medium text-gray-500 mb-2">Étapes du template :</div>
                    <div className="flex flex-wrap gap-1">
                      {TEMPLATES.find(t=>t.id===selectedTemplate)?.steps.map((s,i)=>(
                        <div key={i} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${s.type==='delay'?'bg-gray-100 text-gray-500':'bg-purple-100 text-purple-700'}`}>
                          {STEP_ICONS[s.type]||<Mail size={10}/>}
                          {s.label.length > 20 ? s.label.slice(0,20)+'…' : s.label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={()=>setStep(1)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">← Retour</button>
                <button onClick={create} disabled={!name.trim()||loading}
                  className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading?<Loader2 size={14} className="animate-spin"/>:<CheckCircle size={14}/>}Créer la séquence
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SequencesPage() {
  const [, navigate] = useLocation();
  const [sequences, setSequences] = useState<any[]>([]);
  const [toggling, setToggling] = useState<string|null>(null);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  useEffect(()=>{
    setLoading(true);
    apiClient.get('/sequences').then((d: any) => {
      const l = Array.isArray(d) ? d : d.data || [];
      setSequences(l);
    }).catch(()=>{}).finally(()=>setLoading(false));
    const onNouveau = () => setShowNew(true);
    window.addEventListener('growthos:nouveau', onNouveau);
    return () => window.removeEventListener('growthos:nouveau', onNouveau);
  },[]);

  const toggle = async (id:string, e:React.MouseEvent) => {
    e.stopPropagation(); setToggling(id);
    try {
      await apiClient.post(`/sequences/${id}/toggle`, {}).catch(()=>null);
      setSequences(s=>s.map(x=>x.id===id?{...x,status:x.status==='active'?'paused':'active'}:x));
      toast.success('Statut mis à jour');
    } finally { setToggling(null); }
  };

  const duplicate = (seq: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const copy = { ...seq, id: Date.now().toString(), name: `${seq.name} (copie)`, status:'draft', enrolled:0, completed:0 };
    setSequences(s=>[...s, copy]);
    toast.success('Séquence dupliquée');
  };

  const remove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Supprimer cette séquence ?')) return;
    setSequences(s=>s.filter(x=>x.id!==id));
    apiClient.delete(`/sequences/${id}`).catch(()=>{});
    toast.success('Séquence supprimée');
  };

  const filtered = sequences.filter(s=>{
    const q = search.toLowerCase();
    const matchSearch = !q || `${s.name} ${s.description}`.toLowerCase().includes(q);
    const matchStatus = statusFilter==='all' || s.status===statusFilter;
    return matchSearch && matchStatus;
  });

  const active = sequences.filter(s=>s.status==='active');
  const avgOpen = active.filter(s=>s.openRate>0).reduce((sum,s,_,arr)=>sum+s.openRate/arr.length,0);
  const avgReply = active.filter(s=>s.replyRate>0).reduce((sum,s,_,arr)=>sum+s.replyRate/arr.length,0);
  const totalEnrolled = sequences.reduce((s,x)=>s+x.enrolled,0);

  return (
    <div className="min-h-screen p-6" style={{background:'var(--body-bg)'}}>
      {showNew && <NewSequenceModal onClose={()=>setShowNew(false)} onCreate={s=>setSequences(prev=>[s,...prev])}/>}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>Séquences Email</h1>
          <p className="text-sm" style={{color:'var(--text-muted)'}}>{active.length} active{active.length>1?'s':''} · {sequences.length} au total</p>
        </div>
        <button onClick={()=>setShowNew(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{background:'var(--color-primary)'}}>
          <Plus size={14}/>Nouvelle séquence
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          {label:'Prospects inscrits', value:totalEnrolled, icon:<Users size={16}/>, color:'text-blue-600 bg-blue-50'},
          {label:'Taux d\'ouverture moy.', value:`${avgOpen.toFixed(1)}%`, icon:<Mail size={16}/>, color:'text-purple-600 bg-purple-50'},
          {label:'Taux de réponse moy.', value:`${avgReply.toFixed(1)}%`, icon:<MessageSquare size={16}/>, color:'text-teal-600 bg-teal-50'},
          {label:'Séquences actives', value:active.length, icon:<Play size={16}/>, color:'text-green-600 bg-green-50'},
        ].map((s,i)=>(
          <div key={i} className="rounded-2xl border p-4 flex items-center gap-3" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${s.color}`}>{s.icon}</div>
            <div>
              <div className="text-xl font-bold" style={{color:'var(--text-primary)'}}>{s.value}</div>
              <div className="text-xs" style={{color:'var(--text-muted)'}}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{color:'var(--text-muted)'}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher..."
            className="w-full pl-8 pr-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            style={{background:'var(--card-bg)',border:'1px solid var(--card-border)',color:'var(--text-primary)'}}/>
        </div>
        <div className="flex gap-1 p-1 rounded-xl" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
          {[{v:'all',l:'Toutes'},{v:'active',l:'Actives'},{v:'paused',l:'En pause'},{v:'draft',l:'Brouillons'}].map(f=>(
            <button key={f.v} onClick={()=>setStatusFilter(f.v)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={statusFilter===f.v?{background:'var(--color-primary)',color:'#fff'}:{color:'var(--text-muted)',background:'transparent',border:'none',cursor:'pointer'}}>
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading && filtered.length===0 ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin" style={{color:'var(--color-primary)'}}/></div>
      ) : filtered.length===0 ? (
        <div className="rounded-2xl border py-16 text-center" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
          <Mail size={40} className="mx-auto mb-3" style={{color:'var(--card-border)'}}/>
          <p className="text-sm mb-4" style={{color:'var(--text-muted)'}}>Aucune séquence trouvée</p>
          <button onClick={()=>setShowNew(true)} className="px-4 py-2 rounded-xl text-sm text-white" style={{background:'var(--color-primary)'}}>+ Créer une séquence</button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(seq=>{
            const pct = seq.enrolled>0 ? Math.round(seq.completed/seq.enrolled*100) : 0;
            return (
              <div key={seq.id} onClick={()=>navigate(`/sequences/${seq.id}`)}
                className="rounded-2xl border p-5 cursor-pointer transition-all hover:shadow-md group"
                style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}
                onMouseEnter={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--color-primary)'}
                onMouseLeave={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--card-border)'}>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:'#F5F3FF',color:'#7C3AED'}}>
                    <Mail size={18}/>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-sm" style={{color:'var(--text-primary)'}}>{seq.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[seq.status]||STATUS_COLORS.draft}`}>
                        {STATUS_LABELS[seq.status]||seq.status}
                      </span>
                    </div>
                    {seq.description && <p className="text-xs mb-3" style={{color:'var(--text-muted)'}}>{seq.description}</p>}

                    {/* Step mini-flow */}
                    {seq.steps?.length > 0 && (
                      <div className="flex items-center gap-0.5 mb-3 flex-wrap">
                        {seq.steps.slice(0,9).map((s:any,i:number)=>(
                          <div key={i} className="flex items-center gap-0.5">
                            <div className={`w-5 h-5 rounded flex items-center justify-center ${s.type==='delay'?'bg-gray-100 text-gray-400':'bg-purple-100 text-purple-600'}`}>
                              {STEP_ICONS[s.type as string]||<Mail size={10}/>}
                            </div>
                            {i<seq.steps.length-1&&i<8&&<div className="w-2 h-px bg-gray-200"/>}
                          </div>
                        ))}
                        {seq.steps.length>9&&<span className="text-xs" style={{color:'var(--text-muted)'}}>+{seq.steps.length-9}</span>}
                        <span className="text-xs ml-1" style={{color:'var(--text-muted)'}}>{seq.steps.length} étapes</span>
                      </div>
                    )}

                    {/* Stats row */}
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-1 text-xs" style={{color:'var(--text-muted)'}}>
                        <Users size={11}/><span>{seq.enrolled} inscrits</span>
                      </div>
                      {seq.openRate>0&&(
                        <div className="flex items-center gap-1 text-xs" style={{color:'var(--text-muted)'}}>
                          <TrendingUp size={11}/><span>{seq.openRate}% ouv.</span>
                        </div>
                      )}
                      {seq.replyRate>0&&(
                        <div className="flex items-center gap-1 text-xs" style={{color:'var(--text-muted)'}}>
                          <MessageSquare size={11}/><span>{seq.replyRate}% rép.</span>
                        </div>
                      )}
                      {seq.enrolled>0&&(
                        <div className="flex items-center gap-2 text-xs" style={{color:'var(--text-muted)'}}>
                          <div className="w-16 bg-gray-100 rounded-full h-1">
                            <div className="h-1 rounded-full bg-purple-500" style={{width:`${pct}%`}}/>
                          </div>
                          <span>{pct}% terminés</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0" onClick={e=>e.stopPropagation()}>
                    <button onClick={e=>toggle(seq.id,e)} disabled={!!toggling||seq.status==='draft'}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all disabled:opacity-40"
                      style={seq.status==='active'?{background:'#FFFBEB',color:'#D97706'}:{background:'#ECFDF5',color:'#059669'}}>
                      {toggling===seq.id?<Loader2 size={12} className="animate-spin"/>:seq.status==='active'?<><Pause size={12}/>Pause</>:<><Play size={12}/>Lancer</>}
                    </button>
                    <button onClick={e=>duplicate(seq,e)} className="p-1.5 rounded-xl hover:bg-gray-100 transition-colors" title="Dupliquer">
                      <Copy size={13} style={{color:'var(--text-muted)'}}/>
                    </button>
                    <button onClick={e=>remove(seq.id,e)} className="p-1.5 rounded-xl hover:bg-red-50 transition-colors" title="Supprimer">
                      <Trash2 size={13} className="text-red-400"/>
                    </button>
                    <ChevronRight size={16} style={{color:'var(--text-muted)'}}/>
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
