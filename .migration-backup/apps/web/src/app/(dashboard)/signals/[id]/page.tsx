'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, TrendingUp, Building2, ExternalLink, Zap, Star,
  CheckCircle, Loader2, X, Mail, UserPlus, DollarSign, AlertCircle
} from 'lucide-react';

const TYPE_CONFIG: Record<string,{label:string;color:string;bg:string;icon:string}> = {
  funding:   { label:'Financement', color:'text-green-700', bg:'bg-green-50 border-green-200', icon:'💰' },
  hiring:    { label:'Recrutement', color:'text-blue-700',  bg:'bg-blue-50 border-blue-200',   icon:'👥' },
  news:      { label:'Actualité',   color:'text-purple-700',bg:'bg-purple-50 border-purple-200',icon:'📰' },
  technology:{ label:'Technologie', color:'text-yellow-700',bg:'bg-yellow-50 border-yellow-200',icon:'⚙️' },
  intent:    { label:'Intention',   color:'text-red-700',   bg:'bg-red-50 border-red-200',      icon:'🎯' },
};

export default function SignalDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [signal, setSignal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string|null>(null);
  const [toast, setToast] = useState<{msg:string;type:'success'|'error'}|null>(null);
  const API = process.env.NEXT_PUBLIC_API_URL || '';

  const showToast = (msg:string, type:'success'|'error'='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3500); };

  useEffect(()=>{
    const fetch_ = async () => {
      try {
        const token = localStorage.getItem('access_token')||'';
        const res = await fetch(`${API}/api/v1/signals`,{headers:{Authorization:`Bearer ${token}`}});
        if (res.ok) {
          const d = await res.json();
          const list = Array.isArray(d)?d:d.data||[];
          const found = list.find((s:any)=>s.id===String(id));
          setSignal(found || getMockSignal(String(id)));
        } else setSignal(getMockSignal(String(id)));
      } catch { setSignal(getMockSignal(String(id))); }
      finally { setLoading(false); }
    };
    fetch_();
  },[id]);

  const markRead = async () => {
    try {
      const token = localStorage.getItem('access_token')||'';
      await fetch(`${API}/api/v1/signals/${id}/read`,{method:'PATCH',headers:{Authorization:`Bearer ${token}`}});
      setSignal((s:any)=>({...s,isRead:true}));
    } catch {}
  };

  useEffect(()=>{ if(signal&&!signal.isRead) markRead(); },[signal]);

  const createProspect = async () => {
    setActing('prospect');
    try {
      const token = localStorage.getItem('access_token')||'';
      await fetch(`${API}/api/v1/prospects`,{
        method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
        body:JSON.stringify({ company:signal?.company, status:'new', notes:`Signal détecté: ${signal?.title}` }),
      });
      showToast('Prospect créé à partir du signal ✓');
    } catch { showToast('Erreur','error'); }
    finally { setActing(null); }
  };

  if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-teal-600"/></div>;
  if (!signal) return <div className="p-6"><p className="text-gray-400">Signal non trouvé</p></div>;

  const type = TYPE_CONFIG[signal.type]||TYPE_CONFIG.news;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {toast && <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${toast.type==='success'?'bg-teal-600 text-white':'bg-red-500 text-white'}`}>
        {toast.type==='success'?<CheckCircle className="w-4 h-4"/>:<AlertCircle className="w-4 h-4"/>}{toast.msg}
      </div>}

      <div className="flex items-center gap-4 mb-6">
        <button onClick={()=>router.back()} className="p-2 hover:bg-gray-200 rounded-xl"><ArrowLeft className="w-5 h-5 text-gray-600"/></button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-3xl">{type.icon}</span>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{signal.title}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <Building2 className="w-4 h-4 text-gray-400"/>
                <span className="text-sm text-gray-500">{signal.company}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${type.bg} ${type.color}`}>{type.label}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${signal.score>=80?'bg-green-50 text-green-600':'bg-amber-50 text-amber-600'}`}>Score {signal.score}</span>
              </div>
            </div>
          </div>
        </div>
        <button onClick={()=>setSignal((s:any)=>({...s,isStarred:!s.isStarred}))}
          className={`p-2 rounded-xl border ${signal.isStarred?'bg-amber-50 border-amber-200 text-amber-400':'bg-white border-gray-200 text-gray-300 hover:text-amber-400'}`}>
          <Star className={`w-5 h-5 ${signal.isStarred?'fill-amber-400':''}`}/>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-4">
          {/* Description */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-3">Détails du signal</h2>
            <p className="text-sm text-gray-700 leading-relaxed">{signal.description||'Aucune description disponible.'}</p>
            {signal.url && (
              <a href={signal.url} target="_blank" className="inline-flex items-center gap-2 mt-4 text-sm text-teal-600 hover:text-teal-700">
                <ExternalLink className="w-4 h-4"/>Voir la source originale
              </a>
            )}
          </div>

          {/* Tags */}
          {signal.tags?.length>0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-3">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {signal.tags.map((t:string)=><span key={t} className="text-xs bg-teal-50 text-teal-700 px-3 py-1 rounded-full">{t}</span>)}
              </div>
            </div>
          )}
        </div>

        {/* Actions sidebar */}
        <div className="space-y-4">
          {/* Recommandations IA */}
          {signal.recommendations?.length>0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-teal-600"/>Recommandations IA
              </h3>
              <div className="space-y-2">
                {signal.recommendations.map((r:string,i:number)=>(
                  <div key={i} className="flex items-start gap-2 p-3 bg-teal-50 rounded-xl">
                    <CheckCircle className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5"/>
                    <span className="text-xs text-teal-800 leading-relaxed">{r}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions rapides */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Actions rapides</h3>
            <div className="space-y-2">
              <button onClick={createProspect} disabled={acting==='prospect'}
                className="w-full flex items-center gap-3 p-3 bg-teal-50 text-teal-700 rounded-xl text-sm font-medium hover:bg-teal-100">
                {acting==='prospect'?<Loader2 className="w-4 h-4 animate-spin"/>:<UserPlus className="w-4 h-4"/>}Créer un prospect
              </button>
              <button onClick={()=>{router.push('/pipeline');showToast('Redirigé vers le pipeline');}}
                className="w-full flex items-center gap-3 p-3 bg-green-50 text-green-700 rounded-xl text-sm font-medium hover:bg-green-100">
                <DollarSign className="w-4 h-4"/>Créer un deal
              </button>
              <button onClick={()=>showToast('Email composer — configurer SMTP d\'abord')}
                className="w-full flex items-center gap-3 p-3 bg-purple-50 text-purple-700 rounded-xl text-sm font-medium hover:bg-purple-100">
                <Mail className="w-4 h-4"/>Envoyer un email
              </button>
            </div>
          </div>

          {/* Métadonnées */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Infos</h3>
            <dl className="space-y-2 text-sm">
              {[
                ['Entreprise',signal.company],
                ['Type',type.label],
                ['Score',`${signal.score}/100`],
                ['Détecté',signal.createdAt||'Aujourd\'hui'],
                ['Statut',signal.isRead?'Lu':'Non lu'],
              ].map(([k,v])=>(
                <div key={k} className="flex justify-between">
                  <dt className="text-gray-400">{k}</dt>
                  <dd className="font-medium text-gray-900">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

function getMockSignal(id:string) {
  const MOCK: Record<string,any> = {
    '1':{ id:'1',type:'funding',company:'TechVision',title:'Levée de fonds Série A — 5M€',description:'TechVision vient d\'annoncer une levée de fonds de 5 millions d\'euros en Série A auprès du fonds Partech. L\'entreprise prévoit d\'utiliser ces fonds pour accélérer son développement commercial et recruter une équipe sales.',score:92,isRead:false,isStarred:false,url:'https://techcrunch.com',createdAt:'2026-05-26',tags:['Funding','Scale-up','Tech'],recommendations:['Contacter le nouveau VP Sales sous 48h','Préparer une offre Enterprise sur mesure','Mentionner leur croissance dans le premier email'] },
    '2':{ id:'2',type:'hiring',company:'BigCorp',title:'Recrute 5 commerciaux B2B',description:'BigCorp est en recherche active de commerciaux B2B, ce qui indique une phase de scale commercial.',score:78,isRead:true,isStarred:true,url:'https://linkedin.com',createdAt:'2026-05-25',tags:['Hiring','Sales','B2B'],recommendations:['Cible: Directeur Commercial ou CRO','Angle: Automatisez l\'onboarding de vos nouveaux commerciaux'] },
  };
  return MOCK[id]||MOCK['1'];
}
