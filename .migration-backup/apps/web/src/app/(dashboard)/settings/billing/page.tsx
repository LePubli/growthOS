'use client';
import { CreditCard, CheckCircle, Zap, Building2, Crown } from 'lucide-react';

const PLANS = [
  { id:'starter', name:'Starter', price:49, desc:'Pour les freelances et petites équipes', features:['500 prospects/mois','3 séquences actives','2 utilisateurs','Support email'], current:false },
  { id:'pro', name:'Pro', price:149, desc:'Pour les équipes commerciales', features:['5 000 prospects/mois','Séquences illimitées','10 utilisateurs','Plugins premium','Support prioritaire'], current:true },
  { id:'enterprise', name:'Enterprise', price:499, desc:'Pour les grandes organisations', features:['Prospects illimités','API complète','Utilisateurs illimités','SSO/SAML','Account manager dédié'], current:false },
];

export default function SettingsBillingPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Facturation</h1>
      <p className="text-sm text-gray-400 mb-6">Gérez votre abonnement et vos informations de paiement</p>

      <div className="bg-teal-600 rounded-2xl p-6 mb-6 text-white">
        <div className="flex items-center justify-between">
          <div><p className="text-teal-100 text-sm mb-1">Plan actuel</p><h2 className="text-2xl font-bold">Pro · 149€/mois</h2><p className="text-teal-100 text-sm mt-1">Renouvellement le 1er juin 2026</p></div>
          <Crown className="w-12 h-12 text-teal-300" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {PLANS.map(plan => (
          <div key={plan.id} className={`bg-white rounded-2xl border p-5 ${plan.current?'border-teal-400 shadow-teal-50 shadow-lg':'border-gray-200'}`}>
            {plan.current && <div className="text-xs bg-teal-600 text-white px-2 py-0.5 rounded-full inline-block mb-3">Plan actuel</div>}
            <h3 className="font-bold text-gray-900 text-lg">{plan.name}</h3>
            <div className="text-3xl font-bold text-gray-900 my-2">{plan.price}€<span className="text-sm font-normal text-gray-400">/mois</span></div>
            <p className="text-xs text-gray-400 mb-4">{plan.desc}</p>
            <ul className="space-y-2 mb-5">
              {plan.features.map(f => <li key={f} className="flex items-center gap-2 text-sm text-gray-600"><CheckCircle className="w-4 h-4 text-teal-500 flex-shrink-0" />{f}</li>)}
            </ul>
            <button className={`w-full py-2.5 rounded-xl text-sm font-medium ${plan.current?'bg-gray-100 text-gray-500 cursor-default':'bg-teal-600 text-white hover:bg-teal-700'}`}>
              {plan.current ? 'Plan actuel' : 'Passer à ce plan'}
            </button>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Méthode de paiement</h2>
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
          <CreditCard className="w-8 h-8 text-gray-400" />
          <div><div className="font-medium text-gray-900">Visa •••• •••• •••• 4242</div><div className="text-xs text-gray-400">Expire 12/2027</div></div>
          <button className="ml-auto text-sm text-teal-600 hover:text-teal-700">Modifier</button>
        </div>
      </div>
    </div>
  );
}
