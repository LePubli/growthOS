import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Search, Plus, Play, Pause, CheckCircle, Clock, AlertCircle, Loader2, Globe, Users, ChevronRight } from 'lucide-react';

const SCRAPER_TYPES: Record<string, { name: string; icon: string; desc: string }> = {
  linkedin: { name:'LinkedIn Sales Navigator', icon:'💼', desc:'Recherche de décideurs B2B' },
  google: { name:'Google Maps', icon:'🗺️', desc:'Établissements locaux et contacts' },
  societe_info: { name:'Societe.info', icon:'🏢', desc:'Données entreprises françaises' },
  twitter: { name:'Twitter/X', icon:'🐦', desc:'Signaux sociaux et mentions' },
  custom: { name:'Custom Scraper', icon:'⚙️', desc:'Script personnalisé' },
};

const MOCK_JOBS = [
  { id:'1', type:'linkedin', name:'Directeurs commerciaux Paris', status:'completed', count:127, duration:'2m 34s', createdAt:'il y a 1h' },
  { id:'2', type:'google', name:'Agences immobilières Bordeaux', status:'running', count:45, duration:'1m 12s', createdAt:'il y a 5 min' },
  { id:'3', type:'societe_info', name:'PME tech Île-de-France', status:'paused', count:0, duration:'—', createdAt:'il y a 2j' },
  { id:'4', type:'linkedin', name:'CEO Scale-up SaaS', status:'error', count:0, duration:'—', createdAt:'il y a 3j' },
];

const STATUS_CONFIG: Record<string,{label:string;color:string;bg:string;icon:React.ReactNode}> = {
  completed: {label:'Terminé',color:'text-green-700',bg:'bg-green-50',icon:<CheckCircle size={14}/>},
  running:   {label:'En cours',color:'text-blue-700',bg:'bg-blue-50',icon:<Loader2 size={14} className="animate-spin"/>},
  paused:    {label:'Pause',color:'text-amber-700',bg:'bg-amber-50',icon:<Pause size={14}/>},
  error:     {label:'Erreur',color:'text-red-700',bg:'bg-red-50',icon:<AlertCircle size={14}/>},
};

export default function SourcingPage() {
  const [, navigate] = useLocation();
  const [jobs, setJobs] = useState(MOCK_JOBS);
  const [showNew, setShowNew] = useState(false);
  const [selectedType, setSelectedType] = useState('linkedin');

  const totalProspects = jobs.filter(j=>j.status==='completed').reduce((s,j)=>s+j.count,0);
  const running = jobs.filter(j=>j.status==='running').length;

  return (
    <div className="min-h-screen p-6" style={{background:'var(--body-bg)'}}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>Scraping & Sourcing</h1>
          <p className="text-sm" style={{color:'var(--text-muted)'}}>{running > 0 ? `${running} en cours` : `${totalProspects} prospects collectés`}</p>
        </div>
        <button onClick={()=>setShowNew(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{background:'var(--color-primary)'}}>
          <Plus size={14}/>Nouveau scraping
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          {l:'Total collectés',v:totalProspects,icon:<Users size={18}/>,color:'text-blue-600 bg-blue-50'},
          {l:'Jobs actifs',v:running,icon:<Play size={18}/>,color:'text-green-600 bg-green-50'},
          {l:'Sources disponibles',v:Object.keys(SCRAPER_TYPES).length,icon:<Globe size={18}/>,color:'text-purple-600 bg-purple-50'},
        ].map((m,i)=>(
          <div key={i} className="rounded-2xl border p-5 flex items-center gap-4" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${m.color}`}>{m.icon}</div>
            <div><div className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>{m.v}</div><div className="text-sm" style={{color:'var(--text-muted)'}}>{m.l}</div></div>
          </div>
        ))}
      </div>

      {showNew && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:50,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:'var(--card-bg)',border:'1px solid var(--card-border)',borderRadius:20,padding:24,width:'100%',maxWidth:480}}>
            <h2 style={{fontWeight:700,fontSize:18,color:'var(--text-primary)',marginBottom:16}}>Nouveau scraping</h2>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
              {Object.entries(SCRAPER_TYPES).map(([id,t])=>(
                <button key={id} onClick={()=>setSelectedType(id)}
                  style={{padding:12,borderRadius:12,border:'2px solid',textAlign:'left',cursor:'pointer',borderColor:selectedType===id?'var(--color-primary)':'var(--card-border)',background:selectedType===id?'var(--color-primary-light)':'var(--body-bg)'}}>
                  <div style={{fontSize:20,marginBottom:4}}>{t.icon}</div>
                  <div style={{fontSize:12,fontWeight:600,color:'var(--text-primary)'}}>{t.name}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)'}}>{t.desc}</div>
                </button>
              ))}
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setShowNew(false)} style={{flex:1,padding:'10px',border:'1px solid var(--card-border)',borderRadius:10,background:'var(--body-bg)',color:'var(--text-secondary)',cursor:'pointer',fontSize:14}}>Annuler</button>
              <button onClick={()=>{setShowNew(false);navigate(`/sourcing/${selectedType}`);}} style={{flex:1,padding:'10px',border:'none',borderRadius:10,background:'var(--color-primary)',color:'#fff',cursor:'pointer',fontSize:14,fontWeight:600}}>Configurer →</button>
            </div>
          </div>
        </div>
      )}

      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {jobs.map(job=>{
          const sc = STATUS_CONFIG[job.status]||STATUS_CONFIG.paused;
          const type = SCRAPER_TYPES[job.type]||SCRAPER_TYPES.custom;
          return (
            <div key={job.id} onClick={()=>navigate(`/sourcing/${job.id}`)}
              style={{display:'flex',alignItems:'center',gap:16,padding:'14px 16px',borderRadius:16,background:'var(--card-bg)',border:'1px solid var(--card-border)',cursor:'pointer',transition:'all 0.15s'}}
              onMouseEnter={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--color-primary)'}
              onMouseLeave={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--card-border)'}>
              <div style={{width:40,height:40,borderRadius:10,background:'var(--body-bg)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>{type.icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:14,color:'var(--text-primary)',marginBottom:2}}>{job.name}</div>
                <div style={{fontSize:12,color:'var(--text-muted)'}}>{type.name} · {job.createdAt}</div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
                {job.count>0&&<span style={{fontSize:13,fontWeight:700,color:'var(--color-primary)'}}>{job.count} prospects</span>}
                <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${sc.bg} ${sc.color}`}>{sc.icon}{sc.label}</span>
                <ChevronRight size={16} style={{color:'var(--text-muted)'}}/>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
