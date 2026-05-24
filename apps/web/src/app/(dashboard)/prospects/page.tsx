'use client';

import { useState, useEffect } from 'react';
import {
  Users, Search, Filter, Plus, Upload, Download,
  Mail, Phone, Globe, Building2, Star, StarOff,
  ChevronDown, MoreHorizontal, RefreshCw, X,
  CheckCircle, Circle, AlertCircle, Loader2, Tag, Zap
} from 'lucide-react';

interface Prospect {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  website?: string;
  linkedinUrl?: string;
  status?: string;
  score?: number;
  tags?: string[];
  isStarred?: boolean;
  createdAt?: string;
  lastContact?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  new:         { label: 'Nouveau',       color: 'text-gray-600',   bg: 'bg-gray-100' },
  contacted:   { label: 'Contacté',      color: 'text-blue-600',   bg: 'bg-blue-50' },
  qualified:   { label: 'Qualifié',      color: 'text-purple-600', bg: 'bg-purple-50' },
  negotiation: { label: 'Négociation',   color: 'text-amber-600',  bg: 'bg-amber-50' },
  won:         { label: 'Gagné',         color: 'text-green-600',  bg: 'bg-green-50' },
  lost:        { label: 'Perdu',         color: 'text-red-600',    bg: 'bg-red-50' },
};

const MOCK_PROSPECTS: Prospect[] = [
  { id:'1', firstName:'Sophie', lastName:'Martin', email:'s.martin@acmecorp.fr', company:'Acme Corp', jobTitle:'DG', status:'qualified', score:87, tags:['SaaS','Chaud'], isStarred:true, createdAt:'2026-05-20' },
  { id:'2', firstName:'Thomas', lastName:'Durand', email:'t.durand@techvision.io', company:'TechVision', jobTitle:'CTO', status:'contacted', score:72, tags:['Tech'], isStarred:false, createdAt:'2026-05-19' },
  { id:'3', firstName:'Marie', lastName:'Leroy', email:'m.leroy@startupx.fr', company:'StartupX', jobTitle:'CEO', status:'new', score:55, tags:['Startup'], isStarred:false, createdAt:'2026-05-18' },
  { id:'4', firstName:'Pierre', lastName:'Moreau', email:'p.moreau@bigcorp.com', company:'BigCorp', jobTitle:'VP Sales', status:'negotiation', score:91, tags:['Enterprise','Chaud'], isStarred:true, createdAt:'2026-05-17' },
  { id:'5', firstName:'Lucie', lastName:'Bernard', email:'l.bernard@growthco.fr', company:'GrowthCo', jobTitle:'CMO', status:'won', score:95, tags:['Marketing'], isStarred:false, createdAt:'2026-05-15' },
  { id:'6', firstName:'Antoine', lastName:'Petit', email:'a.petit@agency.fr', company:'Digital Agency', jobTitle:'Fondateur', status:'contacted', score:61, tags:['Agence'], isStarred:false, createdAt:'2026-05-14' },
];

function ScoreBadge({ score }: { score?: number }) {
  if (!score) return null;
  const color = score >= 80 ? 'text-green-600 bg-green-50' : score >= 60 ? 'text-amber-600 bg-amber-50' : 'text-red-500 bg-red-50';
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{score}</span>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const cfg = STATUS_CONFIG[status || 'new'] || STATUS_CONFIG.new;
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color} ${cfg.bg}`}>
      {cfg.label}
    </span>
  );
}

function Avatar({ firstName, lastName }: { firstName?: string; lastName?: string }) {
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '?';
  const colors = ['bg-blue-500','bg-purple-500','bg-teal-500','bg-orange-500','bg-pink-500','bg-indigo-500'];
  const color = colors[(firstName?.charCodeAt(0) || 0) % colors.length];
  return (
    <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
      {initials}
    </div>
  );
}

export default function ProspectsPage() {
  const [prospects, setProspects] = useState<Prospect[]>(MOCK_PROSPECTS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fetching, setFetching] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL || '';

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const fetchProspects = async () => {
    setFetching(true);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('access_token') || '';
      const res = await fetch(`${API}/api/v1/prospects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.data || data.prospects || [];
        if (list.length > 0) setProspects(list);
      }
    } catch { /* garder les mock */ }
    finally { setFetching(false); }
  };

  useEffect(() => { fetchProspects(); }, []);

  const toggleStar = (id: string) => {
    setProspects(p => p.map(pr => pr.id === id ? { ...pr, isStarred: !pr.isStarred } : pr));
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(p => p.id)));
  };

  const filtered = prospects.filter(p => {
    const matchSearch = !search ||
      `${p.firstName} ${p.lastName} ${p.email} ${p.company}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const starred = filtered.filter(p => p.isStarred).length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-teal-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />{toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prospects</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {prospects.length} prospects · {starred} favoris
          </p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-gray-300 transition-all">
            <Upload className="w-4 h-4" /> Importer CSV
          </button>
          <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-gray-300 transition-all">
            <Download className="w-4 h-4" /> Exporter
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition-all">
            <Plus className="w-4 h-4" /> Nouveau prospect
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un prospect..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', ...Object.keys(STATUS_CONFIG)].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                statusFilter === s
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'
              }`}
            >
              {s === 'all' ? 'Tous' : STATUS_CONFIG[s]?.label}
            </button>
          ))}
        </div>
        <button onClick={fetchProspects} disabled={fetching} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-500">
          <RefreshCw className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Actions sur sélection */}
      {selected.size > 0 && (
        <div className="mb-4 flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3">
          <span className="text-sm font-medium text-teal-700">{selected.size} sélectionné(s)</span>
          <div className="flex gap-2 ml-auto">
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-teal-200 rounded-lg text-sm text-teal-600 hover:bg-teal-50">
              <Mail className="w-4 h-4" /> Envoyer email
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-teal-200 rounded-lg text-sm text-teal-600 hover:bg-teal-50">
              <Zap className="w-4 h-4" /> Ajouter au workflow
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-teal-200 rounded-lg text-sm text-teal-600 hover:bg-teal-50">
              <Tag className="w-4 h-4" /> Tagger
            </button>
            <button onClick={() => setSelected(new Set())} className="px-2 py-1.5 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selected.size === filtered.length && filtered.length > 0}
                  onChange={selectAll}
                  className="rounded"
                />
              </th>
              <th className="w-8 px-2 py-3" />
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Prospect</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Entreprise</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Score</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tags</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {fetching ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  {[...Array(9)].map((_, j) => (
                    <td key={j} className="px-4 py-4">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-16 text-gray-400 text-sm">
                  Aucun prospect trouvé
                </td>
              </tr>
            ) : filtered.map(prospect => (
              <tr key={prospect.id} className={`hover:bg-gray-50 transition-colors ${selected.has(prospect.id) ? 'bg-teal-50/30' : ''}`}>
                <td className="px-4 py-4">
                  <input
                    type="checkbox"
                    checked={selected.has(prospect.id)}
                    onChange={() => toggleSelect(prospect.id)}
                    className="rounded"
                  />
                </td>
                <td className="px-2 py-4">
                  <button onClick={() => toggleStar(prospect.id)} className="text-gray-300 hover:text-amber-400 transition-colors">
                    {prospect.isStarred
                      ? <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      : <Star className="w-4 h-4" />
                    }
                  </button>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar firstName={prospect.firstName} lastName={prospect.lastName} />
                    <div>
                      <div className="font-medium text-gray-900 text-sm">
                        {prospect.firstName} {prospect.lastName}
                      </div>
                      <div className="text-xs text-gray-400">{prospect.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="text-sm text-gray-700">{prospect.company}</div>
                  <div className="text-xs text-gray-400">{prospect.jobTitle}</div>
                </td>
                <td className="px-4 py-4">
                  <StatusBadge status={prospect.status} />
                </td>
                <td className="px-4 py-4">
                  <ScoreBadge score={prospect.score} />
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-1">
                    {(prospect.tags || []).slice(0, 2).map(tag => (
                      <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex gap-2">
                    {prospect.email && (
                      <a href={`mailto:${prospect.email}`} className="text-gray-400 hover:text-teal-600 transition-colors">
                        <Mail className="w-4 h-4" />
                      </a>
                    )}
                    {prospect.phone && (
                      <a href={`tel:${prospect.phone}`} className="text-gray-400 hover:text-teal-600 transition-colors">
                        <Phone className="w-4 h-4" />
                      </a>
                    )}
                    {prospect.linkedinUrl && (
                      <a href={prospect.linkedinUrl} target="_blank" rel="noopener" className="text-gray-400 hover:text-blue-600 transition-colors">
                        <Globe className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <button className="text-gray-300 hover:text-gray-500 transition-colors">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer */}
        <div className="border-t border-gray-100 px-6 py-3 flex items-center justify-between text-sm text-gray-400">
          <span>{filtered.length} résultat(s)</span>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs">Précédent</button>
            <button className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs">1</button>
            <button className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs">Suivant</button>
          </div>
        </div>
      </div>
    </div>
  );
}
