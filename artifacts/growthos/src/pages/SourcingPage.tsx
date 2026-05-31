import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import {
  Search, Plus, Play, Pause, CheckCircle, Clock, AlertCircle, Loader2,
  Globe, Users, ChevronRight, X, RotateCcw, Trash2, Eye, Zap, Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';

const SCRAPER_TYPES: Record<string, { name: string; icon: string; desc: string; color: string; fields: { key:string; label:string; placeholder:string; type?:string }[] }> = {
  linkedin: {
    name:'LinkedIn Sales Navigator', icon:'💼', desc:'Décideurs B2B — titre, entreprise, localisation', color:'#0A66C2',
    fields:[
      { key:'keywords', label:'Mots-clés / titre', placeholder:'Ex: Directeur Commercial, VP Sales, CEO' },
      { key:'location', label:'Localisation', placeholder:'Ex: Paris, Lyon, Île-de-France' },
      { key:'company_size', label:'Taille entreprise', placeholder:'Ex: 50-200, 200+, 1000+' },
      { key:'industry', label:'Secteur', placeholder:'Ex: SaaS, Fintech, Retail' },
      { key:'limit', label:'Nombre max. de profils', placeholder:'100', type:'number' },
    ],
  },
  google: {
    name:'Google Maps', icon:'🗺️', desc:'Établissements locaux, contacts et avis', color:'#EA4335',
    fields:[
      { key:'query', label:'Recherche', placeholder:'Ex: Agences immobilières Bordeaux' },
      { key:'location', label:'Ville / Zone', placeholder:'Ex: Bordeaux, 33000' },
      { key:'category', label:'Catégorie', placeholder:'Ex: restaurant, agence, artisan' },
      { key:'limit', label:'Nombre max.', placeholder:'50', type:'number' },
    ],
  },
  societe_info: {
    name:'Societe.info', icon:'🏢', desc:'Données légales entreprises françaises', color:'#1E3A5F',
    fields:[
      { key:'activity', label:'Activité / NAF', placeholder:'Ex: 6201Z, Logiciels, Conseil' },
      { key:'location', label:'Département / Région', placeholder:'Ex: 75, Île-de-France' },
      { key:'size', label:'Taille (effectif)', placeholder:'Ex: 10-49, 50-249' },
      { key:'keywords', label:'Mots-clés nom', placeholder:'Ex: Tech, Digital, Conseil' },
      { key:'limit', label:'Nombre max.', placeholder:'100', type:'number' },
    ],
  },
  twitter: {
    name:'Twitter / X', icon:'🐦', desc:'Signaux sociaux, mentions et profils', color:'#1D9BF0',
    fields:[
      { key:'keywords', label:'Mots-clés / hashtags', placeholder:'Ex: #SaaS #startup levée fonds' },
      { key:'location', label:'Localisation', placeholder:'Ex: France' },
      { key:'min_followers', label:'Followers minimum', placeholder:'1000', type:'number' },
      { key:'limit', label:'Nombre max.', placeholder:'50', type:'number' },
    ],
  },
  custom: {
    name:'Custom Scraper', icon:'⚙️', desc:'Script personnalisé via URL ou API', color:'#6B7280',
    fields:[
      { key:'url', label:'URL cible', placeholder:'https://exemple.com/annuaire' },
      { key:'selector', label:'Sélecteur CSS (optionnel)', placeholder:'.contact-card, .listing-item' },
      { key:'script', label:'Script JS (optionnel)', placeholder:'// return { name, email, company }' },
      { key:'limit', label:'Nombre max.', placeholder:'50', type:'number' },
    ],
  },
};

const STATUS_CONFIG: Record<string,{label:string;color:string;bg:string;dot:string}> = {
  completed:{ label:'Terminé',  color:'#065F46', bg:'#ECFDF5', dot:'#10B981' },
  running:  { label:'En cours', color:'#1E40AF', bg:'#EFF6FF', dot:'#3B82F6' },
  paused:   { label:'Pause',    color:'#92400E', bg:'#FFFBEB', dot:'#F59E0B' },
  error:    { label:'Erreur',   color:'#991B1B', bg:'#FEF2F2', dot:'#EF4444' },
  queued:   { label:'En attente',color:'#374151',bg:'#F3F4F6', dot:'#9CA3AF' },
};

const MOCK_JOBS: any[] = [
  { id:'1', type:'linkedin', name:'Directeurs commerciaux Paris', status:'completed', count:127, duration:'2m 34s', createdAt:'il y a 1h',  params:{keywords:'Directeur Commercial',location:'Paris',limit:'150'} },
  { id:'2', type:'google',   name:'Agences immobilières Bordeaux', status:'running',  count:45,  duration:'1m 12s', createdAt:'il y a 5 min',params:{query:'Agences immobilières',location:'Bordeaux',limit:'50'}, progress:62 },
  { id:'3', type:'societe_info', name:'PME tech Île-de-France',  status:'paused',   count:0,   duration:'—',      createdAt:'il y a 2j',  params:{activity:'6201Z',location:'75',limit:'100'} },
  { id:'4', type:'linkedin', name:'CEO Scale-up SaaS',          status:'error',    count:0,   duration:'—',      createdAt:'il y a 3j',  params:{keywords:'CEO',location:'France',limit:'200'}, error:'Rate limit LinkedIn atteint' },
  { id:'5', type:'twitter',  name:'Signaux levées de fonds',     status:'completed', count:38,  duration:'45s',    createdAt:'il y a 1j',  params:{keywords:'#fundraising #levee',limit:'50'} },
];

function LaunchModal({ onClose, onLaunch }: { onClose:()=>void; onLaunch:(job:any)=>void }) {
  const [step, setStep] = useState<1|2>(1);
  const [type, setType] = useState('');
  const [name, setName] = useState('');
  const [params, setParams] = useState<Record<string,string>>({});
  const [launching, setLaunching] = useState(false);

  const setParam = (k:string, v:string) => setParams(p=>({...p,[k]:v}));

  const launch = async () => {
    if (!name.trim()) { toast.error('Nom requis'); return; }
    setLaunching(true);
    await new Promise(r=>setTimeout(r,800));
    const job = {
      id: Date.now().toString(), type, name,
      status:'queued', count:0, duration:'—',
      createdAt:'à l\'instant', params, progress:0,
    };
    try { await apiClient.post('/sourcing/jobs', { type, name, params }).catch(()=>null); } catch {}
    onLaunch(job);
    toast.success('Job de scraping lancé !');
    setLaunching(false);
    onClose();
  };

  const selectedType = SCRAPER_TYPES[type];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center text-green-600"><Search size={16}/></div>
            <h2 className="text-base font-bold text-gray-900">Nouveau scraping</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${step>=1?'bg-teal-600 text-white':'bg-gray-100 text-gray-400'}`}>1</span>
              <div className={`w-10 h-0.5 ${step>=2?'bg-teal-600':'bg-gray-200'}`}/>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${step>=2?'bg-teal-600 text-white':'bg-gray-100 text-gray-400'}`}>2</span>
            </div>
            <button onClick={onClose}><X size={18} className="text-gray-400"/></button>
          </div>
        </div>

        <div className="p-6">
          {step === 1 ? (
            <>
              <h3 className="font-semibold text-gray-800 mb-4">Choisissez une source</h3>
              <div className="grid grid-cols-2 gap-3 mb-5">
                {Object.entries(SCRAPER_TYPES).map(([id,t])=>(
                  <button key={id} onClick={()=>setType(id)}
                    className={`text-left p-3.5 rounded-xl border-2 transition-all ${type===id?'border-teal-500 bg-teal-50':'border-gray-200 hover:border-gray-300'}`}>
                    <div className="text-2xl mb-2">{t.icon}</div>
                    <div className="font-semibold text-sm text-gray-900 mb-0.5">{t.name}</div>
                    <div className="text-xs text-gray-400">{t.desc}</div>
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Annuler</button>
                <button onClick={()=>setStep(2)} disabled={!type} className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">Suivant →</button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">{selectedType?.icon}</span>
                <h3 className="font-semibold text-gray-800">{selectedType?.name}</h3>
              </div>
              <div className="space-y-3 mb-5">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Nom du job *</label>
                  <input value={name} onChange={e=>setName(e.target.value)} autoFocus
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Ex: Directeurs IT Paris Q2"/>
                </div>
                {selectedType?.fields.map(f=>(
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
                    <input value={params[f.key]||''} onChange={e=>setParam(f.key,e.target.value)}
                      type={f.type||'text'}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder={f.placeholder}/>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={()=>setStep(1)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">← Retour</button>
                <button onClick={launch} disabled={!name.trim()||launching}
                  className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                  {launching?<Loader2 size={14} className="animate-spin"/>:<Zap size={14}/>}Lancer le scraping
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SourcingPage() {
  const [, navigate] = useLocation();
  const [jobs, setJobs] = useState(MOCK_JOBS);
  const [showNew, setShowNew] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const progressRef = useRef<ReturnType<typeof setInterval>|null>(null);

  useEffect(()=>{
    apiClient.get('/sourcing/jobs').then((d:any)=>{
      const l = Array.isArray(d)?d:d?.data||[];
      if(l.length>0) setJobs(l);
    }).catch(()=>{});
  },[]);

  // Simulate progress for running jobs
  useEffect(()=>{
    progressRef.current = setInterval(()=>{
      setJobs(js=>js.map(j=>{
        if(j.status!=='running') return j;
        const newProg = Math.min((j.progress||0)+2, 100);
        if(newProg>=100) return {...j,status:'completed',progress:100,count:j.count+Math.floor(Math.random()*5)+1};
        return {...j,progress:newProg,count:j.count+1};
      }));
    },2000);
    return ()=>{ if(progressRef.current) clearInterval(progressRef.current); };
  },[]);

  const retryJob = (id:string, e:React.MouseEvent) => {
    e.stopPropagation();
    setJobs(js=>js.map(j=>j.id===id?{...j,status:'queued',error:undefined,progress:0}:j));
    setTimeout(()=>setJobs(js=>js.map(j=>j.id===id?{...j,status:'running',progress:0}:j)),1000);
    toast.success('Job relancé');
  };

  const pauseJob = (id:string, e:React.MouseEvent) => {
    e.stopPropagation();
    setJobs(js=>js.map(j=>j.id===id?{...j,status:j.status==='running'?'paused':'running'}:j));
  };

  const deleteJob = (id:string, e:React.MouseEvent) => {
    e.stopPropagation();
    if(!confirm('Supprimer ce job ?')) return;
    setJobs(js=>js.filter(j=>j.id!==id));
    toast.success('Job supprimé');
  };

  const filtered = jobs.filter(j=>{
    const q = search.toLowerCase();
    const matchSearch = !q || `${j.name} ${SCRAPER_TYPES[j.type]?.name||''}`.toLowerCase().includes(q);
    const matchStatus = statusFilter==='all' || j.status===statusFilter;
    return matchSearch && matchStatus;
  });

  const totalCollected = jobs.filter(j=>j.status==='completed').reduce((s,j)=>s+j.count,0);
  const running = jobs.filter(j=>j.status==='running').length;
  const completed = jobs.filter(j=>j.status==='completed').length;

  return (
    <div className="min-h-screen p-6" style={{background:'var(--body-bg)'}}>
      {showNew && <LaunchModal onClose={()=>setShowNew(false)} onLaunch={j=>setJobs(js=>[j,...js])}/>}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>Scraping & Sourcing</h1>
          <p className="text-sm" style={{color:'var(--text-muted)'}}>
            {running>0?<span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse inline-block"/>{running} job{running>1?'s':''} en cours</span>:`${totalCollected} prospects collectés au total`}
          </p>
        </div>
        <button onClick={()=>setShowNew(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{background:'var(--color-primary)'}}>
          <Plus size={14}/>Nouveau scraping
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          {l:'Prospects collectés', v:totalCollected, icon:<Users size={16}/>, color:'text-blue-600 bg-blue-50'},
          {l:'Jobs terminés',       v:completed,       icon:<CheckCircle size={16}/>, color:'text-green-600 bg-green-50'},
          {l:'En cours',           v:running,         icon:<Loader2 size={16}/>, color:'text-purple-600 bg-purple-50'},
          {l:'Sources dispo.',     v:Object.keys(SCRAPER_TYPES).length, icon:<Globe size={16}/>, color:'text-teal-600 bg-teal-50'},
        ].map((m,i)=>(
          <div key={i} className="rounded-2xl border p-4 flex items-center gap-3" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${m.color}`}>{m.icon}</div>
            <div>
              <div className="text-xl font-bold" style={{color:'var(--text-primary)'}}>{m.v}</div>
              <div className="text-xs" style={{color:'var(--text-muted)'}}>{m.l}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Sources rapides */}
      <div className="rounded-2xl border p-4 mb-5" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
        <div className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{color:'var(--text-muted)'}}>Sources disponibles — cliquez pour lancer</div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(SCRAPER_TYPES).map(([id,t])=>(
            <button key={id} onClick={()=>setShowNew(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all hover:shadow-sm"
              style={{background:'var(--body-bg)',borderColor:'var(--card-border)',color:'var(--text-secondary)'}}>
              <span>{t.icon}</span>{t.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{color:'var(--text-muted)'}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un job..."
            className="w-full pl-8 pr-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            style={{background:'var(--card-bg)',border:'1px solid var(--card-border)',color:'var(--text-primary)'}}/>
        </div>
        <div className="flex gap-1 p-1 rounded-xl" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
          {[{v:'all',l:'Tous'},{v:'running',l:'En cours'},{v:'completed',l:'Terminés'},{v:'paused',l:'Pause'},{v:'error',l:'Erreurs'}].map(f=>(
            <button key={f.v} onClick={()=>setStatusFilter(f.v)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={statusFilter===f.v?{background:'var(--color-primary)',color:'#fff'}:{color:'var(--text-muted)',background:'transparent',border:'none',cursor:'pointer'}}>
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {/* Jobs list */}
      {filtered.length===0 ? (
        <div className="rounded-2xl border py-16 text-center" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
          <Search size={40} className="mx-auto mb-3" style={{color:'var(--card-border)'}}/>
          <p className="text-sm mb-4" style={{color:'var(--text-muted)'}}>Aucun job trouvé</p>
          <button onClick={()=>setShowNew(true)} className="px-4 py-2 rounded-xl text-sm text-white" style={{background:'var(--color-primary)'}}>
            + Lancer un scraping
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(job=>{
            const sc = STATUS_CONFIG[job.status]||STATUS_CONFIG.paused;
            const src = SCRAPER_TYPES[job.type]||SCRAPER_TYPES.custom;
            const isRunning = job.status==='running';
            return (
              <div key={job.id}
                className="rounded-2xl border cursor-pointer transition-all hover:shadow-md"
                style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}
                onMouseEnter={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--color-primary)'}
                onMouseLeave={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--card-border)'}>

                <div className="flex items-center gap-4 p-4" onClick={()=>navigate(`/sourcing/${job.id}`)}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{background:'var(--body-bg)'}}>{src.icon}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-semibold text-sm" style={{color:'var(--text-primary)'}}>{job.name}</span>
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full" style={{background:sc.dot, animation:isRunning?'pulse 1.5s infinite':undefined}}/>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{background:sc.bg,color:sc.color}}>{sc.label}</span>
                      </div>
                    </div>
                    <div className="text-xs mb-1" style={{color:'var(--text-muted)'}}>{src.name} · {job.createdAt}</div>
                    {job.error && <div className="text-xs text-red-500 mb-1">⚠ {job.error}</div>}
                    {/* Progress bar for running jobs */}
                    {isRunning && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full transition-all" style={{width:`${job.progress||0}%`,background:'var(--color-primary)'}}/>
                        </div>
                        <span className="text-xs" style={{color:'var(--text-muted)'}}>{job.progress||0}%</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    {job.count>0&&(
                      <div className="text-right">
                        <div className="text-sm font-bold" style={{color:'var(--color-primary)'}}>{job.count}</div>
                        <div className="text-xs" style={{color:'var(--text-muted)'}}>prospects</div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-1" onClick={e=>e.stopPropagation()}>
                      {job.count>0 && (
                        <button onClick={()=>navigate(`/sourcing/${job.id}`)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" title="Voir résultats">
                          <Eye size={14} style={{color:'var(--text-muted)'}}/>
                        </button>
                      )}
                      {(job.status==='running'||job.status==='paused') && (
                        <button onClick={e=>pauseJob(job.id,e)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                          {job.status==='running'?<Pause size={14} style={{color:'#D97706'}}/>:<Play size={14} style={{color:'#059669'}}/>}
                        </button>
                      )}
                      {(job.status==='error'||job.status==='paused') && (
                        <button onClick={e=>retryJob(job.id,e)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors" title="Relancer">
                          <RotateCcw size={14} style={{color:'#2563EB'}}/>
                        </button>
                      )}
                      <button onClick={e=>deleteJob(job.id,e)}
                        className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Supprimer">
                        <Trash2 size={14} className="text-red-400"/>
                      </button>
                    </div>
                    <ChevronRight size={15} style={{color:'var(--text-muted)'}}/>
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
