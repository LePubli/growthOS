'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Target, Plus, Building2, Users, Globe, Search, Loader2, ChevronRight, CheckCircle, AlertCircle, TrendingUp, X, Filter, Zap } from 'lucide-react';

const SECTORS = ['Tous','SaaS / Tech','Industrie','Retail','Services','Finance','Santé','Construction'];
const SIZES = ['Tous','1-10','11-50','51-200','201-500','500+'];

const MOCK_ACCOUNTS = [
  { id:'1', name:'Acme Corp', sector:'SaaS / Tech', size:'51-200', website:'acmecorp.fr', city:'Paris', revenue:'5-10M€', score:87, contacts:3, deals:1, status:'target' },
  { id:'2', name:'TechVision', sector:'SaaS / Tech', size:'11-50', website:'techvision.io', city:'Lyon', revenue:'1-5M€', score:74, contacts:1, deals:0, status:'engaged' },
  { id:'3', name:'BigCorp Industries', sector:'Industrie', size:'201-500', website:'bigcorp.fr', city:'Bordeaux', revenue:'50M+', score:92, contacts:5, deals:2, status:'customer' },
  { id:'4', name:'StartupX', sector:'SaaS / Tech', size:'1-10', website:'startupx.fr', city:'Nantes', revenue:'<1M€', score:45, contacts:1, deals:0, status:'target' },
  { id:'5', name:'RetailPro', sector:'Retail', size:'51-200', website:'retailpro.fr', city:'Paris', revenue:'10-50M€', score:68, contacts:2, deals:1, status:'engaged' },
];

const STATUS_CONFIG: Record<string,{label:string;color:string}> = {
  target:   { label:'Cible',    color:'bg-blue-50 text-blue-600' },
  engaged:  { label:'Engagé',   color:'bg-amber-50 text-amber-600' },
  customer: { label:'Client',   color:'bg-green-50 text-green-600' },
  lost:     { label:'Perdu',    color:'bg-red-50 text-red-400' },
};

function AddAccountModal({ onClose, onSave, apiUrl }: any) {
  const [form, setForm] = useState({ name:'', sector:'SaaS / Tech', size:'11-50', website:'', city:'', revenue:'1-5M€' });
  const [saving, setSaving] = useState(false);
  const set = (k:string,v:string) => setForm(f=>({...f,[k]:v}));

  const save = async () => {
    if (!form.name) return;
    setSaving(true);
    await new Promise(r=>setTimeout(r,600));
    onSave({ ...form, id:Date.now().toString(), score:50, contacts:0, deals:0, status:'target' });
    onClose();
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Ajouter un compte cible</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400"/></button>
        </div>
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nom de l'entreprise *</label>
            <input value={form.name} onChange={e=>set('name',e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Ex: Acme Corp"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Secteur</label>
              <select value={form.sector} onChange={e=>set('sector',e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                {SECTORS.filter(s=>s!=='Tous').map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Taille</label>
              <select value={form.size} onChange={e=>set('size',e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                {SIZES.filter(s=>s!=='Tous').map(s=><option key={s}>{s} emp.</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Site web</label>
              <input value={form.website} onChange={e=>set('website',e.target.value)} placeholder="example.fr" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Ville</label>
              <input value={form.city} onChange={e=>set('city',e.target.value)} placeholder="Paris" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">CA estimé</label>
            <select value={form.revenue} onChange={e=>set('revenue',e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
              {['<1M€','1-5M€','5-10M€','10-50M€','50M+'].map(r=><option key={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Annuler</button>
          <button onClick={save} disabled={!form.name||saving} className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
            {saving?<Loader2 className="w-4 h-4 animate-spin"/>:<Target className="w-4 h-4"/>}Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ABMPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState(MOCK_ACCOUNTS);
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('Tous');
  const [size, setSize] = useState('Tous');
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<string|null>(null);

  const showToast = (msg:string) => { setToast(msg); setTimeout(()=>setToast(null),3000); };

  const filtered = accounts.filter(a => {
    const ms = !search||`${a.name} ${a.city} ${a.website}`.toLowerCase().includes(search.toLowerCase());
    const mse = sector==='Tous'||a.sector===sector;
    const msz = size==='Tous'||a.size.startsWith(size);
    return ms&&mse&&msz;
  });

  const byStatus = Object.keys(STATUS_CONFIG).reduce((acc,s) => ({ ...acc, [s]:accounts.filter(a=>a.status===s).length }),{} as Record<string,number>);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {toast && <div className="fixed top-6 right-6 z-50 bg-teal-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4"/>{toast}</div>}
      {showAdd && <AddAccountModal apiUrl={''} onClose={()=>setShowAdd(false)} onSave={(a:any)=>{setAccounts(prev=>[...prev,a]);showToast(`${a.name} ajouté ✓`);}}/>}

      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">ABM / Account-Based Marketing</h1>
          <p className="text-sm text-gray-400">Gérez vos comptes cibles et votre Total Addressable Market</p></div>
        <button onClick={()=>setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700">
          <Plus className="w-4 h-4"/>Ajouter un compte
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {Object.entries(STATUS_CONFIG).map(([key,cfg])=>(
          <div key={key} className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className={`text-2xl font-bold mb-1 ${cfg.color.split(' ')[1]}`}>{byStatus[key]||0}</div>
            <div className="text-sm text-gray-400">{cfg.label}s</div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
              <div className={`h-1.5 rounded-full ${key==='customer'?'bg-green-500':key==='engaged'?'bg-amber-500':key==='target'?'bg-blue-500':'bg-red-400'}`} style={{width:`${accounts.length>0?((byStatus[key]||0)/accounts.length*100):0}%`}}/>
            </div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher..." className="w-full pl-10 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
        </div>
        <div className="flex gap-2 flex-wrap">
          {SECTORS.map(s=><button key={s} onClick={()=>setSector(s)} className={`px-3 py-2 rounded-xl text-sm font-medium ${sector===s?'bg-teal-600 text-white':'bg-white border border-gray-200 text-gray-500 hover:border-teal-300'}`}>{s}</button>)}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>{['Entreprise','Secteur','Taille','CA','Contacts','Deals','Score','Statut',''].map(h=><th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(acc=>{
              const s = STATUS_CONFIG[acc.status]||STATUS_CONFIG.target;
              return (
                <tr key={acc.id} className="hover:bg-gray-50 cursor-pointer" onClick={()=>router.push(`/prospects?company=${acc.name}`)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600 text-sm font-bold">{acc.name[0]}</div>
                      <div>
                        <div className="font-medium text-gray-900 text-sm">{acc.name}</div>
                        <div className="text-xs text-gray-400">{acc.city}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{acc.sector}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{acc.size}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{acc.revenue}</td>
                  <td className="px-4 py-3"><span className="text-sm font-medium text-blue-600">{acc.contacts}</span></td>
                  <td className="px-4 py-3"><span className="text-sm font-medium text-green-600">{acc.deals}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-12 bg-gray-100 rounded-full h-1.5"><div className={`h-1.5 rounded-full ${acc.score>=80?'bg-green-500':acc.score>=50?'bg-amber-500':'bg-gray-400'}`} style={{width:`${acc.score}%`}}/></div>
                      <span className="text-xs font-bold text-gray-700">{acc.score}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full font-medium ${s.color}`}>{s.label}</span></td>
                  <td className="px-4 py-3" onClick={e=>e.stopPropagation()}>
                    <div className="flex gap-1">
                      <button onClick={()=>showToast(`Prospecter ${acc.name}`)} className="p-1.5 text-gray-300 hover:text-teal-600 hover:bg-teal-50 rounded-lg"><Users className="w-4 h-4"/></button>
                      <button className="p-1.5 text-gray-300 hover:text-gray-500"><ChevronRight className="w-4 h-4"/></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length===0&&<tr><td colSpan={9} className="text-center py-12 text-gray-400">Aucun compte trouvé</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
