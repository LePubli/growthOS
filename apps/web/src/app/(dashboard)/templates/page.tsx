'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Mail, Copy, Edit2, Trash2, Search, CheckCircle, X, Save, Loader2, Tag } from 'lucide-react';

const CATEGORIES = ['Tous','Prospection','Relance','Post-démo','Nurturing','Closing','Onboarding'];

const INITIAL_TEMPLATES = [
  { id:'1', name:'Premier contact B2B', category:'Prospection', subject:'{{firstName}}, une question rapide', body:'Bonjour {{firstName}},\n\nJe travaille avec des entreprises comme {{company}} pour améliorer leur prospection commerciale.\n\nPuis-je vous montrer comment en 15 minutes ?\n\n{{sender}}', usedIn:3, tags:['B2B','Cold'] },
  { id:'2', name:'Relance J+3', category:'Relance', subject:'Suite à mon précédent message', body:'Bonjour {{firstName}},\n\nJe reviens vers vous suite à mon précédent message.\n\nAvez-vous eu le temps d\'y jeter un œil ?\n\n{{sender}}', usedIn:7, tags:['Relance'] },
  { id:'3', name:'Suivi post-démo', category:'Post-démo', subject:'Merci pour la démo, {{firstName}}', body:'Bonjour {{firstName}},\n\nMerci pour le temps que vous avez consacré à notre démonstration.\n\nComme convenu, voici les informations complémentaires...\n\n{{sender}}', usedIn:2, tags:['Post-démo','Warm'] },
  { id:'4', name:'Proposition de valeur', category:'Prospection', subject:'Comment {{company}} peut gagner X heures/semaine', body:'Bonjour {{firstName}},\n\nEn analysant le profil de {{company}}, j\'ai identifié 3 opportunités d\'optimisation...\n\n{{sender}}', usedIn:5, tags:['Personnalisé','Valeur'] },
  { id:'5', name:'Closing final', category:'Closing', subject:'Dernière question, {{firstName}}', body:'Bonjour {{firstName}},\n\nJe voulais vous recontacter une dernière fois.\n\nSi ce n\'est pas le bon moment, je comprends tout à fait — mais si vous êtes prêt(e) à avancer, je suis disponible cette semaine.\n\n{{sender}}', usedIn:1, tags:['Closing','Urgence'] },
  { id:'6', name:'Onboarding nouveau client', category:'Onboarding', subject:'Bienvenue chez nous, {{firstName}} !', body:'Bonjour {{firstName}},\n\nBienvenue ! Voici comment démarrer en 3 étapes...\n\n1. ...\n2. ...\n3. ...\n\n{{sender}}', usedIn:0, tags:['Onboarding','Client'] },
];

function EditModal({ template, onClose, onSave }: { template:any; onClose:()=>void; onSave:(t:any)=>void }) {
  const [form, setForm] = useState({ ...template });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await new Promise(r=>setTimeout(r,500));
    onSave(form);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">{form.id?'Modifier':'Nouveau'} template</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400"/></button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nom du template</label>
              <input value={form.name} onChange={e=>setForm((f:any)=>({...f,name:e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Catégorie</label>
              <select value={form.category} onChange={e=>setForm((f:any)=>({...f,category:e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                {CATEGORIES.filter(c=>c!=='Tous').map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Objet de l'email</label>
            <input value={form.subject} onChange={e=>setForm((f:any)=>({...f,subject:e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Corps</label>
            <p className="text-xs text-gray-400 mb-1">Variables disponibles: {'{{firstName}}'} {'{{lastName}}'} {'{{company}}'} {'{{sender}}'}</p>
            <textarea value={form.body} onChange={e=>setForm((f:any)=>({...f,body:e.target.value}))} rows={10} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"/>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Annuler</button>
          <button onClick={save} disabled={saving||!form.name} className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
            {saving?<Loader2 className="w-4 h-4 animate-spin"/>:<Save className="w-4 h-4"/>}Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState(INITIAL_TEMPLATES);
  const [category, setCategory] = useState('Tous');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [copied, setCopied] = useState<string|null>(null);
  const [preview, setPreview] = useState<any>(null);

  const filtered = templates.filter(t => {
    const mc = category==='Tous'||t.category===category;
    const ms = !search||`${t.name} ${t.subject} ${t.body}`.toLowerCase().includes(search.toLowerCase());
    return mc && ms;
  });

  const copy = (id:string, text:string) => { navigator.clipboard.writeText(text); setCopied(id); setTimeout(()=>setCopied(null),2000); };
  const del = (id:string) => setTemplates(t=>t.filter(x=>x.id!==id));
  const saveTemplate = (t:any) => {
    if (t.id) setTemplates(ts=>ts.map(x=>x.id===t.id?t:x));
    else setTemplates(ts=>[...ts,{...t,id:Date.now().toString(),usedIn:0,tags:[]}]);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {editing && <EditModal template={editing} onClose={()=>setEditing(null)} onSave={saveTemplate}/>}

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">{preview.name}</h2>
              <button onClick={()=>setPreview(null)}><X className="w-5 h-5 text-gray-400"/></button>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <div className="text-xs font-medium text-gray-500 mb-1">Objet</div>
              <div className="text-sm font-medium text-gray-900">{preview.subject}</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-xs font-medium text-gray-500 mb-2">Corps</div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">{preview.body}</div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={()=>copy(preview.id,`Objet: ${preview.subject}\n\n${preview.body}`)} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-50 text-gray-600 rounded-xl text-sm">
                {copied===preview.id?<CheckCircle className="w-4 h-4 text-teal-600"/>:<Copy className="w-4 h-4"/>}Copier
              </button>
              <button onClick={()=>{setPreview(null);setEditing(preview);}} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium">
                <Edit2 className="w-4 h-4"/>Modifier
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Templates Email</h1>
          <p className="text-sm text-gray-400">{templates.length} templates · Réutilisables dans vos séquences</p>
        </div>
        <button onClick={()=>setEditing({name:'',category:'Prospection',subject:'',body:'',tags:[]})}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700">
          <Plus className="w-4 h-4"/>Nouveau template
        </button>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher..." className="w-full pl-10 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
        </div>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(cat=>(
            <button key={cat} onClick={()=>setCategory(cat)} className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${category===cat?'bg-teal-600 text-white':'bg-white border border-gray-200 text-gray-500 hover:border-teal-300'}`}>{cat}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(tpl=>(
          <div key={tpl.id} className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">{tpl.name}</h3>
                <span className="text-xs bg-teal-50 text-teal-600 px-2 py-0.5 rounded-full">{tpl.category}</span>
              </div>
              <div className="flex gap-1 ml-2">
                <button onClick={()=>copy(tpl.id,`Objet: ${tpl.subject}\n\n${tpl.body}`)} className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg">
                  {copied===tpl.id?<CheckCircle className="w-4 h-4 text-teal-600"/>:<Copy className="w-4 h-4"/>}
                </button>
                <button onClick={()=>setEditing(tpl)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4"/></button>
                <button onClick={()=>del(tpl.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
              </div>
            </div>
            <div className="text-xs text-gray-500 mb-2 font-medium truncate">📧 {tpl.subject}</div>
            <div className="text-xs text-gray-400 mb-3 line-clamp-3 leading-relaxed">{tpl.body}</div>
            <div className="flex items-center justify-between">
              <div className="flex gap-1 flex-wrap">
                {(tpl.tags||[]).slice(0,2).map((tag:string)=><span key={tag} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{tag}</span>)}
              </div>
              <button onClick={()=>setPreview(tpl)} className="text-xs text-teal-600 hover:underline">Aperçu →</button>
            </div>
            {tpl.usedIn>0&&<div className="mt-2 text-xs text-gray-400">Utilisé dans {tpl.usedIn} séquence{tpl.usedIn>1?'s':''}</div>}
          </div>
        ))}
        {filtered.length===0&&(
          <div className="col-span-3 text-center py-16">
            <Mail className="w-10 h-10 text-gray-200 mx-auto mb-3"/>
            <p className="text-gray-400">Aucun template</p>
            <button onClick={()=>setEditing({name:'',category:'Prospection',subject:'',body:'',tags:[]})} className="mt-3 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm">Créer le premier</button>
          </div>
        )}
      </div>
    </div>
  );
}
