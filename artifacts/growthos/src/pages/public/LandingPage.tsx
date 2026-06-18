import { Link } from 'wouter';
import {
  Zap, Bot, Shield, TrendingUp, Users, BarChart2,
  CheckCircle, ArrowRight, Star, Globe, Database, Mail
} from 'lucide-react';

const FEATURES = [
  {
    icon: <Bot size={28} className="text-purple-400" />,
    title: 'AI SDR Autonome',
    desc: 'Générez des messages ultra-personnalisés et automatisez votre prospection grâce à l\'IA générative.',
  },
  {
    icon: <Zap size={28} className="text-yellow-400" />,
    title: 'Signaux d\'Intention',
    desc: 'Détectez en temps réel les signaux de recrutement, financement et actualités de vos cibles.',
  },
  {
    icon: <Shield size={28} className="text-blue-400" />,
    title: 'E-Réputation',
    desc: 'Surveillez et maîtrisez votre image en ligne : SERP, sentiment, réseaux sociaux et PBN.',
  },
  {
    icon: <TrendingUp size={28} className="text-green-400" />,
    title: 'Revenue Intelligence',
    desc: 'Prévisions de CA, scoring pipeline et recommandations IA pour closer plus vite.',
  },
  {
    icon: <Database size={28} className="text-orange-400" />,
    title: 'Data Enrichment',
    desc: '23 sources de données pour enrichir vos prospects : technographies, géolocalisation, contacts.',
  },
  {
    icon: <Mail size={28} className="text-pink-400" />,
    title: 'Séquences Email',
    desc: 'Automatisez vos campagnes outreach multi-étapes avec tracking et analytics intégrés.',
  },
];

const TESTIMONIALS = [
  {
    name: 'Sophie L.',
    role: 'Head of Sales, Fintech Scale-up',
    quote: 'GrowthOS a réduit notre cycle de vente de 40%. L\'AI SDR génère des messages que nos prospects croient écrits à la main.',
    avatar: 'SL',
  },
  {
    name: 'Marc D.',
    role: 'CEO, SaaS B2B',
    quote: 'Les signaux d\'intention nous permettent d\'approcher les bons comptes au bon moment. Un game-changer pour notre équipe.',
    avatar: 'MD',
  },
  {
    name: 'Clara V.',
    role: 'Growth Manager, Agence digitale',
    quote: 'Le module e-réputation nous a sauvé d\'une crise en détectant une vague négative avant qu\'elle s\'amplifie.',
    avatar: 'CV',
  },
];

const STATS = [
  { value: '+40%', label: 'de deals closés' },
  { value: '3x', label: 'plus de réponses' },
  { value: '2h', label: 'économisées/jour/rep' },
  { value: '99.9%', label: 'uptime SLA' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ── Header ── */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-gray-950/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center font-bold text-sm">G</div>
            <span className="font-bold text-lg">GrowthOS</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-400">
            <a href="#features" className="hover:text-white transition-colors">Fonctionnalités</a>
            <Link href="/pricing" className="hover:text-white transition-colors">Tarifs</Link>
            <a href="#testimonials" className="hover:text-white transition-colors">Témoignages</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors">Connexion</Link>
            <Link href="/register" className="text-sm bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-medium transition-colors">
              Commencer gratuitement
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="pt-32 pb-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-purple-600/20 border border-purple-500/30 rounded-full px-4 py-1.5 text-sm text-purple-300 mb-8">
            <Zap size={14} />
            <span>Plateforme B2B Sales & Growth Intelligence</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold mb-6 leading-tight">
            Transformez votre{' '}
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              croissance commerciale
            </span>
            {' '}avec l'IA
          </h1>
          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            GrowthOS centralise votre CRM, vos signaux d'intention, l'AI SDR, l'e-réputation
            et le revenue intelligence dans une seule plateforme pensée pour les équipes B2B ambitieuses.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-8 py-3.5 rounded-xl font-semibold text-base transition-colors shadow-lg shadow-purple-600/30">
              Démarrer gratuitement <ArrowRight size={18} />
            </Link>
            <Link href="/pricing" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-white/20 hover:border-white/40 text-white px-8 py-3.5 rounded-xl font-semibold text-base transition-colors">
              Voir les tarifs
            </Link>
          </div>
          <p className="text-sm text-gray-500 mt-4">Aucune carte bancaire requise · 14 jours d'essai gratuit</p>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="py-12 border-y border-white/10 bg-white/5">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map(s => (
            <div key={s.label} className="text-center">
              <div className="text-4xl font-extrabold text-purple-400 mb-1">{s.value}</div>
              <div className="text-sm text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Tout ce qu'il faut pour scaler</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Une suite complète de fonctionnalités IA pour automatiser, analyser et accélérer votre revenue.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(f => (
              <div key={f.title} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/8 hover:border-purple-500/30 transition-all">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-4">
                  {f.icon}
                </div>
                <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section id="testimonials" className="py-24 px-6 bg-white/3">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ils ont transformé leur growth</h2>
            <div className="flex items-center justify-center gap-1 text-yellow-400 mb-2">
              {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={18} fill="currentColor" />)}
            </div>
            <p className="text-gray-400">4.9/5 sur G2 · 200+ équipes commerciales</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <p className="text-gray-300 text-sm leading-relaxed mb-6 italic">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-700 flex items-center justify-center text-sm font-bold">
                    {t.avatar}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{t.name}</div>
                    <div className="text-gray-500 text-xs">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Final ── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="bg-gradient-to-br from-purple-900/50 to-pink-900/30 border border-purple-500/30 rounded-3xl p-12">
            <Globe size={48} className="text-purple-400 mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Prêt à accélérer votre croissance ?</h2>
            <p className="text-gray-400 mb-8">Rejoignez plus de 200 équipes B2B qui utilisent GrowthOS pour générer plus de pipeline.</p>
            <Link href="/register" className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-10 py-4 rounded-xl font-bold text-lg transition-colors shadow-xl shadow-purple-600/30">
              Commencer gratuitement <ArrowRight size={20} />
            </Link>
            <div className="flex items-center justify-center gap-6 mt-8 text-sm text-gray-500">
              {['14 jours gratuits', 'Annulation à tout moment', 'Support inclus'].map(item => (
                <span key={item} className="flex items-center gap-1.5">
                  <CheckCircle size={14} className="text-green-400" /> {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/10 py-8 px-6 text-center text-gray-500 text-sm">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-6 h-6 rounded bg-purple-600 flex items-center justify-center text-xs font-bold text-white">G</div>
          <span className="font-semibold text-white">GrowthOS</span>
        </div>
        <p>© {new Date().getFullYear()} GrowthOS · Tous droits réservés ·{' '}
          <Link href="/pricing" className="hover:text-white transition-colors">Tarifs</Link>
        </p>
      </footer>
    </div>
  );
}
