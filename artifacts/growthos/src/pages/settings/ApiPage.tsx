import { useState } from 'react';
import { Key, Plus, Copy, Trash2, Eye, EyeOff, CheckCircle } from 'lucide-react';

const MOCK_KEYS = [
  { id:'1', name:'Production', key:'gos_live_xK9mP2qR4vNz8wYs...', createdAt:'20 Mai 2026', lastUsed:'il y a 2h', requests:1247 },
  { id:'2', name:'Development', key:'gos_test_aB3nQ7wS1mKj5eRt...', createdAt:'15 Mai 2026', lastUsed:'il y a 1j', requests:89 },
];

export default function ApiPage() {
  const [keys, setKeys] = useState(MOCK_KEYS);
  const [show, setShow] = useState<Record<string,boolean>>({});
  const [copied, setCopied] = useState<string|null>(null);
  const [newName, setNewName] = useState('');
  const API = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3001';

  const copy = (id:string, text:string) => { navigator.clipboard.writeText(text); setCopied(id); setTimeout(()=>setCopied(null),2000); };
  const create = () => {
    if (!newName) return;
    const newKey = `gos_live_${Math.random().toString(36).slice(2,18)}`;
    setKeys(k=>[...k,{id:Date.now().toString(),name:newName,key:newKey,createdAt:"Aujourd'hui",lastUsed:'jamais',requests:0}]);
    setNewName('');
  };

  return (
    <div className="min-h-screen p-6 max-w-3xl" style={{background:'var(--body-bg)'}}>
      <h1 style={{fontSize:22,fontWeight:700,color:'var(--text-primary)',marginBottom:4}}>API & Clés</h1>
      <p style={{fontSize:14,color:'var(--text-muted)',marginBottom:24}}>Gérez vos clés API pour intégrer GrowthOS dans vos applications</p>

      <div style={{borderRadius:16,border:'1px solid var(--card-border)',background:'var(--card-bg)',padding:20,marginBottom:16}}>
        <h2 style={{fontWeight:600,fontSize:15,color:'var(--text-primary)',marginBottom:12}}>Base URL</h2>
        <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',borderRadius:10,background:'var(--body-bg)',border:'1px solid var(--card-border)'}}>
          <code style={{fontSize:13,color:'var(--color-primary)',flex:1}}>{API}/api/v1</code>
          <button onClick={()=>copy('base',`${API}/api/v1`)} style={{background:'none',border:'none',cursor:'pointer',color:copied==='base'?'#059669':'var(--text-muted)'}}>
            {copied==='base'?<CheckCircle size={14}/>:<Copy size={14}/>}
          </button>
        </div>
      </div>

      <div style={{borderRadius:16,border:'1px solid var(--card-border)',background:'var(--card-bg)',padding:20,marginBottom:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <h2 style={{fontWeight:600,fontSize:15,color:'var(--text-primary)',margin:0}}>Clés API</h2>
        </div>
        <div style={{display:'flex',gap:10,marginBottom:20}}>
          <input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&create()} placeholder="Nom de la clé (ex: Production)"
            style={{flex:1,padding:'9px 12px',border:'1px solid var(--card-border)',borderRadius:10,fontSize:14,background:'var(--body-bg)',color:'var(--text-primary)',outline:'none'}}/>
          <button onClick={create} disabled={!newName}
            style={{display:'flex',alignItems:'center',gap:6,padding:'9px 16px',borderRadius:10,border:'none',background:'var(--color-primary)',color:'#fff',fontSize:14,fontWeight:600,cursor:!newName?'not-allowed':'pointer',opacity:!newName?0.6:1}}>
            <Plus size={14}/>Créer
          </button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {keys.map(k=>(
            <div key={k.id} style={{borderRadius:12,border:'1px solid var(--card-border)',padding:14}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                <div style={{fontWeight:600,fontSize:14,color:'var(--text-primary)'}}>{k.name}</div>
                <button onClick={()=>setKeys(ks=>ks.filter(x=>x.id!==k.id))} style={{background:'none',border:'none',cursor:'pointer',color:'#EF4444'}}>
                  <Trash2 size={14}/>
                </button>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderRadius:8,background:'var(--body-bg)',marginBottom:8}}>
                <code style={{flex:1,fontSize:12,color:'var(--text-secondary)',fontFamily:'monospace'}}>
                  {show[k.id]?k.key:'•'.repeat(30)}
                </code>
                <button onClick={()=>setShow(s=>({...s,[k.id]:!s[k.id]}))} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)'}}>
                  {show[k.id]?<EyeOff size={13}/>:<Eye size={13}/>}
                </button>
                <button onClick={()=>copy(k.id,k.key)} style={{background:'none',border:'none',cursor:'pointer',color:copied===k.id?'#059669':'var(--text-muted)'}}>
                  {copied===k.id?<CheckCircle size={13}/>:<Copy size={13}/>}
                </button>
              </div>
              <div style={{display:'flex',gap:16,fontSize:12,color:'var(--text-muted)'}}>
                <span>Créé le {k.createdAt}</span><span>Dernière utilisation : {k.lastUsed}</span><span>{k.requests.toLocaleString()} req</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
