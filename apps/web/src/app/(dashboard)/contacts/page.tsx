'use client';
import { User, Search, Mail, Phone, Globe, Building2, Star, Plus, RefreshCw } from 'lucide-react';
import { useState } from 'react';

const CONTACTS = [
  { id:'1', name:'Sophie Martin', role:'Directrice Générale', company:'Acme Corp', email:'s.martin@acmecorp.fr', phone:'+33 6 12 34 56 78', linkedin:'linkedin.com/in/sophie-martin', score:92, tags:['Décideur','Chaud'] },
  { id:'2', name:'Thomas Durand', role:'CTO', company:'TechVision', email:'t.durand@techvision.io', phone:'+33 6 98 76 54 32', linkedin:'linkedin.com/in/thomas-durand', score:78, tags:['Tech'] },
  { id:'3', name:'Pierre Moreau', role:'VP Sales', company:'BigCorp', email:'p.moreau@bigcorp.com', phone:'+33 6 11 22 33 44', linkedin:'linkedin.com/in/pierre-moreau', score:91, tags:['Enterprise'] },
];

export default function ContactsPage() {
  const [search, setSearch] = useState('');
  const filtered = CONTACTS.filter(c => !search || `${c.name} ${c.company} ${c.role}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contact Intelligence</h1>
          <p className="text-sm text-gray-400 mt-0.5">Données enrichies sur vos contacts clés</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium">
          <Plus className="w-4 h-4" /> Ajouter contact
        </button>
      </div>

      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un contact..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(contact => (
          <div key={contact.id} className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-all">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-teal-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                {contact.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900">{contact.name}</h3>
                <p className="text-sm text-gray-500">{contact.role}</p>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Building2 className="w-3 h-3" />{contact.company}
                </div>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${contact.score >= 80 ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                {contact.score}
              </span>
            </div>
            <div className="space-y-2 mb-4">
              <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-xs text-gray-500 hover:text-teal-600">
                <Mail className="w-3.5 h-3.5" />{contact.email}
              </a>
              <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-xs text-gray-500 hover:text-teal-600">
                <Phone className="w-3.5 h-3.5" />{contact.phone}
              </a>
              <a href={`https://${contact.linkedin}`} target="_blank" className="flex items-center gap-2 text-xs text-gray-500 hover:text-blue-600">
                <Globe className="w-3.5 h-3.5" />{contact.linkedin}
              </a>
            </div>
            <div className="flex flex-wrap gap-1">
              {contact.tags.map(t => <span key={t} className="text-xs bg-teal-50 text-teal-600 px-2 py-0.5 rounded-full">{t}</span>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
