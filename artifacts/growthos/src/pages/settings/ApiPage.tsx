import { useState, useEffect } from 'react';
import { Key, Plus, Copy, Trash2, Eye, EyeOff, CheckCircle, Loader2, RefreshCw, Shield, X, AlertCircle, Code } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

const SCOPES_OPTIONS = [
  { id:'read',      label:'Lecture',      desc:'GET sur tous les endpoints',   color:'#2563EB' },
  { id:'write',     label:'Écriture',     desc:'POST/PUT/PATCH sur les données',color:'#059669' },
  { id:'delete',    label:'Suppression',  desc:'DELETE sur les ressources',     color:'#DC2626' },
  { id:'admin',     label:'Admin',        desc:'Accès complet + paramètres',    color:'#7C3AED' },
];

type ApiKey = {
  id: string;
  name: string;
  key: string;
  prefix?: string;
  scopes: string[];
  createdAt: string;
  lastUsed: string | null;
  requests: number;
};

const API_URL = (import.meta.env.VITE_API_URL as string) || '/api/v1';

function CreateModal({ onClose, onCreate }: { onClose:()=>void; onCreate:(k:ApiKey)=>void }) {
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['read','write']);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<ApiKey|null>(null);
  const [copied, setCopied] = useState(false);

  const toggleScope = (id:string) => setScopes(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);

  const create = async () => {
    if (!name.trim()) { toast.error('Nom requis'); return; }
    setCreating(true);
    try {
      const key = await apiClient.post<ApiKey>('/api-keys', { name: name.trim(), scopes });
      setCreated(key);
      onCreate(key);
    } catch {
      toast.error('Erreur lors de la création');
    } finally { setCreating(false); }
  };

  const copy = () => {
    if (!created) return;
    navigator.clipboard.writeText(created.key);
    setCopied(true);
    setTimeout(()=>setCopied(false),2000);
    toast.success('Clé copiée !');
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center"><Key size={15} className="text-indigo-600"/></div>
            <h2 className="text-base font-bold text-gray-900">{created?'Clé créée — copiez-la maintenant':'Nouvelle clé API'}</h2>
          </div>
          {created && <button onClick={onClose}><X size={18} className="text-gray-400"/></button>}
        </div>

        <div className="p-6">
          {created ? (
            <>
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 mb-4">
                <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5"/>
                <p className="text-xs text-amber-700 leading-relaxed">Cette clé n'est affichée qu'une seule fois. Copiez-la maintenant et gardez-la en sécurité.</p>
              </div>
              <div className="p-3 rounded-xl bg-gray-900 mb-4 flex items-center gap-2">
                <code className="flex-1 text-green-400 text-xs font-mono break-all">{created.key}</code>
                <button onClick={copy} className="flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-700 transition-colors">
                  {copied?<CheckCircle size={15} className="text-green-400"/>:<Copy size={15} className="text-gray-400"/>}
                </button>
              </div>
              <button onClick={copy} className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                {copied?<><CheckCircle size={14}/>Copié !</>:<><Copy size={14}/>Copier la clé</>}
              </button>
            </>
          ) : (
            <>
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 mb-1">Nom de la clé *</label>
                <input value={name} onChange={e=>setName(e.target.value)} autoFocus
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="Ex: Production, Zapier, Webhook serveur"/>
              </div>
              <div className="mb-5">
                <label className="block text-xs font-medium text-gray-500 mb-2">Permissions</label>
                <div className="grid grid-cols-2 gap-2">
                  {SCOPES_OPTIONS.map(s=>{
                    const on = scopes.includes(s.id);
                    return (
                      <button key={s.id} onClick={()=>toggleScope(s.id)}
                        className={`p-2.5 rounded-xl border-2 text-left transition-all ${on?'border-current':'border-gray-200'}`}
                        style={on?{borderColor:s.color,background:`${s.color}10`}:{}}>
                        <div className="font-semibold text-xs mb-0.5" style={{color:on?s.color:'var(--text-secondary)'}}>{s.label}</div>
                        <div className="text-xs text-gray-400">{s.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Annuler</button>
                <button onClick={create} disabled={!name.trim()||creating||scopes.length===0}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                  {creating?<Loader2 size={14} className="animate-spin"/>:<Key size={14}/>}Générer
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ApiPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState<Record<string,boolean>>({});
  const [copied, setCopied] = useState<string|null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState<string|null>(null);

  const fetch = () => {
    setLoading(true);
    apiClient.get<ApiKey[]>('/api-keys').then(data => {
      setKeys(Array.isArray(data) ? data : []);
    }).catch(() => setKeys([])).finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, []);

  const copy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(()=>setCopied(null),2000);
    toast.success('Copié dans le presse-papier');
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Révoquer la clé "${name}" ? Cette action est irréversible.`)) return;
    setDeleting(id);
    try {
      await apiClient.delete(`/api-keys/${id}`);
      setKeys(ks=>ks.filter(k=>k.id!==id));
      toast.success('Clé révoquée');
    } catch {
      toast.error('Impossible de révoquer cette clé');
    } finally { setDeleting(null); }
  };

  const fmtDate = (iso:string|null) => {
    if (!iso) return 'jamais';
    try { return new Date(iso).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}); } catch { return iso; }
  };

  return (
    <div className="min-h-screen p-6 max-w-3xl" style={{background:'var(--body-bg)'}}>
      {showCreate && (
        <CreateModal
          onClose={()=>{setShowCreate(false);fetch();}}
          onCreate={k=>setKeys(ks=>[...ks, k])}
        />
      )}

      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
        <h1 style={{fontSize:22,fontWeight:700,color:'var(--text-primary)',margin:0}}>API & Clés</h1>
        <div style={{display:'flex',gap:8}}>
          <button onClick={fetch} style={{padding:'8px',borderRadius:10,border:'1px solid var(--card-border)',background:'var(--card-bg)',cursor:'pointer',display:'flex',alignItems:'center',color:'var(--text-muted)'}}>
            <RefreshCw size={14}/>
          </button>
          <button onClick={()=>setShowCreate(true)}
            style={{display:'flex',alignItems:'center',gap:6,padding:'8px 16px',border:'none',borderRadius:10,background:'var(--color-primary)',color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer'}}>
            <Plus size={14}/>Nouvelle clé
          </button>
        </div>
      </div>
      <p style={{fontSize:14,color:'var(--text-muted)',marginBottom:24}}>Gérez vos clés API pour intégrer GrowthOS dans vos applications</p>

      {/* Base URL */}
      <div style={{borderRadius:16,border:'1px solid var(--card-border)',background:'var(--card-bg)',padding:20,marginBottom:16}}>
        <h2 style={{fontWeight:600,fontSize:14,color:'var(--text-primary)',marginBottom:10,display:'flex',alignItems:'center',gap:6}}><Code size={14}/>Base URL</h2>
        <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',borderRadius:10,background:'var(--body-bg)',border:'1px solid var(--card-border)'}}>
          <code style={{fontSize:13,color:'var(--color-primary)',flex:1,fontFamily:'monospace'}}>{API_URL}</code>
          <button onClick={()=>copy('base',API_URL)} style={{background:'none',border:'none',cursor:'pointer',color:copied==='base'?'#059669':'var(--text-muted)',transition:'color .15s'}}>
            {copied==='base'?<CheckCircle size={14}/>:<Copy size={14}/>}
          </button>
        </div>
      </div>

      {/* Auth info */}
      <div style={{borderRadius:16,border:'1px solid var(--card-border)',background:'var(--card-bg)',padding:20,marginBottom:16}}>
        <h2 style={{fontWeight:600,fontSize:14,color:'var(--text-primary)',marginBottom:10,display:'flex',alignItems:'center',gap:6}}><Shield size={14}/>Authentification</h2>
        <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:8}}>Ajoutez votre clé dans le header de chaque requête :</p>
        <div style={{padding:'10px 14px',borderRadius:10,background:'#1E293B',fontFamily:'monospace',fontSize:12,color:'#94A3B8'}}>
          <span style={{color:'#7DD3FC'}}>Authorization</span>: <span style={{color:'#86EFAC'}}>Bearer</span> <span style={{color:'#FCA5A5'}}>{'<votre-clé>'}</span>
        </div>
      </div>

      {/* Keys list */}
      <div style={{borderRadius:16,border:'1px solid var(--card-border)',background:'var(--card-bg)',overflow:'hidden'}}>
        <div style={{padding:'12px 20px',borderBottom:'1px solid var(--card-border)',background:'var(--body-bg)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{fontWeight:600,fontSize:13,color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:'0.05em'}}>Clés API — {keys.length}</span>
        </div>

        {loading ? (
          <div style={{padding:40,display:'flex',justifyContent:'center'}}>
            <Loader2 size={24} className="animate-spin" style={{color:'var(--color-primary)'}}/>
          </div>
        ) : keys.length === 0 ? (
          <div style={{padding:'40px 20px',textAlign:'center'}}>
            <Key size={40} style={{color:'var(--card-border)',margin:'0 auto 12px'}}/>
            <p style={{fontSize:14,color:'var(--text-muted)',marginBottom:12}}>Aucune clé API — créez votre première clé</p>
            <button onClick={()=>setShowCreate(true)}
              style={{padding:'8px 20px',borderRadius:10,border:'none',background:'var(--color-primary)',color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer'}}>
              + Créer une clé
            </button>
          </div>
        ) : keys.map(k=>(
          <div key={k.id} style={{borderBottom:'1px solid var(--card-border)',padding:'16px 20px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
              <div>
                <div style={{fontWeight:600,fontSize:14,color:'var(--text-primary)',marginBottom:2}}>{k.name}</div>
                <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                  {k.scopes.map(s=>{
                    const sc = SCOPES_OPTIONS.find(x=>x.id===s);
                    return sc ? (
                      <span key={s} className="text-xs font-medium px-1.5 py-0.5 rounded-md" style={{background:`${sc.color}18`,color:sc.color}}>{sc.label}</span>
                    ) : null;
                  })}
                </div>
              </div>
              <button onClick={()=>remove(k.id,k.name)} disabled={deleting===k.id}
                style={{padding:6,borderRadius:8,background:'none',border:'none',cursor:'pointer',color:'#EF4444',display:'flex',alignItems:'center',opacity:deleting===k.id?0.5:1}}>
                {deleting===k.id?<Loader2 size={14} className="animate-spin"/>:<Trash2 size={14}/>}
              </button>
            </div>

            <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderRadius:8,background:'var(--body-bg)',border:'1px solid var(--card-border)',marginBottom:8}}>
              <code style={{flex:1,fontSize:12,color:'var(--text-secondary)',fontFamily:'monospace'}}>
                {show[k.id]?k.key:k.key.slice(0,12)+'•'.repeat(20)}
              </code>
              <button onClick={()=>setShow(s=>({...s,[k.id]:!s[k.id]}))} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)'}}>
                {show[k.id]?<EyeOff size={13}/>:<Eye size={13}/>}
              </button>
              <button onClick={()=>copy(k.id,k.key)} style={{background:'none',border:'none',cursor:'pointer',color:copied===k.id?'#059669':'var(--text-muted)',transition:'color .15s'}}>
                {copied===k.id?<CheckCircle size={13}/>:<Copy size={13}/>}
              </button>
            </div>

            <div style={{display:'flex',gap:20,fontSize:12,color:'var(--text-muted)'}}>
              <span>Créé le {fmtDate(k.createdAt)}</span>
              <span>Dernière utilisation : {k.lastUsed?fmtDate(k.lastUsed):'jamais'}</span>
              <span>{(k.requests||0).toLocaleString('fr-FR')} requêtes</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
