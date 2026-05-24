'use client';

import { useState } from 'react';
import {
  Zap, TrendingUp, Globe, Linkedin, Twitter,
  Bell, Filter, RefreshCw, ExternalLink, Clock,
  Building2, ChevronRight, Star, AlertCircle, CheckCircle
} from 'lucide-react';

interface Signal {
  id: string;
  type: 'funding' | 'hiring' | 'news' | 'social' | 'technology' | 'intent';
  company: string;
  title: string;
  description: string;
  time: string;
  score: number;
  url?: string;
  isRead?: boolean;
  isStarred?: boolean;
}

const SIGNAL_CONFIG = {
  funding:    { label:'Levée de fonds', color:'text-green-600',  bg:'bg-green-50',   icon:<TrendingUp className="w-4 h-4" /> },
  hiring:     { label:'Recrutement',    color:'text-blue-600',   bg:'bg-blue-50',    icon:<Building2 className="w-4 h-4" /> },
  news:       { label:'Actualité',      color:'text-gray-600',   bg:'bg-gray-100',   icon:<Globe className="w-4 h-4" /> },
  social:     { label:'Social',         color:'text-purple-600', bg:'bg-purple-50',  icon:<Twitter className="w-4 h-4" /> },
  technology: { label:'Technologie',    color:'text-orange-600', bg:'bg-orange-50',  icon:<Zap className="w-4 h-4" /> },
  intent:     { label:'Intent signal',  color:'text-red-600',    bg:'bg-red-50',     icon:<Bell className="w-4 h-4" /> },
};

const MOCK_SIGNALS: Signal[] = [
  { id:'1', type:'funding', company:'TechVision', title:'Série A de 5M€ clôturée', description:'TechVision vient de clôturer une levée de fonds Série A de 5 millions d\'euros pour accélérer son développement commercial.', time:'il y a 2h', score:92, isRead:false, isStarred:true },
  { id:'2', type:'hiring', company:'Acme Corp', title:'3 postes commercial ouverts', description:'Acme Corp recrute activement 3 commerciaux B2B, signal fort d\'une expansion de leur force de vente.', time:'il y a 4h', score:78, isRead:false },
  { id:'3', type:'intent', company:'StartupX', title:'Recherches CRM détectées', description:'Des recherches intensives sur les solutions CRM et prospection B2B ont été détectées pour ce compte.', time:'il y a 6h', score:85, isRead:false },
  { id:'4', type:'news', company:'BigCorp', title:'Nouveau directeur commercial nommé', description:'BigCorp annonce la nomination d\'un nouveau VP Sales venant de Salesforce — opportunité de repositionnement.', time:'hier', score:71, isRead:true },
  { id:'5', type:'technology', company:'GrowthCo', title:'Migration vers HubSpot détectée', description:'GrowthCo semble migrer depuis Pipedrive vers HubSpot, identifié via les offres d\'emploi.', time:'hier', score:65, isRead:true },
  { id:'6', type:'social', company:'Agency FR', title:'Post LinkedIn sur la croissance', description:'Le CEO d\'Agency FR a publié un post sur leur objectif de doubler le CA d\'ici fin 2026.', time:'il y a 2j', score:58, isRead:true },
];

export default function SignauxPage() {
  const [signals, setSignals] = useState<Signal[]>(MOCK_SIGNALS);
  const [typeFilter, setTypeFilter] = useState('all');
  const [showUnread, setShowUnread] = useState(false);

  const toggleStar = (id: string) => setSignals(s => s.map(sig => sig.id === id ? {...sig, isStarred: !sig.isStarred} : sig));
  const markRead = (id: string) => setSignals(s => s.map(sig => sig.id === id ? {...sig, isRead: true} : sig));

  const filtered = signals.filter(s => {
    const matchType = typeFilter === 'all' || s.type === typeFilter;
    const matchUnread = !showUnread || !s.isRead;
    return matchType && matchUnread;
  });

  const unreadCount = signals.filter(s => !s.isRead).length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Signaux & Intentions</h1>
          <p className="text-sm text-gray-400 mt-0.5">{unreadCount} nouveaux signaux · Mis à jour automatiquement</p>
        </div>
        <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-500">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={() => setShowUnread(!showUnread)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
            showUnread ? 'bg-teal-600 text-white' : 'bg-white text-gray-500 border border-gray-200'
          }`}
        >
          <Bell className="w-4 h-4" />
          Non lus ({unreadCount})
        </button>
        {['all', ...Object.keys(SIGNAL_CONFIG)].map(t => {
          const cfg = SIGNAL_CONFIG[t as keyof typeof SIGNAL_CONFIG];
          return (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                typeFilter === t ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 border border-gray-200'
              }`}>
              {cfg && <span className={cfg.color}>{cfg.icon}</span>}
              {t === 'all' ? 'Tous' : cfg?.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {filtered.map(signal => {
          const cfg = SIGNAL_CONFIG[signal.type];
          return (
            <div
              key={signal.id}
              className={`bg-white rounded-2xl border p-5 transition-all hover:shadow-md ${
                !signal.isRead ? 'border-teal-200 shadow-sm' : 'border-gray-200'
              }`}
              onClick={() => markRead(signal.id)}
            >
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.color} ${cfg.bg}`}>
                      {cfg.label}
                    </span>
                    <span className="text-sm font-semibold text-gray-700">{signal.company}</span>
                    {!signal.isRead && (
                      <span className="w-2 h-2 rounded-full bg-teal-500" />
                    )}
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">{signal.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{signal.description}</p>
                  <div className="flex items-center gap-4 mt-3">
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3" /> {signal.time}
                    </span>
                    {signal.url && (
                      <a href={signal.url} target="_blank" className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700">
                        <ExternalLink className="w-3 h-3" /> Source
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <div className={`text-sm font-bold px-2.5 py-1 rounded-xl ${
                    signal.score >= 80 ? 'bg-green-50 text-green-600' :
                    signal.score >= 60 ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {signal.score}
                  </div>
                  <button onClick={e => { e.stopPropagation(); toggleStar(signal.id); }} className="text-gray-300 hover:text-amber-400 transition-colors">
                    <Star className={`w-4 h-4 ${signal.isStarred ? 'text-amber-400 fill-amber-400' : ''}`} />
                  </button>
                  <button className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 bg-teal-50 px-2 py-1 rounded-lg">
                    Contacter <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
