'use client';
import { useState, useEffect } from 'react';
import { Users, Search, Plus, Upload, Download, Mail, Phone, Globe, Star, RefreshCw, X, Loader2, CheckCircle, AlertCircle, MoreHorizontal, Building2 } from 'lucide-react';

interface Prospect {
  id: string; firstName?: string; lastName?: string; email?: string;
  phone?: string; company?: string; jobTitle?: string; website?: string;
  linkedinUrl?: string; status?: string; score?: number; tags?: string[];
  isStarred?: boolean; createdAt?: string;
}

const STATUS = {
  new:         { label:'Nouveau',     color:'text-gray-600',   bg:'bg-gray-100' },
  contacted:   { label:'Contacté',    color:'text-blue-600',   bg:'bg-blue-50' },
  qualified:   { label:'Qualifié',    color:'text-purple-600', bg:'bg-purple-50' },
  negotiation: { label:'Négociation', color:'text-amber-600',  bg:'bg-amber-50' },
  won:         { label:'Gagné',       color:'text-green-600',  bg:'bg-green-50' },
  lost:        { label:'Perdu',       color:'text-red-600',    bg:'bg-red-50' },
};

const MOCK: Prospect[] = [
  { id:'1', firstName:'Sophie', lastName:'Martin', email:'s.martin@acmecorp.fr', company:'Acme Corp', jobTitle:'DG', status:'qualified', score:87, tags:['SaaS','Chaud'], isStarred:true, createdAt:'2026-05-20' },
  { id:'2', firstName:'Thomas', lastName:'Durand', email:'t.durand@techvision.io', company:'TechVision', jobTitle:'CTO', status:'contacted', score:72, tags:['Tech'], isStarred:false, createdAt:'2026-05-19' },
  { id:'3', firstName:'Marie', lastName:'Leroy', email:'m.leroy@startupx.fr', company:'StartupX', jobTitle:'CEO', status:'new', score:55, tags:['Startup'], isStarred:false, createdAt:'2026-05-18' },
  { id:'4', firstName:'Pierre', lastName:'Moreau', email:'p.moreau@bigcorp.com', company:'BigCorp', jobTitle:'VP Sales', status:'negotiation', score:91, tags:['Enterprise'], isStarred:true, createdAt:'2026-05-17' },
];

function Avatar({ firstName, lastName }: { firstName?: string; lastName?: string }) {
  const initials = `${firstName?.[0]||''}${lastName?.[0]||''}`.toUpperCase() || '?';
  const colors = ['bg-blue-500','bg-purple-500','bg-teal-500','bg-orange-500','bg-pink-500'];
  const color = colors[(firstName?.charCodeAt(0)||0) % colors.length];
  return <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>{initials}</div>;
}

function CreateModal({ onClose, onSave, apiUrl }: { onClose: () => void; onSave: () => void; apiUrl: string }) {
  const [form, setForm] = useState({ firstName:'', lastName:'', email:'', phone:'', company:'', jobTitle:'', website:'', linkedinUrl:'', status:'new', tags:'' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.email && !form.company) { setError('Email ou entreprise requis'); return; }
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem('access_token') || '';
      const body = { ...form, tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [] };
      const res = await fetch(`${apiUrl}/api/v1/prospects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || 'Erreur création'); }
      onSave(); onClose();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const fields = [
    { key:'firstName', label:'Prénom', placeholder:'Sophie', half:true },
    { key:'lastName', label:'Nom', placeholder:'Martin', half:true },
    { key:'email', label:'Email', placeholder:'sophie@acme.fr', half:false },
    { key:'phone', label:'Téléphone', placeholder:'+33 6 12 34 56 78', half:true },
    { key:'company', label:'Entreprise', placeholder:'Acme Corp', half:true },
    { key:'jobTitle', label:'Poste', placeholder:'Directrice Générale', half:true },
    { key:'website', label:'Site web', placeholder:'https://acmecorp.fr', half:true },
    { key:'linkedinUrl', label:'LinkedIn', placeholder:'linkedin.com/in/sophie', half:false },
    { key:'tags', label:'Tags (séparés par virgule)', placeholder:'SaaS, Chaud, Enterprise', half:false },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Nouveau prospect</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {fields.map(f => (
            <div key={f.key} className={f.half ? '' : 'col-span-2'}>
              <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
              {f.key === 'status' ? (
                <select value={form.status} onChange={e => set('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                  {Object.entries(STATUS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              ) : (
                <input value={(form as any)[f.key]} onChange={e => set(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              )}
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Statut</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
              {Object.entries(STATUS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>
        {error && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 mb-3"><AlertCircle className="w-4 h-4" />{error}</div>}
        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
          <button onClick={handleSave} disabled={loading}
            className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProspectsPage() {
  const [prospects, setProspects] = useState<Prospect[]>(MOCK);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<string|null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const API = process.env.NEXT_PUBLIC_API_URL || '';

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const fetchProspects = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token') || '';
      const res = await fetch(`${API}/api/v1/prospects`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); const list = Array.isArray(d) ? d : d.data || []; if (list.length > 0) setProspects(list); }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchProspects(); }, []);

  const toggleStar = (id: string) => setProspects(p => p.map(x => x.id === id ? { ...x, isStarred: !x.isStarred } : x));
  const toggleSelect = (id: string) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const filtered = prospects.filter(p => {
    const ms = !search || `${p.firstName} ${p.lastName} ${p.email} ${p.company}`.toLowerCase().includes(search.toLowerCase());
    const mst = status === 'all' || p.status === status;
    return ms && mst;
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {toast && <div className="fixed top-6 right-6 z-50 bg-teal-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2"><CheckCircle className="w-4 h-4" />{toast}</div>}
      {showCreate && <CreateModal apiUrl={API} onClose={() => setShowCreate(false)} onSave={() => { fetchProspects(); showToast('Prospect créé ✓ — plugin SEO Analyzer en cours...'); }} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prospects</h1>
          <p className="text-sm text-gray-400 mt-0.5">{prospects.length} prospects · {prospects.filter(p=>p.isStarred).length} favoris</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-gray-300"><Upload className="w-4 h-4" /> Importer CSV</button>
          <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-gray-300"><Download className="w-4 h-4" /> Exporter</button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700"><Plus className="w-4 h-4" /> Nouveau prospect</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', ...Object.keys(STATUS)].map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${status === s ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500'}`}>
              {s === 'all' ? 'Tous' : (STATUS as any)[s]?.label}
            </button>
          ))}
        </div>
        <button onClick={fetchProspects} disabled={loading} className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-500">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="w-10 px-4 py-3"><input type="checkbox" onChange={e => setSelected(e.target.checked ? new Set(filtered.map(p=>p.id)) : new Set())} className="rounded" /></th>
              <th className="w-8 px-2 py-3"></th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Prospect</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Entreprise</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Score</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tags</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? [...Array(4)].map((_,i) => (
              <tr key={i}>{[...Array(8)].map((_,j) => <td key={j} className="px-4 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}</tr>
            )) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-16">
                <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Aucun prospect</p>
                <button onClick={() => setShowCreate(true)} className="mt-3 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm">Créer le premier</button>
              </td></tr>
            ) : filtered.map(p => {
              const st = (STATUS as any)[p.status||'new'] || STATUS.new;
              return (
                <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${selected.has(p.id) ? 'bg-teal-50/30' : ''}`}>
                  <td className="px-4 py-4"><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} className="rounded" /></td>
                  <td className="px-2 py-4"><button onClick={() => toggleStar(p.id)} className="text-gray-300 hover:text-amber-400"><Star className={`w-4 h-4 ${p.isStarred ? 'text-amber-400 fill-amber-400' : ''}`} /></button></td>
                  <td className="px-4 py-4"><div className="flex items-center gap-3"><Avatar firstName={p.firstName} lastName={p.lastName} /><div><div className="font-medium text-gray-900 text-sm">{p.firstName} {p.lastName}</div><div className="text-xs text-gray-400">{p.email}</div></div></div></td>
                  <td className="px-4 py-4"><div className="text-sm text-gray-700">{p.company}</div><div className="text-xs text-gray-400">{p.jobTitle}</div></td>
                  <td className="px-4 py-4"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.color} ${st.bg}`}>{st.label}</span></td>
                  <td className="px-4 py-4">{p.score ? <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.score>=80?'bg-green-50 text-green-600':p.score>=60?'bg-amber-50 text-amber-600':'bg-red-50 text-red-500'}`}>{p.score}</span> : null}</td>
                  <td className="px-4 py-4"><div className="flex flex-wrap gap-1">{(p.tags||[]).slice(0,2).map(t => <span key={t} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{t}</span>)}</div></td>
                  <td className="px-4 py-4"><div className="flex gap-2">{p.email && <a href={`mailto:${p.email}`} className="text-gray-400 hover:text-teal-600"><Mail className="w-4 h-4" /></a>}{p.phone && <a href={`tel:${p.phone}`} className="text-gray-400 hover:text-teal-600"><Phone className="w-4 h-4" /></a>}{p.website && <a href={p.website} target="_blank" className="text-gray-400 hover:text-blue-600"><Globe className="w-4 h-4" /></a>}</div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="border-t border-gray-100 px-6 py-3 flex items-center justify-between text-sm text-gray-400">
          <span>{filtered.length} résultat(s)</span>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs">Précédent</button>
            <button className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs">1</button>
            <button className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs">Suivant</button>
          </div>
        </div>
      </div>
    </div>
  );
}
