import { Link } from 'wouter';
import { AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';

export default function UnavailablePage({feature,description}:{feature:string;description:string}) {
  return <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
    <div className="max-w-2xl mx-auto mt-8 sm:mt-16 rounded-2xl bg-white border border-amber-200 shadow-sm p-6 sm:p-10">
      <div className="inline-flex gap-2 items-center bg-amber-50 text-amber-800 rounded-full px-3 py-1.5 text-xs font-semibold"><AlertTriangle size={14}/> Fonctionnalité en préparation</div>
      <h1 className="mt-5 text-2xl font-bold text-slate-900">{feature}</h1>
      <p className="mt-3 text-slate-600 leading-relaxed">{description}</p>
      <div className="flex gap-3 mt-6 p-4 rounded-xl bg-emerald-50 text-emerald-800"><ShieldCheck size={20} className="flex-shrink-0"/><p className="text-sm">Cette page n'affiche volontairement aucun contenu de démonstration. Elle sera réactivée après branchement aux vraies données et tests du parcours complet.</p></div>
      <Link href="/dashboard" className="mt-7 inline-flex items-center gap-2 bg-violet-700 text-white rounded-xl px-5 py-2.5 font-semibold text-sm">Revenir au tableau de bord <ArrowRight size={16}/></Link>
    </div>
  </main>;
}
