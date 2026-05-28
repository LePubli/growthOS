'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Mail, Phone, Globe, Search, Plus, Star, Loader2, ChevronRight, Building2, RefreshCw, Download, Filter, Users } from 'lucide-react';

export default function ContactsPage() {
  const router = useRouter();
  const [prospects, setProspects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [starred, setStarred] = useState(false);
  const API = process.env.NEXT_PUBLIC_API_URL || '';

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token')||'';
      const params = new URLSearchParams({ limit:'100' });
      if (search) params.set('search',search);
      const res = await fetch(`${API}/api/v1/prospects?${params}`,{headers:{Authorization:`Bearer ${token}`}});
      if (res.ok) { const d=await res.json(); setProspects(Array.isArray(d)?d:d.data||[]); }
    } catch {} finally { setLoading(false); }
  };

  useEffect(()=>{ fetchContacts(); },[]);
  useEffect(()=>{ const t=setTimeout(fetchContacts,400); return()=>clearTimeout(t); },[search]);

  const toggleStar = async (id:string) => {
    setProspects(ps=>ps.map(p=>p.id===id?{...p,isStarred:!p.isStarred}:p));
    try {
      const token=localStorage.getItem('access_token')||'';
      const p=prospects.find(x=>x.id===id);
      await fetch(`${API}/api/v1/prospects/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({isStarred:!p?.isStarred})});
    } catch {}
  };

  const filtered = starred ? prospects.filter(p=>p.isStarred) : prospects;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contact Intelligence</h1>
          <p className="text-sm text-gray-400">{prospects.length} contacts — enrichis par les plugins</p>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>setStarred(!starred)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${starred?'bg-amber-50 border-amber-300 text-amber-600':'bg-white border-gray-200 text-gray-600 hover:border-amber-300'}`}>
            <Star className={`w-4 h-4 ${starred?'fill-amber-400 text-amber-400':''}`}/>Favoris
          </button>
          <button onClick={fetchContacts} disabled={loading} className="p-2 bg-white border border-gray-200 rounded-xl text-gray-500">
            <RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`}/>
          </button>
          <button onClick={()=>router.push('/prospects')} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700">
            <Plus className="w-4 h-4"/>Nouveau contact
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          {label:'Total contacts',value:prospects.length,icon:<Users className="w-5 h-5"/>,color:'text-blue-600 bg-blue-50'},
          {label:'Avec email',value:prospects.filter(p=>p.email).length,icon:<Mail className="w-5 h-5"/>,color:'text-teal-600 bg-teal-50'},
          {label:'Avec téléphone',value:prospects.filter(p=>p.phone).length,icon:<Phone className="w-5 h-5"/>,color:'text-green-600 bg-green-50'},
          {label:'Favoris',value:prospects.filter(p=>p.isStarred).length,icon:<Star className="w-5 h-5"/>,color:'text-amber-600 bg-amber-50'},
        ].map((s,i)=>(
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>{s.icon}</div>
            <div><div className="text-2xl font-bold text-gray-900">{s.value}</div><div className="text-xs text-gray-400">{s.label}</div></div>
          </div>
        ))}
      </div>

      {/* Recherche */}
      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un contact..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
      </div>

      {/* Grille contacts */}
      {loading && filtered.length===0 ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-teal-600"/></div>
      ) : filtered.length===0 ? (
        <div className="text-center py-20">
          <Users className="w-12 h-12 text-gray-200 mx-auto mb-3"/>
          <p className="text-gray-400">{starred?'Aucun contact favori':'Aucun contact — ajoutez des prospects d\'abord'}</p>
          <button onClick={()=>router.push('/prospects')} className="mt-3 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm">Voir les prospects</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(p=>(
            <div key={p.id} onClick={()=>router.push(`/prospects/${p.id}`)}
              className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md hover:border-teal-200 cursor-pointer transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-teal-600 flex items-center justify-center text-white text-lg font-bold">
                  {(p.firstName||p.company||'?')[0].toUpperCase()}
                </div>
                <button onClick={e=>{e.stopPropagation();toggleStar(p.id);}} className={`${p.isStarred?'text-amber-400':'text-gray-200 hover:text-amber-400'}`}>
                  <Star className={`w-4 h-4 ${p.isStarred?'fill-amber-400':''}`}/>
                </button>
              </div>
              <h3 className="font-semibold text-gray-900 truncate">{p.firstName} {p.lastName}</h3>
              <p className="text-xs text-gray-400 mb-2">{p.jobTitle||'—'}</p>
              {p.company && <div className="flex items-center gap-1 text-xs text-gray-500 mb-1"><Building2 className="w-3 h-3"/>{p.company}</div>}
              {p.email && <div className="flex items-center gap-1 text-xs text-teal-600 mb-1 truncate"><Mail className="w-3 h-3 flex-shrink-0"/>{p.email}</div>}
              {p.phone && <div className="flex items-center gap-1 text-xs text-gray-400"><Phone className="w-3 h-3"/>{p.phone}</div>}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  p.status==='qualified'?'bg-purple-50 text-purple-600':
                  p.status==='contacted'?'bg-blue-50 text-blue-600':
                  p.status==='won'?'bg-green-50 text-green-600':
                  'bg-gray-100 text-gray-500'
                }`}>{p.status}</span>
                {p.score>0 && <span className={`text-xs font-bold ${p.score>=80?'text-green-600':p.score>=50?'text-amber-600':'text-gray-400'}`}>{p.score}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
