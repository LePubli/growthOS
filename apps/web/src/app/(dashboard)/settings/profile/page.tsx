'use client';
import { useState } from 'react';
import { User, Save, Loader2, Camera, Mail, Phone, Globe, Building2 } from 'lucide-react';

export default function SettingsProfilePage() {
  const [form, setForm] = useState({ firstName:'Admin', lastName:'', email:'admin@le-publicitaire.fr', phone:'', company:'Le Publicitaire', website:'https://le-publicitaire.fr', bio:'' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({...f,[k]:v}));

  const save = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 800));
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Profil</h1>
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
        <div className="flex items-center gap-5 mb-6 pb-6 border-b border-gray-100">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-teal-600 flex items-center justify-center text-white text-3xl font-bold">{form.firstName[0]}</div>
            <button className="absolute -bottom-1 -right-1 w-7 h-7 bg-teal-600 text-white rounded-full flex items-center justify-center hover:bg-teal-700"><Camera className="w-3.5 h-3.5" /></button>
          </div>
          <div><h2 className="text-lg font-semibold text-gray-900">{form.firstName} {form.lastName}</h2><p className="text-sm text-gray-400">{form.email}</p><span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full mt-1 inline-block">Owner</span></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[{k:'firstName',l:'Prénom',icon:<User className="w-4 h-4"/>},{k:'lastName',l:'Nom',icon:<User className="w-4 h-4"/>},{k:'email',l:'Email',icon:<Mail className="w-4 h-4"/>},{k:'phone',l:'Téléphone',icon:<Phone className="w-4 h-4"/>},{k:'company',l:'Entreprise',icon:<Building2 className="w-4 h-4"/>},{k:'website',l:'Site web',icon:<Globe className="w-4 h-4"/>}].map(f => (
            <div key={f.k}>
              <label className="block text-xs font-medium text-gray-500 mb-1">{f.l}</label>
              <div className="relative"><div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{f.icon}</div>
              <input value={(form as any)[f.k]} onChange={e => set(f.k, e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
            </div>
          ))}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Bio</label>
            <textarea value={form.bio} onChange={e => set('bio', e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Décrivez votre activité..." />
          </div>
        </div>
      </div>
      <button onClick={save} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? '✓ Sauvegardé' : <><Save className="w-4 h-4" />Sauvegarder</>}
      </button>
    </div>
  );
}
