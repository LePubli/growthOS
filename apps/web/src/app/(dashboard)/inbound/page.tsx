'use client';
import { Download, Globe, Zap, Mail, Plus, BarChart2, CheckCircle, Clock, ExternalLink } from 'lucide-react';

const FORMS = [
  { id:'1', name:'Formulaire Contact Site', source:'le-publicitaire.fr', submissions:47, conversions:12, status:'active', createdAt:'2026-05-01' },
  { id:'2', name:'Landing Page SEO Audit', source:'audit.le-publicitaire.fr', submissions:23, conversions:8, status:'active', createdAt:'2026-05-10' },
  { id:'3', name:'Webinar Inscription', source:'calendly.com', submissions:89, conversions:34, status:'paused', createdAt:'2026-04-15' },
];

const WEBHOOKS = [
  { id:'1', name:'HubSpot Form', url:'https://api.growthos.fr/webhook/hubspot', events:234, status:'active' },
  { id:'2', name:'Typeform Leads', url:'https://api.growthos.fr/webhook/typeform', events:89, status:'active' },
];

export default function InboundPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inbound</h1>
          <p className="text-sm text-gray-400 mt-0.5">Captez et qualifiez vos leads entrants automatiquement</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium">
          <Plus className="w-4 h-4" /> Nouvelle source
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label:'Formulaires actifs', value:FORMS.filter(f=>f.status==='active').length, icon:<Globe className="w-5 h-5" />, color:'text-blue-600 bg-blue-50' },
          { label:'Soumissions ce mois', value:FORMS.reduce((s,f)=>s+f.submissions,0), icon:<Download className="w-5 h-5" />, color:'text-teal-600 bg-teal-50' },
          { label:'Leads convertis', value:FORMS.reduce((s,f)=>s+f.conversions,0), icon:<CheckCircle className="w-5 h-5" />, color:'text-green-600 bg-green-50' },
        ].map((s,i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>{s.icon}</div>
            <div><div className="text-2xl font-bold text-gray-900">{s.value}</div><div className="text-sm text-gray-400">{s.label}</div></div>
          </div>
        ))}
      </div>

      <h2 className="font-semibold text-gray-900 mb-3">Sources de leads</h2>
      <div className="space-y-3 mb-6">
        {FORMS.map(form => (
          <div key={form.id} className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600"><Globe className="w-5 h-5" /></div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{form.name}</h3>
              <p className="text-xs text-gray-400">{form.source}</p>
            </div>
            <div className="flex gap-6 text-sm">
              <div className="text-center"><div className="font-bold text-gray-900">{form.submissions}</div><div className="text-xs text-gray-400">Soumissions</div></div>
              <div className="text-center"><div className="font-bold text-green-600">{form.conversions}</div><div className="text-xs text-gray-400">Convertis</div></div>
              <div className="text-center"><div className="font-bold text-teal-600">{Math.round((form.conversions/form.submissions)*100)}%</div><div className="text-xs text-gray-400">Taux</div></div>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${form.status==='active' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>{form.status}</span>
          </div>
        ))}
      </div>

      <h2 className="font-semibold text-gray-900 mb-3">Webhooks</h2>
      <div className="space-y-3">
        {WEBHOOKS.map(wh => (
          <div key={wh.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600"><Zap className="w-4 h-4" /></div>
            <div className="flex-1">
              <div className="font-medium text-gray-900 text-sm">{wh.name}</div>
              <div className="text-xs text-gray-400 font-mono">{wh.url}</div>
            </div>
            <span className="text-xs text-gray-400">{wh.events} events</span>
            <span className="w-2 h-2 rounded-full bg-green-400" />
          </div>
        ))}
      </div>
    </div>
  );
}
