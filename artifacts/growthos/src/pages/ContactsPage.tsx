import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import {
  Search, Plus, Mail, Phone, Linkedin, Globe, Building2,
  Star, Filter, X, User, Tag, ExternalLink, ChevronRight,
  Grid3X3, List,
} from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';

const TAGS = ['Décideur','Technique','Finance','Marketing','Opérations','C-Suite','VP','Manager'];

type Contact={id:string;prospectId:string;firstName:string;lastName:string;title:string;company:string;email:string;phone:string;emails:string[];phones:string[];linkedin:string;city:string;tags:string[];starred:boolean;score:number};

function ContactCard({ c, onStar, onClick }: { c: Contact; onStar: (id:string)=>void; onClick:()=>void }) {
  const initials = `${c.firstName[0]||''}${c.lastName[0]||''}`;
  const colors = ['#0F766E','#2563EB','#7C3AED','#D97706','#059669','#DC2626'];
  const color = colors[((c.firstName.charCodeAt(0)||0)+(c.lastName.charCodeAt(0)||0))%colors.length];

  return (
    <div onClick={onClick} className="bg-white rounded-2xl border border-gray-200 p-5 cursor-pointer hover:shadow-md hover:border-teal-200 transition-all group relative">
      <button onClick={e=>{e.stopPropagation();onStar(c.id);}} className="absolute top-4 right-4">
        <Star className={`w-4 h-4 transition-colors ${c.starred?'text-amber-400 fill-amber-400':'text-gray-200 group-hover:text-gray-300'}`}/>
      </button>

      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-base flex-shrink-0" style={{background:color}}>
          {initials}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-gray-900 text-sm truncate">{c.firstName} {c.lastName}</div>
          <div className="text-xs text-gray-400 truncate">{c.title}</div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mb-3 text-xs text-gray-500">
        <Building2 className="w-3.5 h-3.5 flex-shrink-0 text-gray-400"/>
        <span className="truncate font-medium">{c.company}</span>
        <span className="text-gray-300">·</span>
        <span className="text-gray-400">{c.city}</span>
      </div>

      <div className="space-y-1.5 mb-4">
        {c.emails.map(email=>(
          <a key={email} href={`mailto:${email}`} onClick={e=>e.stopPropagation()} className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-700 truncate">
            <Mail className="w-3 h-3 flex-shrink-0"/><span className="truncate">{email}</span>
          </a>
        ))}
        {c.phones.map(phone=>(
          <a key={phone} href={`tel:${phone}`} onClick={e=>e.stopPropagation()} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600">
            <Phone className="w-3 h-3 flex-shrink-0"/>{phone}
          </a>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {c.tags.slice(0,2).map(t=>(
            <span key={t} className="text-xs px-1.5 py-0.5 bg-teal-50 text-teal-700 rounded-md font-medium">{t}</span>
          ))}
          {c.tags.length>2 && <span className="text-xs text-gray-400">+{c.tags.length-2}</span>}
        </div>
        {c.linkedin && (
          <a href={c.linkedin} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className="text-blue-500 hover:text-blue-600">
            <Linkedin className="w-4 h-4"/>
          </a>
        )}
      </div>

      {c.score > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
            <div className={`h-1.5 rounded-full ${c.score>=80?'bg-green-500':c.score>=50?'bg-amber-500':'bg-gray-400'}`} style={{width:`${c.score}%`}}/>
          </div>
          <span className="text-xs font-bold text-gray-600">{c.score}</span>
        </div>
      )}
    </div>
  );
}

function ContactRow({ c, onStar, onClick }: { c: Contact; onStar:(id:string)=>void; onClick:()=>void }) {
  const initials = `${c.firstName[0]||''}${c.lastName[0]||''}`;
  const colors = ['#0F766E','#2563EB','#7C3AED','#D97706','#059669','#DC2626'];
  const color = colors[((c.firstName.charCodeAt(0)||0)+(c.lastName.charCodeAt(0)||0))%colors.length];
  return (
    <div onClick={onClick} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-100 last:border-0">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0" style={{background:color}}>{initials}</div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-gray-900">{c.firstName} {c.lastName}</div>
        <div className="text-xs text-gray-400">{c.title} · {c.company}</div>
      </div>
      <div className="hidden sm:flex flex-col gap-0.5 min-w-0 flex-1">
        {c.emails.map(email=><a key={email} href={`mailto:${email}`} onClick={e=>e.stopPropagation()} className="text-xs text-teal-600 truncate hover:text-teal-700">{email}</a>)}
        {c.phones.map(phone=><a key={phone} href={"tel:"+phone} onClick={e=>e.stopPropagation()} className="text-xs text-gray-400">{phone}</a>)}
      </div>
      <div className="hidden md:flex gap-1">
        {c.tags.slice(0,2).map(t=><span key={t} className="text-xs px-1.5 py-0.5 bg-teal-50 text-teal-700 rounded-md">{t}</span>)}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {c.linkedin && <a href={c.linkedin} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className="text-blue-400 hover:text-blue-600"><Linkedin className="w-3.5 h-3.5"/></a>}
        <button onClick={e=>{e.stopPropagation();onStar(c.id);}}><Star className={`w-4 h-4 ${c.starred?'text-amber-400 fill-amber-400':'text-gray-200 hover:text-amber-300'}`}/></button>
        <ChevronRight className="w-4 h-4 text-gray-300"/>
      </div>
    </div>
  );
}

function CreateContactModal({ onClose, onSave }: { onClose:()=>void; onSave:(c:any)=>Promise<void> }) {
  const [form, setForm] = useState({ firstName:'', lastName:'', title:'', company:'', email:'', phone:'', linkedin:'', city:'', tags:[] as string[] });
  const s = (k:string,v:string) => setForm(f=>({...f,[k]:v}));
  const toggleTag = (t:string) => setForm(f=>({...f,tags:f.tags.includes(t)?f.tags.filter(x=>x!==t):[...f.tags,t]}));

  const save = async () => {
    if (!form.firstName && !form.email) { toast.error('Prénom ou email requis'); return; }
    try { await onSave(form); onClose(); toast.success('Contact enregistré dans le CRM'); }
    catch { toast.error('Le contact n’a pas été enregistré'); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Nouveau contact</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400"/></button>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[{k:'firstName',l:'Prénom *'},{k:'lastName',l:'Nom'},{k:'title',l:'Poste'},{k:'company',l:'Entreprise'},{k:'email',l:'Email'},{k:'phone',l:'Téléphone'},{k:'city',l:'Ville'}].map(f=>(
            <div key={f.k} className={['email','linkedin'].includes(f.k)?'col-span-2':''}>
              <label className="block text-xs font-medium text-gray-500 mb-1">{f.l}</label>
              <input value={(form as any)[f.k]} onChange={e=>s(f.k,e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
            </div>
          ))}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">LinkedIn URL</label>
            <input value={form.linkedin} onChange={e=>s('linkedin',e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="https://linkedin.com/in/..."/>
          </div>
        </div>
        <div className="mb-5">
          <label className="block text-xs font-medium text-gray-500 mb-2">Tags</label>
          <div className="flex flex-wrap gap-1.5">
            {TAGS.map(t=>(
              <button key={t} onClick={()=>toggleTag(t)}
                className={`px-2.5 py-1 rounded-xl text-xs font-medium border transition-all ${form.tags.includes(t)?'bg-teal-600 text-white border-teal-600':'bg-white text-gray-500 border-gray-200 hover:border-teal-300'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Annuler</button>
          <button onClick={save} className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium">Créer</button>
        </div>
      </div>
    </div>
  );
}

export default function ContactsPage() {
  const [, navigate] = useLocation();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState('Tous');
  const [view, setView] = useState<'grid'|'list'>('grid');
  const [showCreate, setShowCreate] = useState(false);
  const [showStarredOnly, setShowStarredOnly] = useState(false);

  const allTags = ['Tous','Décideur']; // Décideur est dérivé du rôle publié ; aucun tag marketing n’est inventé.

  const normalize = (p:any): Contact => ({
    id:p.id,prospectId:p.prospectId||p.id,firstName:p.name||[p.firstName,p.lastName].filter(Boolean).join(' '),lastName:'',
    title:p.role||p.jobTitle||'',company:p.company||'',email:p.email||'',phone:p.phone||'',
    emails:p.emails||[p.email].filter(Boolean),phones:p.phones||[p.phone].filter(Boolean),
    linkedin:/linkedin\.com/.test(p.profileUrl||'')?p.profileUrl:'',city:p.city||'',
    tags:p.isManager?['Décideur']:[],starred:!!p.isStarred,score:Number(p.score)||0,
  });
  useEffect(()=>{
    let active=true;
    const load=()=>apiClient.get('/contacts').then((d:any)=>{if(active){setContacts((d?.data||[]).map(normalize));setError('');}})
      .catch(()=>{if(active)setError('Impossible de charger les contacts réels.');})
      .finally(()=>{if(active)setLoading(false);});
    void load();window.addEventListener('focus',load);
    return()=>{active=false;window.removeEventListener('focus',load);};
  },[]);

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${c.firstName} ${c.lastName} ${c.company} ${c.title} ${c.email}`.toLowerCase().includes(q);
    const matchTag = selectedTag === 'Tous' || c.tags.includes(selectedTag);
    const matchStar = !showStarredOnly || c.starred;
    return matchSearch && matchTag && matchStar;
  });

  const toggleStar = async (id: string) => {
    const contact=contacts.find(c=>c.id===id);
    if (!contact) return;
    try {
      await apiClient.patch(`/prospects/${contact.prospectId}`, {isStarred:!contact.starred});
      setContacts(cs=>cs.map(c=>c.prospectId===contact.prospectId?{...c,starred:!contact.starred}:c));
    } catch { toast.error('Mise à jour du favori impossible'); }
  };

  const addContact = async (c:any) => {
    const saved:any = await apiClient.post('/prospects', {
      firstName:c.firstName, lastName:c.lastName, email:c.email, phone:c.phone,
      company:c.company, jobTitle:c.title,
    });
    setContacts(cs=>[normalize(saved),...cs]);
  };

  const byCompany = filtered.reduce((acc, c) => { acc[c.company] = (acc[c.company]||0)+1; return acc; }, {} as Record<string,number>);
  const topCompanies = Object.entries(byCompany).sort((a,b)=>b[1]-a[1]).slice(0,3);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      {showCreate && <CreateContactModal onClose={()=>setShowCreate(false)} onSave={addContact}/>}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-sm text-gray-400">{filtered.length} contact{filtered.length>1?'s':''} · {contacts.filter(c=>c.starred).length} favori{contacts.filter(c=>c.starred).length>1?'s':''}</p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1 p-1 bg-white border border-gray-200 rounded-xl">
            <button onClick={()=>setView('grid')} className={`p-1.5 rounded-lg transition-all ${view==='grid'?'bg-teal-600 text-white':'text-gray-400 hover:text-gray-600'}`}><Grid3X3 className="w-4 h-4"/></button>
            <button onClick={()=>setView('list')} className={`p-1.5 rounded-lg transition-all ${view==='list'?'bg-teal-600 text-white':'text-gray-400 hover:text-gray-600'}`}><List className="w-4 h-4"/></button>
          </div>
          <button onClick={()=>setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700">
            <Plus className="w-4 h-4"/>Nouveau contact
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label:'Total', value:contacts.length, color:'bg-blue-50 text-blue-600' },
          { label:'Décideurs', value:contacts.filter(c=>c.tags.includes('Décideur')).length, color:'bg-purple-50 text-purple-600' },
          { label:'C-Suite', value:contacts.filter(c=>c.tags.includes('C-Suite')).length, color:'bg-amber-50 text-amber-600' },
          { label:'Score moyen', value:contacts.length?Math.round(contacts.reduce((s,c)=>s+c.score,0)/contacts.length):'—', color:'bg-green-50 text-green-700' },
        ].map(s=>(
          <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className={`text-2xl font-bold mb-1 ${s.color.split(' ')[1]}`}>{s.value}</div>
            <div className="text-xs text-gray-400">{s.label}</div>
          </div>
        ))}
      </div>

      {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-red-700 text-sm">{error}</div>}
      {loading && <p className="mb-3 text-sm text-gray-500">Chargement des contacts…</p>}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar filters */}
        <div className="w-full lg:w-48 flex-shrink-0 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Filtrer par tag</div>
            <div className="space-y-1">
              {allTags.map(t=>(
                <button key={t} onClick={()=>setSelectedTag(t)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${selectedTag===t?'bg-teal-50 text-teal-700 font-medium':'text-gray-500 hover:bg-gray-50'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Options</div>
            <button onClick={()=>setShowStarredOnly(s=>!s)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${showStarredOnly?'bg-amber-50 text-amber-700 font-medium':'text-gray-500 hover:bg-gray-50'}`}>
              <Star className={`w-4 h-4 ${showStarredOnly?'fill-amber-400 text-amber-400':'text-gray-300'}`}/>
              Favoris seulement
            </button>
          </div>

          {topCompanies.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Top entreprises</div>
              <div className="space-y-2">
                {topCompanies.map(([co, n])=>(
                  <button key={co} onClick={()=>setSearch(co)}
                    className="w-full flex items-center justify-between text-xs text-gray-600 hover:text-teal-600 transition-colors">
                    <span className="truncate">{co}</span>
                    <span className="ml-2 text-gray-400 font-medium">{n}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Rechercher un contact, entreprise, email..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
            {search && <button onClick={()=>setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-gray-400"/></button>}
          </div>

          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 py-16 text-center">
              <User className="w-10 h-10 text-gray-200 mx-auto mb-3"/>
              <p className="text-gray-400 text-sm">Aucun contact trouvé</p>
              <button onClick={()=>setShowCreate(true)} className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm">+ Nouveau contact</button>
            </div>
          ) : view === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(c=>(
                <ContactCard key={c.id} c={c} onStar={toggleStar} onClick={()=>navigate(`/prospects/${c.prospectId}`)}/>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {filtered.map(c=>(
                <ContactRow key={c.id} c={c} onStar={toggleStar} onClick={()=>navigate(`/prospects/${c.prospectId}`)}/>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
