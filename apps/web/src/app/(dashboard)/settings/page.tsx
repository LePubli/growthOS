'use client';
import Link from 'next/link';
import { User, Users, Key, CreditCard, Link as LinkIcon, ChevronRight } from 'lucide-react';

const SECTIONS = [
  { href:'/settings/profile', icon:<User className="w-5 h-5"/>, title:'Profil', desc:'Vos informations personnelles et préférences', color:'text-blue-600 bg-blue-50' },
  { href:'/settings/team', icon:<Users className="w-5 h-5"/>, title:'Équipe', desc:'Gérez les membres et les permissions', color:'text-purple-600 bg-purple-50' },
  { href:'/settings/api', icon:<Key className="w-5 h-5"/>, title:'API & Clés', desc:'Clés API et endpoints d\'intégration', color:'text-yellow-600 bg-yellow-50' },
  { href:'/settings/billing', icon:<CreditCard className="w-5 h-5"/>, title:'Facturation', desc:'Plan, abonnement et paiements', color:'text-green-600 bg-green-50' },
  { href:'/settings/integrations', icon:<LinkIcon className="w-5 h-5"/>, title:'Intégrations', desc:'Connectez GrowthOS à vos outils', color:'text-teal-600 bg-teal-50' },
];

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Paramètres</h1>
      <div className="space-y-3">
        {SECTIONS.map(s => (
          <Link key={s.href} href={s.href} className="flex items-center gap-4 bg-white rounded-2xl border border-gray-200 p-5 hover:border-teal-300 hover:shadow-sm transition-all">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${s.color}`}>{s.icon}</div>
            <div className="flex-1"><div className="font-semibold text-gray-900">{s.title}</div><div className="text-sm text-gray-400">{s.desc}</div></div>
            <ChevronRight className="w-5 h-5 text-gray-300" />
          </Link>
        ))}
      </div>
    </div>
  );
}
