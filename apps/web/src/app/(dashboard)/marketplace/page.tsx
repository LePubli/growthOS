'use client';

import { useState } from 'react';
import {
  Search, Star, Download, ExternalLink, Filter,
  CheckCircle, Loader2, Globe, Mail, BarChart2,
  Users, Brain, Shield, Zap, Package, ArrowRight,
  Tag, Clock, TrendingUp
} from 'lucide-react';

interface MarketplaceItem {
  id: string;
  name: string;
  vendor: string;
  description: string;
  longDescription?: string;
  category: string;
  tags: string[];
  price: 'free' | 'premium' | 'enterprise';
  priceLabel?: string;
  rating: number;
  reviews: number;
  installs: number;
  isInstalled?: boolean;
  isFeatured?: boolean;
  isNew?: boolean;
  icon?: string;
  screenshots?: string[];
}

const CATEGORIES = [
  { id:'all',          label:'Tout',           icon:<Package className="w-4 h-4" /> },
  { id:'crm',          label:'CRM',            icon:<Users className="w-4 h-4" /> },
  { id:'email',        label:'Email',          icon:<Mail className="w-4 h-4" /> },
  { id:'analytics',    label:'Analytics',      icon:<BarChart2 className="w-4 h-4" /> },
  { id:'enrichment',   label:'Enrichissement', icon:<Globe className="w-4 h-4" /> },
  { id:'ai',           label:'IA',             icon:<Brain className="w-4 h-4" /> },
  { id:'automation',   label:'Automation',     icon:<Zap className="w-4 h-4" /> },
  { id:'security',     label:'Sécurité',       icon:<Shield className="w-4 h-4" /> },
];

const PRICE_CONFIG = {
  free:       { label:'Gratuit',    color:'text-green-600',  bg:'bg-green-50' },
  premium:    { label:'Premium',    color:'text-purple-600', bg:'bg-purple-50' },
  enterprise: { label:'Enterprise', color:'text-amber-600',  bg:'bg-amber-50' },
};

const CAT_COLORS: Record<string, string> = {
  crm:'bg-blue-100 text-blue-600', email:'bg-purple-100 text-purple-600',
  analytics:'bg-green-100 text-green-600', enrichment:'bg-orange-100 text-orange-600',
  ai:'bg-pink-100 text-pink-600', automation:'bg-yellow-100 text-yellow-600',
  security:'bg-red-100 text-red-600',
};

const CAT_ICONS: Record<string, React.ReactNode> = {
  crm:<Users className="w-5 h-5" />, email:<Mail className="w-5 h-5" />,
  analytics:<BarChart2 className="w-5 h-5" />, enrichment:<Globe className="w-5 h-5" />,
  ai:<Brain className="w-5 h-5" />, automation:<Zap className="w-5 h-5" />,
  security:<Shield className="w-5 h-5" />,
};

const ITEMS: MarketplaceItem[] = [
  {
    id:'1', name:'CRM Prospector Pro', vendor:'GrowthOS Labs', category:'crm',
    description:'Synchronisation bidirectionnelle avec HubSpot, Salesforce et Pipedrive. Enrichissement automatique des contacts.',
    tags:['HubSpot','Salesforce','Pipedrive'], price:'premium', priceLabel:'29€/mois',
    rating:4.8, reviews:234, installs:12400, isFeatured:true, isInstalled:true,
  },
  {
    id:'2', name:'Email Sequence AI', vendor:'Mailify Tech', category:'email',
    description:'Créez des séquences email personnalisées par l\'IA avec A/B testing automatique et optimisation du timing d\'envoi.',
    tags:['AI','A/B Test','Automation'], price:'premium', priceLabel:'19€/mois',
    rating:4.6, reviews:189, installs:8900, isFeatured:true, isNew:true,
  },
  {
    id:'3', name:'LinkedIn Enricher', vendor:'SocialData', category:'enrichment',
    description:'Enrichissez automatiquement vos prospects avec les données LinkedIn : poste, entreprise, ancienneté, connexions.',
    tags:['LinkedIn','Enrichissement','B2B'], price:'free',
    rating:4.4, reviews:567, installs:34200,
  },
  {
    id:'4', name:'Analytics Dashboard Pro', vendor:'DataViz Inc', category:'analytics',
    description:'Tableaux de bord avancés avec prédictions ML, cohortes et attribution multi-touch pour optimiser votre ROI.',
    tags:['ML','Attribution','ROI'], price:'enterprise', priceLabel:'Sur devis',
    rating:4.9, reviews:88, installs:2100,
  },
  {
    id:'5', name:'Claude AI Assistant', vendor:'Anthropic', category:'ai',
    description:'Intégrez Claude directement dans GrowthOS pour la rédaction d\'emails, l\'analyse de prospects et la génération de contenus.',
    tags:['Claude','LLM','Rédaction'], price:'premium', priceLabel:'Clé API requise',
    rating:4.9, reviews:412, installs:18700, isFeatured:true,
  },
  {
    id:'6', name:'SMTP Secure Gateway', vendor:'MailSec', category:'security',
    description:'Sécurisez vos envois email avec DKIM, SPF, DMARC automatiques et monitoring de délivrabilité en temps réel.',
    tags:['DKIM','SPF','DMARC'], price:'free',
    rating:4.7, reviews:298, installs:45000,
  },
  {
    id:'7', name:'Zapier Connect', vendor:'Zapier', category:'automation',
    description:'Connectez GrowthOS à 5000+ applications via Zapier. Automatisez vos workflows sans code.',
    tags:['Zapier','No-code','Intégrations'], price:'free',
    rating:4.5, reviews:891, installs:67000,
  },
  {
    id:'8', name:'Google Analytics Bridge', vendor:'Analytics Bridge', category:'analytics',
    description:'Importez vos données GA4 et Google Search Console directement dans GrowthOS pour une vue 360° de votre acquisition.',
    tags:['GA4','SEO','Acquisition'], price:'free',
    rating:4.3, reviews:156, installs:23400, isNew:true,
  },
  {
    id:'9', name:'Prospect Scorer AI', vendor:'LeadScore AI', category:'ai',
    description:'Scorez automatiquement vos prospects grâce au machine learning : firmographie, comportement email, signaux d\'intention.',
    tags:['ML','Scoring','Intent'], price:'premium', priceLabel:'39€/mois',
    rating:4.7, reviews:124, installs:5600,
  },
];

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`w-3 h-3 ${i <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
      ))}
    </div>
  );
}

function ItemCard({ item, onInstall, loading }: {
  item: MarketplaceItem;
  onInstall: (id: string) => void;
  loading: string | null;
}) {
  const price = PRICE_CONFIG[item.price];
  const isLoading = loading === item.id;
  const catColor = CAT_COLORS[item.category] || 'bg-gray-100 text-gray-500';
  const catIcon = CAT_ICONS[item.category] || <Package className="w-5 h-5" />;

  return (
    <div className={`bg-white rounded-2xl border p-5 flex flex-col gap-4 hover:shadow-lg transition-all hover:-translate-y-0.5 ${
      item.isFeatured ? 'border-teal-200 shadow-sm' : 'border-gray-200'
    }`}>
      {/* Badges */}
      <div className="flex gap-2">
        {item.isFeatured && (
          <span className="text-xs font-semibold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Featured
          </span>
        )}
        {item.isNew && (
          <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
            Nouveau
          </span>
        )}
      </div>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${catColor}`}>
          {catIcon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{item.name}</h3>
          <p className="text-xs text-gray-400">{item.vendor}</p>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${price.color} ${price.bg}`}>
          {item.priceLabel || price.label}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 leading-relaxed flex-1">{item.description}</p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        {item.tags.map(t => (
          <span key={t} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{t}</span>
        ))}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-gray-400">
        <div className="flex items-center gap-1.5">
          <Stars rating={item.rating} />
          <span className="font-medium text-gray-600">{item.rating}</span>
          <span>({item.reviews})</span>
        </div>
        <div className="flex items-center gap-1">
          <Download className="w-3 h-3" />
          <span>{item.installs.toLocaleString()}</span>
        </div>
      </div>

      {/* Action */}
      <div className="pt-2 border-t border-gray-100">
        {item.isInstalled ? (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-green-600 font-medium">
              <CheckCircle className="w-4 h-4" /> Installé
            </span>
            <button className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
              Configurer <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => onInstall(item.id)}
            disabled={!!loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 transition-all disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {item.price === 'free' ? 'Installer gratuitement' : `Essayer — ${item.priceLabel}`}
          </button>
        )}
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  const [items, setItems] = useState(ITEMS);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [priceFilter, setPriceFilter] = useState<'all'|'free'|'premium'>('all');
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'popular'|'rating'|'new'>('popular');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const handleInstall = (id: string) => {
    setLoading(id);
    setTimeout(() => {
      setItems(prev => prev.map(i => i.id === id ? { ...i, isInstalled: true } : i));
      const item = items.find(i => i.id === id);
      showToast(`"${item?.name}" installé avec succès ✓`);
      setLoading(null);
    }, 1500);
  };

  const filtered = items
    .filter(i => {
      const matchSearch = !search || `${i.name} ${i.description} ${i.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase());
      const matchCat = category === 'all' || i.category === category;
      const matchPrice = priceFilter === 'all' || i.price === priceFilter;
      return matchSearch && matchCat && matchPrice;
    })
    .sort((a, b) => {
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'new') return (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0);
      return b.installs - a.installs;
    });

  const featured = filtered.filter(i => i.isFeatured);
  const rest = filtered.filter(i => !i.isFeatured);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-teal-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />{toast}
        </div>
      )}

      {/* Hero */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-2xl p-8 mb-6 text-white">
        <h1 className="text-3xl font-bold mb-2">Marketplace GrowthOS</h1>
        <p className="text-teal-100 mb-6">Étendez les capacités de GrowthOS avec des intégrations et plugins certifiés</p>
        <div className="relative max-w-lg">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une intégration..."
            className="w-full pl-12 pr-4 py-3 bg-white/10 backdrop-blur border border-white/20 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
          />
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar filtres */}
        <div className="w-48 flex-shrink-0 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Catégorie</h3>
            {CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setCategory(cat.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all mb-1 ${
                  category === cat.id ? 'bg-teal-50 text-teal-600 font-medium' : 'text-gray-600 hover:bg-gray-50'
                }`}>
                <span className={category === cat.id ? 'text-teal-600' : 'text-gray-400'}>{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Prix</h3>
            {(['all','free','premium'] as const).map(p => (
              <button key={p} onClick={() => setPriceFilter(p)}
                className={`w-full flex items-center px-3 py-2 rounded-xl text-sm transition-all mb-1 ${
                  priceFilter === p ? 'bg-teal-50 text-teal-600 font-medium' : 'text-gray-600 hover:bg-gray-50'
                }`}>
                {p === 'all' ? 'Tous' : p === 'free' ? '🆓 Gratuit' : '⭐ Premium'}
              </button>
            ))}
          </div>
        </div>

        {/* Contenu */}
        <div className="flex-1">
          {/* Sort bar */}
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm text-gray-500">{filtered.length} intégration(s)</p>
            <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1">
              {([['popular','Populaires'],['rating','Mieux notés'],['new','Nouveautés']] as const).map(([val, label]) => (
                <button key={val} onClick={() => setSortBy(val)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    sortBy === val ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Featured */}
          {featured.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">⭐ Mis en avant</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {featured.map(item => <ItemCard key={item.id} item={item} onInstall={handleInstall} loading={loading} />)}
              </div>
            </>
          )}

          {/* All */}
          {rest.length > 0 && (
            <>
              {featured.length > 0 && <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Toutes les intégrations</h2>}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rest.map(item => <ItemCard key={item.id} item={item} onInstall={handleInstall} loading={loading} />)}
              </div>
            </>
          )}

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Package className="w-12 h-12 text-gray-200" />
              <p className="text-gray-400">Aucune intégration trouvée</p>
              <button onClick={() => { setSearch(''); setCategory('all'); setPriceFilter('all'); }}
                className="text-sm text-teal-600 hover:text-teal-700">
                Réinitialiser les filtres
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
