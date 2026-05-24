'use client';

import { useState } from 'react';
import {
  User, Bell, Shield, Key, Globe, Mail, Save,
  CheckCircle, Eye, EyeOff, Building2, Palette,
  CreditCard, AlertCircle, ToggleLeft, ToggleRight
} from 'lucide-react';

interface Section {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const SECTIONS: Section[] = [
  { id:'profile', label:'Profil', icon:<User className="w-4 h-4" /> },
  { id:'company', label:'Entreprise', icon:<Building2 className="w-4 h-4" /> },
  { id:'notifications', label:'Notifications', icon:<Bell className="w-4 h-4" /> },
  { id:'security', label:'Sécurité', icon:<Shield className="w-4 h-4" /> },
  { id:'api', label:'Clés API', icon:<Key className="w-4 h-4" /> },
  { id:'billing', label:'Abonnement', icon:<CreditCard className="w-4 h-4" /> },
];

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className={`relative w-11 h-6 rounded-full transition-all ${value ? 'bg-teal-600' : 'bg-gray-200'}`}>
      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${value ? 'left-5' : 'left-0.5'}`} />
    </button>
  );
}

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('profile');
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const [profile, setProfile] = useState({
    firstName: 'Admin', lastName: '', email: 'admin@le-publicitaire.fr', phone: '', bio: '',
  });

  const [company, setCompany] = useState({
    name: 'Le Publicitaire', website: 'https://le-publicitaire.fr', industry: 'Agence digitale', size: '1-10',
  });

  const [notifs, setNotifs] = useState({
    emailNewProspect: true, emailWorkflow: true, emailWeeklyReport: true,
    pushNewLead: false, pushWorkflowError: true, slackIntegration: false,
  });

  const [security, setSecurity] = useState({
    currentPassword: '', newPassword: '', confirmPassword: '', twoFactor: false,
  });

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {saved && (
        <div className="fixed top-6 right-6 z-50 bg-teal-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> Paramètres sauvegardés
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
        <p className="text-sm text-gray-400 mt-0.5">Gérez votre compte et vos préférences</p>
      </div>

      <div className="flex gap-6">
        {/* Nav latérale */}
        <div className="w-56 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-gray-200 p-2">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeSection === s.id ? 'bg-teal-50 text-teal-600' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {s.icon} {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contenu */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-200 p-6">

          {/* Profil */}
          {activeSection === 'profile' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Informations personnelles</h2>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-teal-600 flex items-center justify-center text-white text-xl font-bold">
                  {profile.firstName[0]}{profile.lastName[0] || 'A'}
                </div>
                <div>
                  <button className="text-sm text-teal-600 hover:text-teal-700 font-medium">Changer l'avatar</button>
                  <p className="text-xs text-gray-400 mt-0.5">JPG, PNG max 2MB</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Prénom">
                  <input value={profile.firstName} onChange={e => setProfile({...profile, firstName: e.target.value})}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </FormField>
                <FormField label="Nom">
                  <input value={profile.lastName} onChange={e => setProfile({...profile, lastName: e.target.value})}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </FormField>
              </div>
              <FormField label="Email" hint="L'email est utilisé pour la connexion">
                <input type="email" value={profile.email} onChange={e => setProfile({...profile, email: e.target.value})}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </FormField>
              <FormField label="Téléphone">
                <input type="tel" value={profile.phone} onChange={e => setProfile({...profile, phone: e.target.value})}
                  placeholder="+33 6 00 00 00 00"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </FormField>
            </div>
          )}

          {/* Entreprise */}
          {activeSection === 'company' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Informations entreprise</h2>
              <FormField label="Nom de l'entreprise">
                <input value={company.name} onChange={e => setCompany({...company, name: e.target.value})}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </FormField>
              <FormField label="Site web">
                <input value={company.website} onChange={e => setCompany({...company, website: e.target.value})}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Secteur">
                  <select value={company.industry} onChange={e => setCompany({...company, industry: e.target.value})}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                    {['Agence digitale','SaaS','E-commerce','Consulting','Industrie','Autre'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </FormField>
                <FormField label="Taille">
                  <select value={company.size} onChange={e => setCompany({...company, size: e.target.value})}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                    {['1-10','11-50','51-200','201-1000','1000+'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </FormField>
              </div>
            </div>
          )}

          {/* Notifications */}
          {activeSection === 'notifications' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Préférences de notifications</h2>
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Email</h3>
                {[
                  { key:'emailNewProspect', label:'Nouveau prospect importé' },
                  { key:'emailWorkflow', label:'Exécution de workflow terminée' },
                  { key:'emailWeeklyReport', label:'Rapport hebdomadaire', hint:'Envoyé chaque lundi matin' },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <div className="text-sm font-medium text-gray-700">{item.label}</div>
                      {item.hint && <div className="text-xs text-gray-400">{item.hint}</div>}
                    </div>
                    <Toggle value={notifs[item.key as keyof typeof notifs] as boolean} onChange={v => setNotifs({...notifs, [item.key]: v})} />
                  </div>
                ))}
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider pt-2">Push & Intégrations</h3>
                {[
                  { key:'pushNewLead', label:'Nouveau lead qualifié' },
                  { key:'pushWorkflowError', label:'Erreur de workflow' },
                  { key:'slackIntegration', label:'Intégration Slack', hint:'Nécessite la configuration du webhook' },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <div className="text-sm font-medium text-gray-700">{item.label}</div>
                      {item.hint && <div className="text-xs text-gray-400">{item.hint}</div>}
                    </div>
                    <Toggle value={notifs[item.key as keyof typeof notifs] as boolean} onChange={v => setNotifs({...notifs, [item.key]: v})} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sécurité */}
          {activeSection === 'security' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Sécurité du compte</h2>
              <FormField label="Mot de passe actuel">
                <input type="password" value={security.currentPassword}
                  onChange={e => setSecurity({...security, currentPassword: e.target.value})}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </FormField>
              <FormField label="Nouveau mot de passe" hint="Minimum 8 caractères avec chiffres et symboles">
                <input type="password" value={security.newPassword}
                  onChange={e => setSecurity({...security, newPassword: e.target.value})}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </FormField>
              <FormField label="Confirmer le nouveau mot de passe">
                <input type="password" value={security.confirmPassword}
                  onChange={e => setSecurity({...security, confirmPassword: e.target.value})}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </FormField>
              <div className="flex items-center justify-between py-3 border-t border-gray-100">
                <div>
                  <div className="text-sm font-medium text-gray-700">Authentification à 2 facteurs</div>
                  <div className="text-xs text-gray-400">Sécurisez votre compte avec une seconde vérification</div>
                </div>
                <Toggle value={security.twoFactor} onChange={v => setSecurity({...security, twoFactor: v})} />
              </div>
            </div>
          )}

          {/* API Keys */}
          {activeSection === 'api' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Clés API</h2>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-sm text-amber-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                Ne partagez jamais vos clés API. Elles donnent un accès complet à votre compte.
              </div>
              {[
                { label:'Clé API GrowthOS', value:'gos_live_••••••••••••••••••••••••••••', env:'GROWTHOS_API_KEY' },
                { label:'Anthropic API Key', value:'sk-ant-••••••••••••••••••••', env:'ANTHROPIC_API_KEY' },
                { label:'OpenAI API Key', value:'sk-••••••••••••••••••••', env:'OPENAI_API_KEY' },
              ].map((key, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{key.label}</div>
                      <div className="text-xs text-gray-400 font-mono">{key.env}</div>
                    </div>
                    <div className="flex gap-2">
                      <button className="text-xs text-teal-600 hover:text-teal-700 px-2 py-1 bg-teal-50 rounded-lg">Régénérer</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <code className="text-xs text-gray-600 flex-1 font-mono">{key.value}</code>
                    <button className="text-gray-400 hover:text-gray-600">
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Billing */}
          {activeSection === 'billing' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Abonnement</h2>
              <div className="bg-teal-600 rounded-2xl p-6 text-white">
                <div className="text-xs uppercase tracking-wider opacity-70 mb-1">Plan actuel</div>
                <div className="text-2xl font-bold mb-1">Growth Pro</div>
                <div className="text-sm opacity-80">Renouvellement le 1er juin 2026</div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label:'Prospects', used:1247, max:5000 },
                  { label:'Emails/mois', used:8934, max:50000 },
                  { label:'Workflows', used:7, max:20 },
                ].map((quota, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">{quota.label}</span>
                      <span className="font-semibold text-gray-900">{quota.used.toLocaleString()}/{quota.max.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-teal-600" style={{ width: `${(quota.used/quota.max)*100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bouton sauvegarder */}
          {activeSection !== 'billing' && (
            <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition-all"
              >
                <Save className="w-4 h-4" /> Sauvegarder
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
