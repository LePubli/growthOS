import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Puzzle, Play, Pause, ChevronRight, Star, Search, Download, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const MOCK_PLUGINS = [
  { id:'1', name:'LinkedIn Enricher', slug:'linkedin-enricher', description:'Enrichit automatiquement les profils prospects avec données LinkedIn', version:'2.1.0', status:'active', category:'enrichment', rating:4.8, installs:1240, icon:'💼' },
  { id:'2', name:'AI Email Composer', slug:'ai-email-composer', description:'Génère des emails personnalisés avec GPT-4 en un clic', version:'1.3.2', status:'active', category:'ai', rating:4.9, installs:3200, icon:'🤖' },
  { id:'3', name:'Hunter.io Integration', slug:'hunter-io', description:'Trouve et vérifie les emails professionnels via Hunter.io', version:'1.0.5', status:'inactive', category:'enrichment', rating:4.5, installs:890, icon:'🎯' },
  { id:'4', name:'Clearbit Reveal', slug:'clearbit', description:'Identifie les visiteurs anonymes de votre site', version:'3.0.1', status:'inactive', category:'analytics', rating:4.7, installs:650, icon:'🔍' },
  { id:'5', name:'Slack Notifications', slug:'slack-notify', description:'Envoi de notifications dans vos channels Slack', version:'1.2.0', status:'active', category:'notifications', rating:4.6, installs:2100, icon:'💬' },
];

const CATEGORIES = ['Tous','enrichment','ai','analytics','notifications','crm'];

export default function PluginsPage() {
  const [, navigate] = useLocation();
  const [plugins, setPlugins] = useState(MOCK_PLUGINS);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Tous');
  const [toggling, setToggling] = useState<string|null>(null);
  const API = (import.meta.env.VITE_API_URL as string) || '';

  useEffect(()=>{
    fetch(`${API}/api/v1/plugins`,{headers:{Authorization:`Bearer ${localStorage.getItem('access_token')||''}`}})
      .then(r=>r.ok?r.json():null).then(d=>{if(d){const l=Array.isArray(d)?d:d.data||[];if(l.length>0)setPlugins(l);}}).catch(()=>{});
  },[]);

  const toggle = async (id:string, e:React.MouseEvent) => {
    e.stopPropagation(); setToggling(id);
    try {
      const p = plugins.find(x=>x.id===id)!;
      await fetch(`${API}/api/v1/plugins/${p.slug}/${p.status==='active'?'deactivate':'activate'}`,{method:'POST',headers:{Authorization:`Bearer ${localStorage.getItem('access_token')||''}`}});
      setPlugins(ps=>ps.map(x=>x.id===id?{...x,status:x.status==='active'?'inactive':'active'}:x));
    } catch {} finally { setToggling(null); }
  };

  const filtered = plugins.filter(p=>{
    const q = search.toLowerCase();
    const matchSearch = !q || `${p.name} ${p.description}`.toLowerCase().includes(q);
    const matchCat = category==='Tous' || p.category===category;
    return matchSearch && matchCat;
  });

  return (
    <div className="min-h-screen p-6" style={{background:'var(--body-bg)'}}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>Plugins</h1>
          <p className="text-sm" style={{color:'var(--text-muted)'}}>{plugins.filter(p=>p.status==='active').length} actifs sur {plugins.length}</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)',color:'var(--text-secondary)'}}>
          <Download size={14}/>Marketplace
        </button>
      </div>

      <div className="flex gap-3 mb-5">
        <div style={{position:'relative',flex:1}}>
          <Search size={14} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)'}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un plugin..." style={{width:'100%',paddingLeft:36,paddingRight:12,paddingTop:10,paddingBottom:10,borderRadius:12,border:'1px solid var(--card-border)',background:'var(--card-bg)',color:'var(--text-primary)',fontSize:14,outline:'none',boxSizing:'border-box'}}/>
        </div>
        <div style={{display:'flex',gap:4,padding:4,borderRadius:12,background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
          {CATEGORIES.map(c=>(
            <button key={c} onClick={()=>setCategory(c)} style={{padding:'6px 12px',borderRadius:8,fontSize:12,fontWeight:500,border:'none',cursor:'pointer',background:category===c?'var(--color-primary)':'transparent',color:category===c?'#fff':'var(--text-muted)'}}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:16}}>
        {filtered.map(plugin=>(
          <div key={plugin.id} onClick={()=>navigate(`/plugins/${plugin.slug}`)}
            style={{borderRadius:16,border:'1px solid var(--card-border)',background:'var(--card-bg)',overflow:'hidden',cursor:'pointer',transition:'all 0.15s'}}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.boxShadow='0 4px 16px rgba(0,0,0,.08)';(e.currentTarget as HTMLElement).style.borderColor='var(--color-primary)';}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.boxShadow='none';(e.currentTarget as HTMLElement).style.borderColor='var(--card-border)';}}>
            <div style={{padding:16,display:'flex',gap:12,alignItems:'flex-start'}}>
              <div style={{width:44,height:44,borderRadius:10,background:'var(--body-bg)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>{plugin.icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                  <h3 style={{fontWeight:600,fontSize:14,color:'var(--text-primary)',margin:0}}>{plugin.name}</h3>
                  <span style={{fontSize:11,padding:'2px 8px',borderRadius:9999,background:plugin.status==='active'?'#ECFDF5':'#F3F4F6',color:plugin.status==='active'?'#059669':'#6B7280'}}>{plugin.status==='active'?'Actif':'Inactif'}</span>
                </div>
                <p style={{fontSize:12,color:'var(--text-muted)',margin:'0 0 8px',lineHeight:1.5}}>{plugin.description}</p>
                <div style={{display:'flex',alignItems:'center',gap:12,fontSize:12,color:'var(--text-muted)'}}>
                  <span style={{display:'flex',alignItems:'center',gap:3}}><Star size={11} fill="#F59E0B" color="#F59E0B"/>{plugin.rating}</span>
                  <span>v{plugin.version}</span>
                  <span>{plugin.installs.toLocaleString()} installs</span>
                </div>
              </div>
            </div>
            <div style={{padding:'10px 16px',borderTop:'1px solid var(--card-border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:11,padding:'2px 8px',borderRadius:9999,background:'var(--body-bg)',color:'var(--text-muted)'}}>{plugin.category}</span>
              <button onClick={e=>toggle(plugin.id,e)} disabled={toggling===plugin.id}
                style={{display:'flex',alignItems:'center',gap:6,padding:'6px 14px',borderRadius:8,border:'none',fontSize:12,fontWeight:500,cursor:'pointer',background:plugin.status==='active'?'#FEF3C7':'#ECFDF5',color:plugin.status==='active'?'#D97706':'#059669'}}>
                {toggling===plugin.id?<Loader2 size={12} className="animate-spin"/>:plugin.status==='active'?<><Pause size={12}/>Désactiver</>:<><Play size={12}/>Activer</>}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
