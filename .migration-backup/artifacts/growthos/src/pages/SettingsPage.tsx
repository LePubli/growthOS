import { Link, useLocation } from 'wouter';
import { User, Users, Key, CreditCard, Link as LinkIcon, ChevronRight, ArrowLeft, Palette } from 'lucide-react';

const SECTIONS = [
  { href:'/settings/profile', icon:<User className="w-5 h-5"/>, title:'Profil', desc:'Informations personnelles, mot de passe, préférences', color:'bg-blue-50 text-blue-600' },
  { href:'/settings/team', icon:<Users className="w-5 h-5"/>, title:'Équipe', desc:'Membres, invitations, rôles et permissions', color:'bg-purple-50 text-purple-600' },
  { href:'/settings/api', icon:<Key className="w-5 h-5"/>, title:'API & Clés', desc:'Clés API, tokens et accès programmtique', color:'bg-amber-50 text-amber-600' },
  { href:'/settings/billing', icon:<CreditCard className="w-5 h-5"/>, title:'Facturation', desc:'Plan, abonnement, paiements et factures', color:'bg-green-50 text-green-600' },
  { href:'/settings/integrations', icon:<LinkIcon className="w-5 h-5"/>, title:'Intégrations', desc:'HubSpot, Salesforce, Slack, Zapier et autres', color:'bg-teal-50 text-teal-600' },
  { href:'/themes', icon:<Palette className="w-5 h-5"/>, title:'Thèmes & Apparence', desc:'Couleurs, polices, thème clair/sombre', color:'bg-pink-50 text-pink-600' },
];

export default function SettingsPage() {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-screen p-6" style={{background:'var(--body-bg)'}}>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={()=>history.back()} className="p-2 rounded-xl hover:opacity-80 transition-all" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)',color:'var(--text-secondary)'}}>
          <ArrowLeft className="w-5 h-5"/>
        </button>
        <div>
          <h1 className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>Paramètres</h1>
          <p className="text-sm" style={{color:'var(--text-muted)'}}>Gérez votre compte et votre espace de travail</p>
        </div>
      </div>
      <div className="max-w-2xl space-y-3">
        {SECTIONS.map(s=>(
          <Link key={s.href} href={s.href} style={{textDecoration:'none',display:'block'}}>
            <div className="flex items-center gap-4 rounded-2xl border p-5 hover:shadow-md transition-all"
              style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}
              onMouseEnter={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--color-primary)'}
              onMouseLeave={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--card-border)'}>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${s.color}`}>{s.icon}</div>
              <div className="flex-1">
                <div className="font-semibold" style={{color:'var(--text-primary)'}}>{s.title}</div>
                <div className="text-sm" style={{color:'var(--text-muted)'}}>{s.desc}</div>
              </div>
              <ChevronRight className="w-5 h-5" style={{color:'var(--text-muted)'}}/>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
