import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Users, Plus, Search, Filter, Download, Loader2, Building2, Mail, Phone, Star, ChevronRight } from 'lucide-react';

const STATUS_COLORS: Record<string,{bg:string;text:string;label:string}> = {
  new:         {bg:'#F3F4F6',text:'#374151',label:'Nouveau'},
  contacted:   {bg:'#EFF6FF',text:'#1D4ED8',label:'Contacté'},
  qualified:   {bg:'#F5F3FF',text:'#6D28D9',label:'Qualifié'},
  negotiation: {bg:'#FFFBEB',text:'#92400E',label:'Négociation'},
  won:         {bg:'#ECFDF5',text:'#065F46',label:'Gagné'},
  lost:        {bg:'#FEF2F2',text:'#991B1B',label:'Perdu'},
};

const MOCK_PROSPECTS = [
  {id:'1',firstName:'Sophie',lastName:'Martin',company:'TechCorp',email:'s.martin@techcorp.fr',phone:'+33 6 12 34 56 78',status:'qualified',score:87,isStarred:false},
  {id:'2',firstName:'Paul',lastName:'Dupont',company:'BigSales SAS',email:'p.dupont@bigsales.fr',phone:'+33 7 23 45 67 89',status:'contacted',score:65,isStarred:true},
  {id:'3',firstName:'Emma',lastName:'Leroy',company:'StartupX',email:'e.leroy@startupx.io',phone:'+33 6 34 56 78 90',status:'new',score:42,isStarred:false},
  {id:'4',firstName:'Luc',lastName:'Moreau',company:'GrowthCo',email:'l.moreau@growthco.fr',phone:'',status:'won',score:95,isStarred:false},
  {id:'5',firstName:'Camille',lastName:'Bernard',company:'DataInc',email:'c.bernard@datainc.fr',phone:'+33 6 56 78 90 12',status:'negotiation',score:78,isStarred:true},
];

export default function ProspectsPage() {
  const [, navigate] = useLocation();
  const [prospects, setProspects] = useState(MOCK_PROSPECTS);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const API = (import.meta.env.VITE_API_URL as string) || '';

  useEffect(()=>{
    const fetch_ = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('access_token')||'';
        const res = await fetch(`${API}/api/v1/prospects`,{headers:{Authorization:`Bearer ${token}`}});
        if (res.ok) { const d=await res.json(); const l=Array.isArray(d)?d:d.data||[]; if(l.length>0) setProspects(l); }
      } catch {} finally { setLoading(false); }
    };
    fetch_();
  },[]);

  const filtered = prospects.filter(p=>{
    const q = search.toLowerCase();
    const matchSearch = !q || `${p.firstName} ${p.lastName} ${p.company} ${p.email}`.toLowerCase().includes(q);
    const matchStatus = statusFilter==='all' || p.status===statusFilter;
    return matchSearch && matchStatus;
  });

  const toggleStar = (id:string,e:React.MouseEvent) => {
    e.stopPropagation();
    setProspects(ps=>ps.map(p=>p.id===id?{...p,isStarred:!p.isStarred}:p));
  };

  return (
    <div className="min-h-screen p-6" style={{background:'var(--body-bg)'}}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>Prospects</h1>
          <p className="text-sm" style={{color:'var(--text-muted)'}}>{filtered.length} contact{filtered.length>1?'s':''}</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)',color:'var(--text-secondary)'}}>
            <Download className="w-4 h-4"/>Exporter
          </button>
          <button onClick={()=>navigate('/prospects/new')} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{background:'var(--color-primary)'}}>
            <Plus className="w-4 h-4"/>Nouveau prospect
          </button>
        </div>
      </div>

      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{color:'var(--text-muted)'}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un prospect..." className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)',color:'var(--text-primary)'}}/>
        </div>
        <div className="flex gap-1 p-1 rounded-xl" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
          {['all',...Object.keys(STATUS_COLORS)].map(s=>(
            <button key={s} onClick={()=>setStatusFilter(s)} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={statusFilter===s?{background:'var(--color-primary)',color:'#fff'}:{color:'var(--text-muted)'}}>
              {s==='all'?'Tous':STATUS_COLORS[s]?.label||s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:'64px 0'}}><Loader2 className="w-8 h-8 animate-spin" style={{color:'var(--color-primary)'}}/></div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {filtered.map(p=>{
            const sc = STATUS_COLORS[p.status]||STATUS_COLORS.new;
            return (
              <div key={p.id} onClick={()=>navigate(`/prospects/${p.id}`)}
                className="flex items-center gap-4 rounded-2xl border p-4 cursor-pointer transition-all hover:shadow-md"
                style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}
                onMouseEnter={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--color-primary)'}
                onMouseLeave={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--card-border)'}>
                <div style={{width:40,height:40,borderRadius:10,background:'var(--color-primary)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:14,flexShrink:0}}>
                  {p.firstName?.[0]?.toUpperCase()||'?'}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
                    <span style={{fontWeight:600,fontSize:14,color:'var(--text-primary)'}}>{p.firstName} {p.lastName}</span>
                    <span style={{fontSize:11,fontWeight:500,padding:'2px 8px',borderRadius:9999,background:sc.bg,color:sc.text}}>{sc.label}</span>
                  </div>
                  <div style={{display:'flex',gap:16,fontSize:12,color:'var(--text-muted)'}}>
                    {p.company&&<span style={{display:'flex',alignItems:'center',gap:4}}><Building2 size={11}/>{p.company}</span>}
                    {p.email&&<span style={{display:'flex',alignItems:'center',gap:4}}><Mail size={11}/>{p.email}</span>}
                    {p.phone&&<span style={{display:'flex',alignItems:'center',gap:4}}><Phone size={11}/>{p.phone}</span>}
                  </div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:2}}>
                    <span style={{fontSize:13,fontWeight:700,color:p.score>=80?'#059669':p.score>=50?'#D97706':'#DC2626'}}>{p.score}</span>
                    <span style={{fontSize:10,color:'var(--text-muted)'}}>score</span>
                  </div>
                  <button onClick={e=>toggleStar(p.id,e)} style={{background:'none',border:'none',cursor:'pointer',color:p.isStarred?'#F59E0B':'var(--card-border)'}}>
                    <Star size={16} fill={p.isStarred?'#F59E0B':'none'}/>
                  </button>
                  <ChevronRight size={16} style={{color:'var(--text-muted)'}}/>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{textAlign:'center',padding:'64px 0'}}>
              <Users size={40} style={{margin:'0 auto 12px',display:'block',opacity:0.2}}/>
              <p style={{fontSize:14,color:'var(--text-muted)'}}>Aucun prospect trouvé</p>
              <button onClick={()=>navigate('/prospects/new')} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white mx-auto mt-4" style={{background:'var(--color-primary)'}}>
                <Plus size={14}/>Ajouter un prospect
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
