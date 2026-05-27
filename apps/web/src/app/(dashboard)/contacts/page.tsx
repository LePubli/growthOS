'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { User, Mail, Phone, Search, Plus, Star, Loader2, RefreshCw, Building2, X, Edit2, Trash2, Save, AlertCircle, CheckCircle } from 'lucide-react';

function ContactModal({ contact, onClose, onSave, onDelete, apiUrl }: any) {
  const isNew = !contact?.id;
  const [form, setForm] = useState(contact || { firstName:'', lastName:'', email:'', phone:'', company:'', jobTitle:'', status:'new' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const set = (k:string,v:string) => setForm((f:any)=>({...f,[k]:v}));

  const save = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('access_token')||'';
      const url = isNew ? `${apiUrl}/api/v1/prospects` : `${apiUrl}/api/v1/prospects/${contact.id}`;
      const method = isNew ? 'POST' : 'PATCH';
      const res = await fetch(url,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(form)});
      if (res.ok) { onSave(await res.json()); onClose(); }
    } catch {} finally { setSaving(false); }
  };

  const del = async () => {
    if (!confirm(`Supprimer ${form.firstName} ${form.lastName} ?`)) return;
    setDeleting(true);
    try {
      const token = localStorage.getItem('access_token')||'';
      await fetch(`${apiUrl}/api/v1/prospects/${contact.id}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});
      onDelete(contact.id); onClose();
    } catch {} finally { setDeleting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl" style={{background:'var(--card-bg)'}}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold" style={{color:'var(--text-primary)'}}>{isNew?'Nouveau contact':'Modifier le contact'}</h2>
          <button onClick={onClose} style={{color:'var(--text-muted)'}}><X className="w-5 h-5"/></button>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[{k:'firstName',l:'Prénom'},{k:'lastName',l:'Nom'},{k:'email',l:'Email'},{k:'phone',l:'Téléphone'},{k:'company',l:'Entreprise'},{k:'jobTitle',l:'Poste'}].map(f=>(
            <div key={f.k}>
              <label className="block text-xs font-medium mb-1" style={{color:'var(--text-muted)'}}>{f.l}</label>
              <input value={form[f.k]||''} onChange={e=>set(f.k,e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none" style={{borderColor:'var(--card-border)',background:'var(--body-bg)',color:'var(--text-primary)'}}/>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          {!isNew&&<button onClick={del} disabled={deleting} className="px-4 py-2.5 bg-red-50 text-red-500 rounded-xl text-sm font-medium">
            {deleting?<Loader2 className="w-4 h-4 animate-spin inline"/>:<Trash2 className="w-4 h-4 inline mr-1"/>}Supprimer
          </button>}
          <button onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm" style={{borderColor:'var(--card-border)',color:'var(--text-secondary)'}}>Annuler</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white" style={{background:'var(--color-primary)'}}>
            {saving?<Loader2 className="w-4 h-4 animate-spin inline"/>:<Save className="w-4 h-4 inline mr-1"/>}{isNew?'Créer':'Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ContactsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [prospects, setProspects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [starred, setStarred] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [showNew, setShowNew] = useState(searchParams.get('new')==='1');
  const [toast, setToast] = useState<{msg:string;type:'success'|'error'}|null>(null);
  const API = process.env.NEXT_PUBLIC_API_URL||'';

  const showToast = (msg:string,type:'success'|'error'='success')=>{setToast({msg,type});setTimeout(()=>setToast(null),3000);};

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token')||'';
      const params = new URLSearchParams({limit:'100'});
      if (search) params.set('search',search);
      const res = await fetch(`${API}/api/v1/prospects?${params}`,{headers:{Authorization:`Bearer ${token}`}});
      if (res.ok) { const d=await res.json(); setProspects(Array.isArray(d)?d:d.data||[]); }
    } catch {} finally { setLoading(false); }
  },[search,API]);

  useEffect(()=>{fetch_();},[]);
  useEffect(()=>{const t=setTimeout(fetch_,400);return()=>clearTimeout(t);},[search]);

  const toggleStar = async(id:string)=>{
    setProspects(ps=>ps.map(p=>p.id===id?{...p,isStarred:!p.isStarred}:p));
    try{const token=localStorage.getItem('access_token')||'';const p=prospects.find(x=>x.id===id);await fetch(`${API}/api/v1/prospects/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({isStarred:!p?.isStarred})});}catch{}
  };

  const handleSave = (updated:any) => {
    setProspects(ps=>{const idx=ps.findIndex(p=>p.id===updated.id);if(idx>=0){const n=[...ps];n[idx]=updated;return n;}return[updated,...ps];});
    showToast('Contact sauvegardé ✓');
  };
  const handleDelete = (id:string) => { setProspects(ps=>ps.filter(p=>p.id!==id)); showToast('Contact supprimé'); };

  const filtered = (starred?prospects.filter(p=>p.isStarred):prospects);

  return (
    <div className="min-h-screen p-6" style={{background:'var(--body-bg)'}}>
      {toast&&<div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white`} style={{background:toast.type==='success'?'var(--color-primary)':'#EF4444'}}>
        {toast.type==='success'?<CheckCircle className="w-4 h-4"/>:<AlertCircle className="w-4 h-4"/>}{toast.msg}
      </div>}
      {(showNew||selectedContact)&&<ContactModal contact={selectedContact||null} apiUrl={API} onClose={()=>{setShowNew(false);setSelectedContact(null);}} onSave={handleSave} onDelete={handleDelete}/>}

      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>Contact Intelligence</h1>
          <p className="text-sm" style={{color:'var(--text-muted)'}}>{prospects.length} contacts · Cliquez pour modifier</p></div>
        <div className="flex gap-2">
          <button onClick={()=>setStarred(s=>!s)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border ${starred?'bg-amber-50 border-amber-300 text-amber-600':'border-gray-200 text-gray-600'}`} style={!starred?{borderColor:'var(--card-border)',color:'var(--text-secondary)'}:{}}>
            <Star className={`w-4 h-4 ${starred?'fill-amber-400 text-amber-400':''}`}/>Favoris
          </button>
          <button onClick={fetch_} disabled={loading} className="p-2 rounded-xl border" style={{background:'var(--card-bg)',borderColor:'var(--card-border)',color:'var(--text-secondary)'}}>
            <RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`}/>
          </button>
          <button onClick={()=>setShowNew(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{background:'var(--color-primary)'}}>
            <Plus className="w-4 h-4"/>Nouveau contact
          </button>
        </div>
      </div>

      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{color:'var(--text-muted)'}}/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={{background:'var(--card-bg)',borderColor:'var(--card-border)',color:'var(--text-primary)'}}/>
      </div>

      {loading&&filtered.length===0?(<div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin" style={{color:'var(--color-primary)'}}/></div>)
      :filtered.length===0?(<div className="text-center py-20"><User className="w-12 h-12 mx-auto mb-3" style={{color:'var(--card-border)'}}/><p style={{color:'var(--text-muted)'}}>Aucun contact</p><button onClick={()=>setShowNew(true)} className="mt-3 px-4 py-2 rounded-xl text-sm text-white" style={{background:'var(--color-primary)'}}>+ Créer le premier</button></div>)
      :(
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(p=>(
            <div key={p.id} onClick={()=>setSelectedContact(p)}
              className="rounded-2xl border p-5 cursor-pointer hover:shadow-md transition-all group"
              style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}
              onMouseEnter={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--color-primary)'}
              onMouseLeave={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--card-border)'}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold" style={{background:'var(--color-primary)'}}>
                  {(p.firstName||p.company||'?')[0]?.toUpperCase()}
                </div>
                <div className="flex gap-1">
                  <button onClick={e=>{e.stopPropagation();toggleStar(p.id);}} className={p.isStarred?'text-amber-400':'text-gray-200 hover:text-amber-400'}>
                    <Star className={`w-4 h-4 ${p.isStarred?'fill-amber-400':''}`}/>
                  </button>
                  <Edit2 className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{color:'var(--color-primary)'}}/>
                </div>
              </div>
              <h3 className="font-semibold truncate" style={{color:'var(--text-primary)'}}>{p.firstName} {p.lastName}</h3>
              <p className="text-xs mb-2" style={{color:'var(--text-muted)'}}>{p.jobTitle||'—'}</p>
              {p.company&&<div className="flex items-center gap-1 text-xs mb-1" style={{color:'var(--text-secondary)'}}><Building2 className="w-3 h-3"/>{p.company}</div>}
              {p.email&&<div className="flex items-center gap-1 text-xs mb-1 truncate" style={{color:'var(--color-primary)'}}><Mail className="w-3 h-3 flex-shrink-0"/>{p.email}</div>}
              {p.phone&&<div className="flex items-center gap-1 text-xs" style={{color:'var(--text-muted)'}}><Phone className="w-3 h-3"/>{p.phone}</div>}
              <div className="flex items-center justify-between mt-3 pt-3 border-t" style={{borderColor:'var(--card-border)'}}>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{background:'var(--color-primary-light)',color:'var(--color-primary)'}}>{p.status}</span>
                {p.score>0&&<span className="text-xs font-bold" style={{color:p.score>=80?'#22C55E':p.score>=50?'#F59E0B':'var(--text-muted)'}}>{p.score}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
