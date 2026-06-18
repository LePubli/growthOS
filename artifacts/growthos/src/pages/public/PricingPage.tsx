import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { CheckCircle, X, ArrowRight, Zap } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  slug: string;
  price_monthly: number;
  price_yearly: number;
  max_users: number;
  max_prospects: number;
  max_signals: number;
  features: string[];
}

const PLAN_HIGHLIGHTS: Record<string, { color: string; badge?: string }> = {
  starter:    { color: 'border-white/20' },
  pro:        { color: 'border-purple-500', badge: 'Populaire' },
  enterprise: { color: 'border-white/20' },
};

const COMPARISON_FEATURES = [
  { label: 'CRM & Pipeline',              starter: true,  pro: true,       enterprise: true  },
  { label: 'Séquences Email',             starter: true,  pro: true,       enterprise: true  },
  { label: 'Signaux d\'intention',        starter: '100', pro: '1 000',    enterprise: 'Illimité' },
  { label: 'AI SDR',                      starter: false, pro: true,       enterprise: true  },
  { label: 'Data Enrichment',             starter: false, pro: true,       enterprise: true  },
  { label: 'E-Réputation',               starter: false, pro: true,       enterprise: true  },
  { label: 'Webhooks & Intégrations',     starter: false, pro: true,       enterprise: true  },
  { label: 'Revenue Intelligence',        starter: false, pro: true,       enterprise: true  },
  { label: 'Agents Autopilot',           starter: false, pro: '5 règles', enterprise: 'Illimité' },
  { label: 'SSO / SAML 2.0',            starter: false, pro: false,      enterprise: true  },
  { label: 'SLA 99.9%',                  starter: false, pro: false,      enterprise: true  },
  { label: 'Onboarding dédié',           starter: false, pro: false,      enterprise: true  },
  { label: 'Support',                     starter: 'Email', pro: 'Prioritaire', enterprise: 'Manager dédié' },
];

function FeatureValue({ val }: { val: boolean | string }) {
  if (val === true) return <CheckCircle size={18} className="text-green-400 mx-auto" />;
  if (val === false) return <X size={18} className="text-gray-600 mx-auto" />;
  return <span className="text-sm text-gray-300">{val}</span>;
}

export default function PricingPage() {
  const [yearly, setYearly] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/plans')
      .then(r => r.json())
      .then(d => { setPlans(d.plans ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-gray-950/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center font-bold text-sm">G</div>
            <span className="font-bold text-lg">GrowthOS</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors">Connexion</Link>
            <Link href="/register" className="text-sm bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-medium transition-colors">
              Commencer
            </Link>
          </div>
        </div>
      </header>

      <div className="pt-28 pb-24 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
              Des tarifs simples et{' '}
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">transparents</span>
            </h1>
            <p className="text-gray-400 text-lg mb-8">Commencez gratuitement, scalez sans surprise.</p>

            {/* Toggle Mensuel / Annuel */}
            <div className="inline-flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-1">
              <button
                onClick={() => setYearly(false)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${!yearly ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                Mensuel
              </button>
              <button
                onClick={() => setYearly(true)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${yearly ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                Annuel <span className="bg-green-500/20 text-green-400 text-xs px-1.5 py-0.5 rounded-full">-17%</span>
              </button>
            </div>
          </div>

          {/* Plans */}
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-500">
              <Zap size={20} className="animate-pulse mr-2" /> Chargement des plans…
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
              {plans.map(plan => {
                const hl = PLAN_HIGHLIGHTS[plan.slug] ?? PLAN_HIGHLIGHTS.starter;
                const price = yearly ? plan.price_yearly : plan.price_monthly;
                const period = yearly ? '/an' : '/mois';

                return (
                  <div
                    key={plan.id}
                    className={`relative bg-white/5 border-2 ${hl.color} rounded-2xl p-8 flex flex-col`}
                  >
                    {hl.badge && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full">{hl.badge}</span>
                      </div>
                    )}
                    <div className="mb-6">
                      <h2 className="text-xl font-bold mb-1">{plan.name}</h2>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-extrabold">{price === 0 ? 'Gratuit' : `${price}€`}</span>
                        {price > 0 && <span className="text-gray-400 text-sm">{period}</span>}
                      </div>
                      <div className="text-gray-500 text-xs mt-1">
                        {plan.max_users === -1 ? 'Utilisateurs illimités' : `${plan.max_users} utilisateurs`}
                        {' · '}
                        {plan.max_prospects === -1 ? 'Prospects illimités' : `${plan.max_prospects.toLocaleString()} prospects`}
                      </div>
                    </div>

                    <ul className="space-y-2.5 mb-8 flex-1">
                      {(plan.features ?? []).map((f: string) => (
                        <li key={f} className="flex items-start gap-2 text-sm">
                          <CheckCircle size={15} className="text-green-400 mt-0.5 shrink-0" />
                          <span className="text-gray-300">{f}</span>
                        </li>
                      ))}
                    </ul>

                    <Link
                      href={`/register?plan=${plan.slug}`}
                      className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-colors ${
                        hl.badge
                          ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30'
                          : 'border border-white/20 hover:border-white/40 text-white'
                      }`}
                    >
                      Commencer <ArrowRight size={15} />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tableau comparatif */}
          <div className="bg-white/3 border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <h3 className="text-xl font-bold">Comparaison détaillée</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-4 text-gray-400 font-medium text-sm w-1/2">Fonctionnalité</th>
                    <th className="text-center p-4 text-gray-300 font-semibold text-sm">Starter</th>
                    <th className="text-center p-4 text-purple-300 font-semibold text-sm">Pro</th>
                    <th className="text-center p-4 text-gray-300 font-semibold text-sm">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_FEATURES.map((row, i) => (
                    <tr key={row.label} className={`border-b border-white/5 ${i % 2 === 0 ? '' : 'bg-white/2'}`}>
                      <td className="p-4 text-sm text-gray-300">{row.label}</td>
                      <td className="p-4 text-center"><FeatureValue val={row.starter} /></td>
                      <td className="p-4 text-center"><FeatureValue val={row.pro} /></td>
                      <td className="p-4 text-center"><FeatureValue val={row.enterprise} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* FAQ */}
          <div className="mt-20 text-center">
            <h3 className="text-2xl font-bold mb-4">Des questions ?</h3>
            <p className="text-gray-400 mb-6">Notre équipe est disponible 7j/7 pour vous accompagner.</p>
            <Link href="/register" className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-8 py-3.5 rounded-xl font-semibold transition-colors">
              Essayer gratuitement 14 jours <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
