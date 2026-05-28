'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Save, Loader2, Camera, Mail, Phone, Globe, Building2, ArrowLeft, CheckCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

export default function SettingsProfilePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [form, setForm] = useState({ firstName:user?.firstName||'', lastName:user?.lastName||'', email:user?.email||'', phone:'', company:'Le Publicitaire', website:'https://le-publicitaire.fr', bio:'' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const set = (k:string,v:string) => setForm(f=>({...f,[k]:v}));

  const save = async () => {
    setSaving(true);
    await new Promise(r=>setTimeout(r,800));
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),3000);
  };

  return (
    <div className="min-h-screen p-6" style={{background:'var(--body-bg)'}}>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={()=>router.push('/settings')} className="p-2 rounded-xl hover:opacity-80" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)',color:'var(--text-secondary)'}}>
          <ArrowLeft className="w-5 h-5"/>
        </button>
        <div><h1 className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>Profil</h1></div>
      </div>
      <div className="max-w-2xl">
        <div className="rounded-2xl border p-6 mb-4" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
          <div className="flex items-center gap-5 mb-6 pb-6" style={{borderBottom:'1px solid var(--card-border)'}}>
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-3xl font-bold" style={{background:'var(--color-primary)'}}>{(form.firstName||'A')[0]}</div>
              <button className="absolute -bottom-1 -right-1 w-7 h-7 text-white rounded-full flex items-center justify-center" style={{background:'var(--color-primary)'}}><Camera className="w-3.5 h-3.5"/></button>
            </div>
            <div><h2 className="text-lg font-semibold" style={{color:'var(--text-primary)'}}>{form.firstName} {form.lastName}</h2>
              <p className="text-sm" style={{color:'var(--text-muted)'}}>{form.email}</p></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[{k:'firstName',l:'Prénom'},{k:'lastName',l:'Nom'},{k:'email',l:'Email'},{k:'phone',l:'Téléphone'},{k:'company',l:'Entreprise'},{k:'website',l:'Site web'}].map(f=>(
              <div key={f.k}><label className="block text-xs font-medium mb-1" style={{color:'var(--text-muted)'}}>{f.l}</label>
                <input value={(form as any)[f.k]} onChange={e=>set(f.k,e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none" style={{borderColor:'var(--card-border)',background:'var(--body-bg)',color:'var(--text-primary)'}}/></div>
            ))}
            <div className="col-span-2"><label className="block text-xs font-medium mb-1" style={{color:'var(--text-muted)'}}>Bio</label>
              <textarea value={form.bio} onChange={e=>set('bio',e.target.value)} rows={3} className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none resize-none" style={{borderColor:'var(--card-border)',background:'var(--body-bg)',color:'var(--text-primary)'}}/></div>
          </div>
        </div>
        <button onClick={save} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white" style={{background:'var(--color-primary)'}}>
          {saving?<Loader2 className="w-4 h-4 animate-spin"/>:saved?<><CheckCircle className="w-4 h-4"/>Sauvegardé ✓</>:<><Save className="w-4 h-4"/>Sauvegarder</>}
        </button>
      </div>
    </div>
  );
}
