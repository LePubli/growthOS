import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import {
  Search, Plus, Star, Mail, Phone, Upload, FileText,
  Download, RefreshCw, ChevronRight, Building2, Loader2,
  CheckCircle, AlertCircle, X, Trash2, Tag, ArchiveX, CheckSquare, Square,
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

const STATUS_OPTIONS = [
  {value:'all',label:'Tous'},{value:'new',label:'Nouveau'},{value:'contacted',label:'Contacté'},
  {value:'qualified',label:'Qualifié'},{value:'negotiation',label:'Négociation'},
  {value:'won',label:'Gagné'},{value:'lost',label:'Perdu'},{value:'archived',label:'Archivés'},
];
const STATUS_COLORS: Record<string,string> = {
  new:'bg-gray-100 text-gray-600', contacted:'bg-blue-50 text-blue-600',
  qualified:'bg-purple-50 text-purple-600', negotiation:'bg-amber-50 text-amber-600',
  won:'bg-green-50 text-green-600', lost:'bg-red-50 text-red-500',
  archived:'bg-gray-100 text-gray-400',
};

function CreateModal({ onClose, onSave }: { onClose:()=>void; onSave:()=>void }) {
  const [form, setForm] = useState({ firstName:'', lastName:'', email:'', phone:'', company:'', jobTitle:'', website:'', status:'new' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const set = (k:string,v:string) => setForm(f=>({...f,[k]:v}));

  const save = async () => {
    if (!form.firstName && !form.email && !form.company) { setError('Remplissez au moins un champ'); return; }
    setLoading(true); setError(null);
    try {
      await apiClient.post('/prospects', form);
      onSave(); onClose();
    } catch(e:any) { setError(e.message || 'Erreur lors de la création'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Nouveau prospect</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400"/></button>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[{k:'firstName',l:'Prénom'},{k:'lastName',l:'Nom'},{k:'email',l:'Email'},{k:'phone',l:'Téléphone'},{k:'company',l:'Entreprise'},{k:'jobTitle',l:'Poste'},{k:'website',l:'Site web'}].map(f=>(
            <div key={f.k} className={f.k==='website'?'col-span-2':''}>
              <label className="block text-xs font-medium text-gray-500 mb-1">{f.l}</label>
              <input value={(form as any)[f.k]} onChange={e=>set(f.k,e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Statut</label>
            <select value={form.status} onChange={e=>set('status',e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
              {STATUS_OPTIONS.filter(s=>s.value!=='all').map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
        {error && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 mb-3"><AlertCircle className="w-4 h-4"/>{error}</div>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Annuler</button>
          <button onClick={save} disabled={loading} className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
            {loading?<Loader2 className="w-4 h-4 animate-spin"/>:<CheckCircle className="w-4 h-4"/>}Créer
          </button>
        </div>
      </div>
    </div>
  );
}

function ImportCSVModal({ onClose, onSave }: { onClose:()=>void; onSave:()=>void }) {
  const [file, setFile] = useState<File|null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string|null>(null);
  const ref = useRef<HTMLInputElement>(null);

  const CSV_TEMPLATE = `firstName,lastName,email,phone,company,jobTitle,website,status
Marie,Dupont,m.dupont@acme.fr,+33612345678,Acme Corp,Directrice Marketing,https://acme.fr,new
Thomas,Martin,t.martin@techvision.io,,TechVision,CTO,https://techvision.io,new`;

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE],{type:'text/csv'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'prospects_template.csv'; a.click();
  };

  const parseCSV = (text:string) => {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h=>h.trim());
    return lines.slice(1).map(line=>{
      const vals = line.split(',');
      return headers.reduce((obj,h,i)=>({...obj,[h]:vals[i]?.trim()||''}),{} as any);
    }).filter((r:any)=>r.firstName||r.email||r.company);
  };

  const handleFile = (f:File) => {
    setFile(f); setError(null);
    const reader = new FileReader();
    reader.onload = e => {
      try { const rows = parseCSV(e.target?.result as string); setPreview(rows.slice(0,3)); setCount(rows.length); }
      catch { setError('Fichier CSV invalide'); }
    };
    reader.readAsText(f);
  };

  const importData = async () => {
    if (!file) return;
    setLoading(true); setError(null);
    try {
      const text = await file.text();
      const prospects = parseCSV(text);
      await apiClient.post('/prospects/bulk', { prospects });
      setDone(true);
      setTimeout(()=>{onSave();onClose();},2000);
    } catch(e:any) { setError(e.message || 'Erreur lors de l\'import'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Importer depuis CSV</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400"/></button>
        </div>
        {done ? (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-teal-600 mx-auto mb-3"/>
            <p className="text-xl font-bold text-gray-900">Import réussi !</p>
            <p className="text-gray-400 mt-1">{count} prospects importés</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500">Importez vos prospects depuis un fichier CSV.</p>
              <button onClick={downloadTemplate} className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-700">
                <Download className="w-3.5 h-3.5"/>Télécharger le modèle
              </button>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 mb-4 text-xs font-mono text-gray-500">
              <span className="font-sans text-gray-700 font-medium text-xs block mb-1">Colonnes attendues :</span>
              firstName, lastName, email, phone, company, jobTitle, website, status
            </div>
            <div onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)handleFile(f);}} onDragOver={e=>e.preventDefault()}
              onClick={()=>ref.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all mb-4 ${file?'border-teal-400 bg-teal-50':'border-gray-200 hover:border-teal-300 hover:bg-gray-50'}`}>
              <input ref={ref} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={e=>e.target.files?.[0]&&handleFile(e.target.files[0])}/>
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="w-8 h-8 text-teal-600"/>
                  <div className="text-left">
                    <div className="font-medium text-gray-900">{file.name}</div>
                    <div className="text-sm text-gray-400">{count} prospect{count>1?'s':''} détecté{count>1?'s':''}</div>
                  </div>
                </div>
              ) : (
                <><Upload className="w-10 h-10 text-gray-300 mx-auto mb-3"/><p className="text-sm font-medium text-gray-600">Glissez votre .csv ici</p><p className="text-xs text-gray-400 mt-1">ou cliquez pour sélectionner</p></>
              )}
            </div>
            {preview.length>0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-500 mb-2">Aperçu ({count} lignes) :</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50"><tr>{['Prénom','Nom','Email','Entreprise'].map(h=><th key={h} className="text-left px-2 py-1 text-gray-500">{h}</th>)}</tr></thead>
                    <tbody>{preview.map((r,i)=><tr key={i} className="border-t border-gray-100"><td className="px-2 py-1">{r.firstName}</td><td className="px-2 py-1">{r.lastName}</td><td className="px-2 py-1 text-teal-600">{r.email}</td><td className="px-2 py-1">{r.company}</td></tr>)}</tbody>
                  </table>
                  {count>3&&<p className="text-xs text-gray-400 mt-1">... et {count-3} autres</p>}
                </div>
              </div>
            )}
            {error && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 mb-3"><AlertCircle className="w-4 h-4"/>{error}</div>}
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Annuler</button>
              <button onClick={importData} disabled={!file||loading} className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                {loading?<Loader2 className="w-4 h-4 animate-spin"/>:<Upload className="w-4 h-4"/>}Importer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function BulkStatusModal({ count, onClose, onConfirm }: { count: number; onClose: () => void; onConfirm: (s: string) => void }) {
  const [status, setStatus] = useState('contacted');
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <h2 className="text-base font-bold text-gray-900 mb-4">Changer le statut ({count} prospects)</h2>
        <select value={status} onChange={e=>setStatus(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-teal-500">
          {STATUS_OPTIONS.filter(s=>s.value!=='all').map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Annuler</button>
          <button onClick={()=>onConfirm(status)} className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium">Appliquer</button>
        </div>
      </div>
    </div>
  );
}

export default function ProspectsPage() {
  const [, navigate] = useLocation();
  const [prospects, setProspects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkStatus, setShowBulkStatus] = useState(false);

  const fetchProspects = async () => {
    setLoading(true);
    try {
      const params: Record<string,string> = { page: String(page), limit: '50' };
      if (status !== 'all') params.status = status;
      if (search) params.search = search;
      const result = await apiClient.get('/prospects', { params });
      const data = Array.isArray(result) ? result : (result as any).data || [];
      setProspects(data);
      setTotal((result as any).meta?.total || 0);
    } catch { setProspects([]); } finally { setLoading(false); }
  };

  useEffect(()=>{ fetchProspects(); },[status, page]);
  useEffect(()=>{ const t=setTimeout(fetchProspects,400); return()=>clearTimeout(t); },[search]);

  const toggleStar = async (id:string) => {
    setProspects(ps=>ps.map(p=>p.id===id?{...p,isStarred:!p.isStarred}:p));
    try {
      const p = prospects.find(x=>x.id===id);
      await apiClient.patch(`/prospects/${id}`, { isStarred: !p?.isStarred });
    } catch {}
  };

  const toggleSelect = (id: string) => {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleSelectAll = () => {
    if (selected.size === prospects.length) setSelected(new Set());
    else setSelected(new Set(prospects.map(p => p.id)));
  };

  const clearSelection = () => setSelected(new Set());

  const exportCSV = () => {
    const headers = ['Prénom','Nom','Email','Téléphone','Entreprise','Poste','Site','Statut','Score'];
    const rows = prospects.map(p => [
      p.firstName||'', p.lastName||'', p.email||'', p.phone||'',
      p.company||'', p.jobTitle||'', p.website||'', p.status||'', p.score||0,
    ]);
    const csv = [headers, ...rows].map(r => r.map((v: any) => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `prospects_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    toast.success(`${prospects.length} prospects exportés`);
  };

  const bulkArchive = async () => {
    const ids = Array.from(selected);
    try {
      await Promise.all(ids.map(id => apiClient.patch(`/prospects/${id}`, { status: 'archived' })));
      toast.success(`${ids.length} prospect${ids.length>1?'s':''} archivé${ids.length>1?'s':''}`);
      clearSelection(); fetchProspects();
    } catch { toast.error('Erreur lors de l\'archivage'); }
  };

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    if (!confirm(`Supprimer ${ids.length} prospect${ids.length>1?'s':''} définitivement ?`)) return;
    try {
      await Promise.all(ids.map(id => apiClient.delete(`/prospects/${id}`)));
      toast.success(`${ids.length} prospect${ids.length>1?'s':''} supprimé${ids.length>1?'s':''}`);
      clearSelection(); fetchProspects();
    } catch { toast.error('Erreur lors de la suppression'); }
  };

  const bulkChangeStatus = async (newStatus: string) => {
    const ids = Array.from(selected);
    try {
      await Promise.all(ids.map(id => apiClient.patch(`/prospects/${id}`, { status: newStatus })));
      toast.success(`Statut mis à jour pour ${ids.length} prospect${ids.length>1?'s':''}`);
      clearSelection(); fetchProspects(); setShowBulkStatus(false);
    } catch { toast.error('Erreur'); }
  };

  const byStatus = STATUS_OPTIONS.reduce((acc,s) => {
    if(s.value!=='all') acc[s.value]=prospects.filter(p=>p.status===s.value).length;
    return acc;
  },{} as Record<string,number>);

  const allSelected = prospects.length > 0 && selected.size === prospects.length;
  const someSelected = selected.size > 0 && selected.size < prospects.length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {showCreate && <CreateModal onClose={()=>setShowCreate(false)} onSave={()=>{fetchProspects();toast.success('Prospect créé ✓');}}/>}
      {showImport && <ImportCSVModal onClose={()=>setShowImport(false)} onSave={()=>{fetchProspects();toast.success('Import réussi ✓');}}/>}
      {showBulkStatus && <BulkStatusModal count={selected.size} onClose={()=>setShowBulkStatus(false)} onConfirm={bulkChangeStatus}/>}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prospects</h1>
          <p className="text-sm text-gray-400">{total||prospects.length} prospects au total</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-teal-300 hover:text-teal-600">
            <Download className="w-4 h-4"/>Exporter CSV
          </button>
          <button onClick={()=>setShowImport(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-teal-300 hover:text-teal-600">
            <Upload className="w-4 h-4"/>Importer CSV
          </button>
          <button onClick={fetchProspects} disabled={loading} className="p-2 bg-white border border-gray-200 rounded-xl text-gray-500 hover:border-teal-300">
            <RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`}/>
          </button>
          <button onClick={()=>setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700">
            <Plus className="w-4 h-4"/>Nouveau prospect
          </button>
        </div>
      </div>

      {/* Filtres par statut */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {STATUS_OPTIONS.map(s=>(
          <button key={s.value} onClick={()=>{setStatus(s.value);setPage(1);}}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${status===s.value?'bg-teal-600 text-white':'bg-white border border-gray-200 text-gray-500 hover:border-teal-300'}`}>
            {s.label}{s.value!=='all'&&byStatus[s.value]>0?` (${byStatus[s.value]})`:s.value==='all'?` (${prospects.length})`:''}
          </button>
        ))}
      </div>

      {/* Recherche */}
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher par nom, email, entreprise..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-900 text-white rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4">
          <span className="text-sm font-semibold">{selected.size} sélectionné{selected.size>1?'s':''}</span>
          <div className="w-px h-5 bg-white/20"/>
          <button onClick={()=>setShowBulkStatus(true)} className="flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors">
            <Tag className="w-4 h-4"/>Changer statut
          </button>
          <button onClick={bulkArchive} className="flex items-center gap-1.5 text-sm text-amber-300 hover:text-amber-200 transition-colors">
            <ArchiveX className="w-4 h-4"/>Archiver
          </button>
          <button onClick={bulkDelete} className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 transition-colors">
            <Trash2 className="w-4 h-4"/>Supprimer
          </button>
          <button onClick={clearSelection} className="ml-2 text-white/40 hover:text-white/70">
            <X className="w-4 h-4"/>
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left">
                <button onClick={toggleSelectAll} className="flex items-center">
                  {allSelected
                    ? <CheckSquare className="w-4 h-4 text-teal-600"/>
                    : someSelected
                    ? <CheckSquare className="w-4 h-4 text-teal-400 opacity-60"/>
                    : <Square className="w-4 h-4 text-gray-300"/>}
                </button>
              </th>
              {['','Nom','Entreprise','Email / Tél','Statut','Score','Actions'].map(h=>(
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && prospects.length===0 && (
              <tr><td colSpan={8} className="text-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto"/>
              </td></tr>
            )}
            {!loading && prospects.length===0 && (
              <tr><td colSpan={8} className="text-center py-16">
                <Building2 className="w-10 h-10 text-gray-200 mx-auto mb-3"/>
                <p className="text-gray-400">Aucun prospect</p>
                <div className="flex gap-3 justify-center mt-3">
                  <button onClick={()=>setShowCreate(true)} className="px-4 py-2 bg-teal-600 text-white rounded-xl text-sm">+ Créer</button>
                  <button onClick={()=>setShowImport(true)} className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm">Importer CSV</button>
                </div>
              </td></tr>
            )}
            {prospects.map(p=>(
              <tr key={p.id}
                className={`hover:bg-gray-50 cursor-pointer transition-colors ${selected.has(p.id)?'bg-teal-50':''}`}
                onClick={()=>navigate(`/prospects/${p.id}`)}>
                <td className="px-4 py-3" onClick={e=>e.stopPropagation()}>
                  <button onClick={()=>toggleSelect(p.id)} className="flex items-center">
                    {selected.has(p.id)
                      ? <CheckSquare className="w-4 h-4 text-teal-600"/>
                      : <Square className="w-4 h-4 text-gray-300 hover:text-gray-400"/>}
                  </button>
                </td>
                <td className="px-4 py-3" onClick={e=>e.stopPropagation()}>
                  <button onClick={()=>toggleStar(p.id)} className={`${p.isStarred?'text-amber-400':'text-gray-300 hover:text-amber-400'}`}>
                    <Star className={`w-4 h-4 ${p.isStarred?'fill-amber-400':''}`}/>
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {(p.firstName||p.company||'?')[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{p.firstName} {p.lastName}</div>
                      <div className="text-xs text-gray-400">{p.jobTitle}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{p.company||'—'}</td>
                <td className="px-4 py-3" onClick={e=>e.stopPropagation()}>
                  <div className="flex flex-col gap-0.5">
                    {p.email && <a href={`mailto:${p.email}`} className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700"><Mail className="w-3 h-3"/>{p.email}</a>}
                    {p.phone && <a href={`tel:${p.phone}`} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"><Phone className="w-3 h-3"/>{p.phone}</a>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[p.status]||'bg-gray-100 text-gray-500'}`}>
                    {STATUS_OPTIONS.find(s=>s.value===p.status)?.label||p.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {p.score>0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-100 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${p.score>=80?'bg-green-500':p.score>=50?'bg-amber-500':'bg-gray-400'}`} style={{width:`${p.score}%`}}/>
                      </div>
                      <span className="text-xs font-bold text-gray-700">{p.score}</span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3" onClick={e=>e.stopPropagation()}>
                  <button onClick={()=>navigate(`/prospects/${p.id}`)} className="text-gray-300 hover:text-teal-600">
                    <ChevronRight className="w-5 h-5"/>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 50 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 disabled:opacity-40">← Précédent</button>
          <span className="text-sm text-gray-400">Page {page} / {Math.ceil(total/50)}</span>
          <button onClick={()=>setPage(p=>p+1)} disabled={page*50>=total}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 disabled:opacity-40">Suivant →</button>
        </div>
      )}
    </div>
  );
}
