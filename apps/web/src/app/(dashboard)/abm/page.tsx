'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Target, Plus, Building2, Users, Search, Loader2, ChevronRight, CheckCircle, X, Save, Trash2, Globe, AlertCircle } from 'lucide-react';

const SECTORS=['SaaS / Tech','Industrie','Retail','Services','Finance','Santé','Construction'];

function AccountModal({ account, onClose, onSave, onDelete }: any) {
  const isNew = !account?.id;
  const [form, setForm] = useState(account || { name:'', sector:'SaaS / Tech', size:'11-50', website:'', city:'', revenue:'1-5M€', status:'target' });
  const [saving, setSaving] = useState(false);
  const set = (k:string,v:string) => setForm((f:any)=>({...f,[k]:v}));

  const save = async () => {
    if (!form.name) return;
    setSaving(true);
    await new Promise(r=>setTimeout(r,500));
    onSave({ ...form, id:form.id||Date.now().toString(), score:form.score||50, contacts:form.contacts||0, deals:form.deals||0 });
    onClose(); setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl" style={{background:'var(--card-bg)'}}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold" style={{color:'var(--text-primary)'}}>{isNew?'Nouveau compte cible':'Modifier le compte'}</h2>
          <button onClick={onClose} style={{color:'var(--text-muted)'}}><X className="w-5 h-5"/></button>
        </div>
        <div className="space-y-3 mb-4">
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-muted)'}}>Entreprise *</label>
            <input value={form.name} onChange={e=>set('name',e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none" style={{borderColor:'var(--card-border)',background:'var(--body-bg)',color:'var(--text-primary)'}}/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-muted)'}}>Secteur</label>
              <select value={form.sector} onChange={e=>set('sector',e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" style={{borderColor:'var(--card-border)',background:'var(--body-bg)',color:'var(--text-primary)'}}>
                {SECTORS.map(s=><option key={s}>{s}</option>)}</select></div>
            <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-muted)'}}>Statut</label>
              <select value={form.status} onChange={e=>set('status',e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" style={{borderColor:'var(--card-border)',background:'var(--body-bg)',color:'var(--text-primary)'}}>
                {['target','engaged','customer','lost'].map(s=><option key={s}>{s}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-muted)'}}>Site web</label>
              <input value={form.website} onChange={e=>set('website',e.target.value)} placeholder="example.fr" className="w-full px-3 py-2 border rounded-xl text-sm" style={{borderColor:'var(--card-border)',background:'var(--body-bg)',color:'var(--text-primary)'}}/></div>
            <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-muted)'}}>Ville</label>
              <input value={form.city} onChange={e=>set('city',e.target.value)} placeholder="Paris" className="w-full px-3 py-2 border rounded-xl text-sm" style={{borderColor:'var(--card-border)',background:'var(--body-bg)',color:'var(--text-primary)'}}/></div>
          </div>
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-muted)'}}>CA estimé</label>
            <select value={form.revenue} onChange={e=>set('revenue',e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" style={{borderColor:'var(--card-border)',background:'var(--body-bg)',color:'var(--text-primary)'}}>
              {['<1M€','1-5M€','5-10M€','10-50M€','50M+'].map(r=><option key={r}>{r}</option>)}</select></div>
        </div>
        <div className="flex gap-3">
          {!isNew&&<button onClick={()=>{onDelete(account.id);onClose();}} className="px-4 py-2.5 bg-red-50 text-red-500 rounded-xl text-sm"><Trash2 className="w-4 h-4 inline mr-1"/>Supprimer</button>}
          <button onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm" style={{borderColor:'var(--card-border)',color:'var(--text-secondary)'}}>Annuler</button>
          <button onClick={save} disabled={saving||!form.name} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white" style={{background:'var(--color-primary)'}}>
            {saving?<Loader2 className="w-4 h-4 animate-spin inline"/>:isNew?'Ajouter':'Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  );
}

const STATUS_CFG: Record<string,{l:string;c:string}> = {
  target:{l:'Cible',c:'bg-blue-50 text-blue-600'}, engaged:{l:'Engagé',c:'bg-amber-50 text-amber-600'},
  customer:{l:'Client',c:'bg-green-50 text-green-600'}, lost:{l:'Perdu',c:'bg-red-50 text-red-400'},
};
const MOCK = [
  {id:'1',name:'Acme Corp',sector:'SaaS / Tech',size:'51-200',website:'acmecorp.fr',city:'Paris',revenue:'5-10M€',score:87,contacts:3,deals:1,status:'target'},
  {id:'2',name:'TechVision',sector:'SaaS / Tech',size:'11-50',website:'techvision.io',city:'Lyon',revenue:'1-5M€',score:74,contacts:1,deals:0,status:'engaged'},
  {id:'3',name:'BigCorp',sector:'Industrie',size:'201-500',website:'bigcorp.fr',city:'Bordeaux',revenue:'50M+',score:92,contacts:5,deals:2,status:'customer'},
];

export default function ABMPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState(MOCK);
  const [selected, setSelected] = useState<any>(null);
  const [showNew, setShowNew] = useState(searchParams.get('new')==='1');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<string|null>(null);

  const showToast=(msg:string)=>{setToast(msg);setTimeout(()=>setToast(null),3000);};

  const filtered = accounts.filter(a=>!search||`${a.name} ${a.city} ${a.sector}`.toLowerCase().includes(search.toLowerCase()));
  const byStatus = Object.keys(STATUS_CFG).reduce((acc,s)=>({...acc,[s]:accounts.filter(a=>a.status===s).length}),{} as Record<string,number>);

  return (
    <div className="min-h-screen p-6" style={{background:'var(--body-bg)'}}>
      {toast&&<div className="fixed top-6 right-6 z-50 text-white px-4 py-3 rounded-xl shadow-lg text-sm" style={{background:'var(--color-primary)'}}>{toast}</div>}
      {(showNew||selected)&&<AccountModal account={selected||null} onClose={()=>{setShowNew(false);setSelected(null);}}
        onSave={(a:any)=>{setAccounts(prev=>{const i=prev.findIndex(x=>x.id===a.id);if(i>=0){const n=[...prev];n[i]=a;return n;}return[a,...prev];});showToast(selected?'Compte mis à jour ✓':'Compte ajouté ✓');}}
        onDelete={(id:string)=>{setAccounts(p=>p.filter(x=>x.id!==id));showToast('Compte supprimé');}}/>}

      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>ABM / Account-Based Marketing</h1>
          <p className="text-sm" style={{color:'var(--text-muted)'}}>Cliquez sur un compte pour modifier · {accounts.length} comptes ciblés</p></div>
        <button onClick={()=>setShowNew(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{background:'var(--color-primary)'}}>
          <Plus className="w-4 h-4"/>Ajouter un compte
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {Object.entries(STATUS_CFG).map(([key,cfg])=>(
          <div key={key} className="rounded-2xl border p-4" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
            <div className="text-2xl font-bold mb-1" style={{color:'var(--color-primary)'}}>{byStatus[key]||0}</div>
            <div className="text-sm" style={{color:'var(--text-muted)'}}>{cfg.l}s</div>
          </div>
        ))}
      </div>

      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{color:'var(--text-muted)'}}/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={{background:'var(--card-bg)',borderColor:'var(--card-border)',color:'var(--text-primary)'}}/>
      </div>

      <div className="rounded-2xl border overflow-hidden" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
        <table className="w-full">
          <thead style={{background:'var(--body-bg)',borderBottom:'1px solid var(--card-border)'}}>
            <tr>{['Entreprise','Secteur','CA','Contacts','Deals','Score','Statut',''].map(h=><th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{color:'var(--text-muted)'}}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.map(acc=>{
              const s=STATUS_CFG[acc.status]||STATUS_CFG.target;
              return (
                <tr key={acc.id} className="cursor-pointer transition-all" onClick={()=>setSelected(acc)}
                  style={{borderBottom:'1px solid var(--card-border)'}}
                  onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='var(--body-bg)'}
                  onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                  <td className="px-4 py-3"><div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{background:'var(--color-primary)'}}>{acc.name[0]}</div>
                    <div><div className="text-sm font-medium" style={{color:'var(--text-primary)'}}>{acc.name}</div><div className="text-xs" style={{color:'var(--text-muted)'}}>{acc.city}</div></div>
                  </div></td>
                  <td className="px-4 py-3 text-sm" style={{color:'var(--text-secondary)'}}>{acc.sector}</td>
                  <td className="px-4 py-3 text-sm" style={{color:'var(--text-secondary)'}}>{acc.revenue}</td>
                  <td className="px-4 py-3 text-sm font-medium text-blue-600">{acc.contacts}</td>
                  <td className="px-4 py-3 text-sm font-medium text-green-600">{acc.deals}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-12 rounded-full h-1.5" style={{background:'var(--card-border)'}}><div className="h-1.5 rounded-full" style={{width:`${acc.score}%`,background:'var(--color-primary)'}}/></div>
                      <span className="text-xs font-bold" style={{color:'var(--text-primary)'}}>{acc.score}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full font-medium ${s.c}`}>{s.l}</span></td>
                  <td className="px-4 py-3"><ChevronRight className="w-4 h-4" style={{color:'var(--text-muted)'}}/></td>
                </tr>
              );
            })}
            {filtered.length===0&&<tr><td colSpan={8} className="text-center py-12" style={{color:'var(--text-muted)'}}>Aucun compte</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
