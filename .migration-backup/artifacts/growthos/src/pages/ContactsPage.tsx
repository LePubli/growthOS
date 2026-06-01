import { useState } from 'react';
import { useLocation } from 'wouter';
import {
  Search, Plus, Mail, Phone, Linkedin, Globe, Building2,
  Star, Filter, X, User, Tag, ExternalLink, ChevronRight,
  Grid3X3, List,
} from 'lucide-react';
import { toast } from 'sonner';

const TAGS = ['Décideur','Technique','Finance','Marketing','Opérations','C-Suite','VP','Manager'];

const MOCK_CONTACTS = [
  { id:'1', firstName:'Sophie', lastName:'Martin', title:'Directrice Marketing', company:'TechCorp', email:'s.martin@techcorp.fr', phone:'+33 6 12 34 56 78', linkedin:'https://linkedin.com/in/sophiemartin', tags:['Décideur','Marketing'], starred:true, score:92, city:'Paris' },
  { id:'2', firstName:'Emma', lastName:'Leroy', title:'CEO', company:'StartupX', email:'e.leroy@startupx.io', phone:'+33 6 23 45 67 89', linkedin:'https://linkedin.com/in/emmaleroy', tags:['C-Suite'], starred:false, score:85, city:'Lyon' },
  { id:'3', firstName:'Paul', lastName:'Dupont', title:'VP Sales', company:'BigSales SAS', email:'p.dupont@bigsales.fr', phone:'+33 6 34 56 78 90', linkedin:'', tags:['VP','Décideur'], starred:true, score:78, city:'Bordeaux' },
  { id:'4', firstName:'Camille', lastName:'Bernard', title:'CTO', company:'DataInc', email:'c.bernard@datainc.com', phone:'', linkedin:'https://linkedin.com/in/camille-bernard', tags:['Technique','C-Suite'], starred:false, score:67, city:'Paris' },
  { id:'5', firstName:'Luc', lastName:'Moreau', title:'Directeur Général', company:'GrowthCo', email:'l.moreau@growthco.fr', phone:'+33 6 45 67 89 01', linkedin:'https://linkedin.com/in/lucmoreau', tags:['C-Suite','Décideur'], starred:true, score:95, city:'Nantes' },
  { id:'6', firstName:'Marie', lastName:'Dubois', title:'Responsable Achat', company:'AlphaTech', email:'m.dubois@alphatech.fr', phone:'+33 6 56 78 90 12', linkedin:'', tags:['Finance'], starred:false, score:55, city:'Marseille' },
  { id:'7', firstName:'Thomas', lastName:'Leclerc', title:'Directeur Commercial', company:'WebAgency', email:'t.leclerc@webagency.fr', phone:'+33 6 67 89 01 23', linkedin:'https://linkedin.com/in/thomasleclerc', tags:['Décideur','Manager'], starred:false, score:71, city:'Toulouse' },
  { id:'8', firstName:'Alice', lastName:'Fontaine', title:'Head of Growth', company:'InnovaTech', email:'a.fontaine@innovatech.io', phone:'+33 6 78 90 12 34', linkedin:'https://linkedin.com/in/alicefontaine', tags:['Marketing','Manager'], starred:true, score:88, city:'Paris' },
  { id:'9', firstName:'Marc', lastName:'Rousseau', title:'CFO', company:'FinancePlus', email:'m.rousseau@financeplus.fr', phone:'+33 6 89 01 23 45', linkedin:'https://linkedin.com/in/marc-rousseau', tags:['Finance','C-Suite'], starred:false, score:62, city:'Paris' },
  { id:'10', firstName:'Julie', lastName:'Simon', title:'Product Manager', company:'SaaScraft', email:'j.simon@saascraft.io', phone:'', linkedin:'https://linkedin.com/in/juliesim', tags:['Technique','Manager'], starred:false, score:44, city:'Rennes' },
  { id:'11', firstName:'Antoine', lastName:'Petit', title:'CEO', company:'ScaleUp', email:'a.petit@scaleup.fr', phone:'+33 6 01 23 45 67', linkedin:'https://linkedin.com/in/antoinepetit', tags:['C-Suite'], starred:false, score:79, city:'Strasbourg' },
  { id:'12', firstName:'Claire', lastName:'Girard', title:'Sales Director', company:'CloudWave', email:'c.girard@cloudwave.eu', phone:'+33 6 12 34 56 78', linkedin:'https://linkedin.com/in/clairegirard', tags:['Décideur','VP'], starred:true, score:91, city:'Lyon' },
];

function ContactCard({ c, onStar, onClick }: { c: typeof MOCK_CONTACTS[0]; onStar: (id:string)=>void; onClick:()=>void }) {
  const initials = `${c.firstName[0]}${c.lastName[0]}`;
  const colors = ['#0F766E','#2563EB','#7C3AED','#D97706','#059669','#DC2626'];
  const color = colors[(c.firstName.charCodeAt(0)+c.lastName.charCodeAt(0))%colors.length];

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
        {c.email && (
          <a href={`mailto:${c.email}`} onClick={e=>e.stopPropagation()} className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-700 truncate">
            <Mail className="w-3 h-3 flex-shrink-0"/><span className="truncate">{c.email}</span>
          </a>
        )}
        {c.phone && (
          <a href={`tel:${c.phone}`} onClick={e=>e.stopPropagation()} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600">
            <Phone className="w-3 h-3 flex-shrink-0"/>{c.phone}
          </a>
        )}
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

function ContactRow({ c, onStar, onClick }: { c: typeof MOCK_CONTACTS[0]; onStar:(id:string)=>void; onClick:()=>void }) {
  const initials = `${c.firstName[0]}${c.lastName[0]}`;
  const colors = ['#0F766E','#2563EB','#7C3AED','#D97706','#059669','#DC2626'];
  const color = colors[(c.firstName.charCodeAt(0)+c.lastName.charCodeAt(0))%colors.length];
  return (
    <div onClick={onClick} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-100 last:border-0">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0" style={{background:color}}>{initials}</div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-gray-900">{c.firstName} {c.lastName}</div>
        <div className="text-xs text-gray-400">{c.title} · {c.company}</div>
      </div>
      <div className="hidden sm:flex flex-col gap-0.5 min-w-0 flex-1">
        {c.email && <a href={`mailto:${c.email}`} onClick={e=>e.stopPropagation()} className="text-xs text-teal-600 truncate hover:text-teal-700">{c.email}</a>}
        {c.phone && <span className="text-xs text-gray-400">{c.phone}</span>}
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

function CreateContactModal({ onClose, onSave }: { onClose:()=>void; onSave:(c:any)=>void }) {
  const [form, setForm] = useState({ firstName:'', lastName:'', title:'', company:'', email:'', phone:'', linkedin:'', city:'', tags:[] as string[] });
  const s = (k:string,v:string) => setForm(f=>({...f,[k]:v}));
  const toggleTag = (t:string) => setForm(f=>({...f,tags:f.tags.includes(t)?f.tags.filter(x=>x!==t):[...f.tags,t]}));

  const save = () => {
    if (!form.firstName && !form.email) { toast.error('Prénom ou email requis'); return; }
    onSave({ ...form, id: Date.now().toString(), starred:false, score:0 });
    onClose();
    toast.success('Contact créé');
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
  const [contacts, setContacts] = useState(MOCK_CONTACTS);
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState('Tous');
  const [view, setView] = useState<'grid'|'list'>('grid');
  const [showCreate, setShowCreate] = useState(false);
  const [showStarredOnly, setShowStarredOnly] = useState(false);

  const allTags = ['Tous', ...TAGS];

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${c.firstName} ${c.lastName} ${c.company} ${c.title} ${c.email}`.toLowerCase().includes(q);
    const matchTag = selectedTag === 'Tous' || c.tags.includes(selectedTag);
    const matchStar = !showStarredOnly || c.starred;
    return matchSearch && matchTag && matchStar;
  });

  const toggleStar = (id: string) => {
    setContacts(cs => cs.map(c => c.id===id ? {...c, starred:!c.starred} : c));
  };

  const addContact = (c: any) => setContacts(cs => [c, ...cs]);

  const byCompany = filtered.reduce((acc, c) => { acc[c.company] = (acc[c.company]||0)+1; return acc; }, {} as Record<string,number>);
  const topCompanies = Object.entries(byCompany).sort((a,b)=>b[1]-a[1]).slice(0,3);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
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
          { label:'Score moyen', value:Math.round(contacts.reduce((s,c)=>s+c.score,0)/contacts.length), color:'bg-green-50 text-green-700' },
        ].map(s=>(
          <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className={`text-2xl font-bold mb-1 ${s.color.split(' ')[1]}`}>{s.value}</div>
            <div className="text-xs text-gray-400">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-6">
        {/* Sidebar filters */}
        <div className="w-48 flex-shrink-0 space-y-4">
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
                <ContactCard key={c.id} c={c} onStar={toggleStar} onClick={()=>navigate(`/prospects`)}/>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {filtered.map(c=>(
                <ContactRow key={c.id} c={c} onStar={toggleStar} onClick={()=>navigate(`/prospects`)}/>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
