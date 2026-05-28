'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Download, Globe, Zap, Mail, Plus, BarChart2, CheckCircle,
  Clock, ExternalLink, Copy, Code, X, Loader2, AlertCircle,
  Link, Settings, Trash2, Eye, EyeOff
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const MOCK_FORMS = [
  { id:'1', name:'Formulaire Contact Site', source:'le-publicitaire.fr', submissions:47, conversions:12, status:'active', createdAt:'2026-05-01', embedToken:'tok_abc123' },
  { id:'2', name:'Landing Page SEO Audit', source:'audit.le-publicitaire.fr', submissions:23, conversions:8, status:'active', createdAt:'2026-05-10', embedToken:'tok_def456' },
  { id:'3', name:'Webinar Inscription', source:'calendly.com', submissions:89, conversions:34, status:'paused', createdAt:'2026-04-15', embedToken:'tok_ghi789' },
];

function NewSourceModal({ onClose, apiUrl }: { onClose:()=>void; apiUrl:string }) {
  const [type, setType] = useState<'webhook'|'embed'|'zapier'>('webhook');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{token:string}|null>(null);

  const create = async () => {
    if (!name) return;
    setSaving(true);
    await new Promise(r=>setTimeout(r,600));
    setDone({ token: `tok_${Math.random().toString(36).slice(2,12)}` });
    setSaving(false);
  };

  const webhookUrl = `${apiUrl}/api/v1/inbound/webhook/${done?.token||'[TOKEN]'}`;
  const embedCode = `<script src="${apiUrl}/embed/form.js" data-token="${done?.token||'[TOKEN]'}"></script>`;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Nouvelle source de leads</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400"/></button>
        </div>

        {done ? (
          <>
            <div className="flex items-center gap-3 bg-green-50 rounded-xl p-4 mb-5">
              <CheckCircle className="w-8 h-8 text-green-600"/>
              <div><div className="font-bold text-green-700">{name} créé ✓</div><div className="text-xs text-green-600">Votre source est prête</div></div>
            </div>
            {type==='webhook' && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 mb-2">URL Webhook à utiliser dans votre outil</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-gray-50 px-3 py-2.5 rounded-xl text-gray-700 font-mono truncate">{webhookUrl}</code>
                  <button onClick={()=>navigator.clipboard.writeText(webhookUrl)} className="flex-shrink-0 p-2 text-teal-600 hover:bg-teal-50 rounded-lg"><Copy className="w-4 h-4"/></button>
                </div>
                <p className="text-xs text-gray-400 mt-2">Collez cette URL dans votre HubSpot, Typeform, Zapier, etc.</p>
              </div>
            )}
            {type==='embed' && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 mb-2">Code à intégrer sur votre site</label>
                <div className="relative">
                  <code className="block text-xs bg-gray-900 text-green-400 px-3 py-3 rounded-xl font-mono leading-relaxed">{embedCode}</code>
                  <button onClick={()=>navigator.clipboard.writeText(embedCode)} className="absolute top-2 right-2 p-1.5 bg-gray-700 text-gray-300 hover:bg-gray-600 rounded-lg"><Copy className="w-3.5 h-3.5"/></button>
                </div>
              </div>
            )}
            <button onClick={onClose} className="w-full py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium">Fermer</button>
          </>
        ) : (
          <>
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-5">
              {[{k:'webhook',l:'Webhook'},{k:'embed',l:'Formulaire embed'},{k:'zapier',l:'Zapier/Make'}].map(t=>(
                <button key={t.k} onClick={()=>setType(t.k as any)} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${type===t.k?'bg-white shadow text-gray-900':'text-gray-500'}`}>{t.l}</button>
              ))}
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-1">Nom de la source</label>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ex: Formulaire contact site web" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
            </div>

            {type==='webhook' && (
              <div className="bg-blue-50 rounded-xl p-4 mb-4">
                <h3 className="font-medium text-blue-800 text-sm mb-1 flex items-center gap-2"><Zap className="w-4 h-4"/>Comment ça fonctionne</h3>
                <p className="text-xs text-blue-600 leading-relaxed">GrowthOS génère une URL unique. Configurez cette URL comme destination webhook dans HubSpot, Typeform, JotForm, Gravity Forms, ou tout autre outil.</p>
                <p className="text-xs text-blue-500 mt-1">Payload attendu: <code>{`{"email":"...","firstName":"...","company":"..."}`}</code></p>
              </div>
            )}
            {type==='embed' && (
              <div className="bg-purple-50 rounded-xl p-4 mb-4">
                <h3 className="font-medium text-purple-800 text-sm mb-1 flex items-center gap-2"><Code className="w-4 h-4"/>Formulaire embarqué</h3>
                <p className="text-xs text-purple-600 leading-relaxed">Un snippet JavaScript à coller sur votre site. Les soumissions arrivent automatiquement dans GrowthOS comme nouveaux prospects.</p>
              </div>
            )}
            {type==='zapier' && (
              <div className="bg-orange-50 rounded-xl p-4 mb-4">
                <h3 className="font-medium text-orange-800 text-sm mb-1 flex items-center gap-2"><Link className="w-4 h-4"/>Zapier / Make</h3>
                <p className="text-xs text-orange-600 leading-relaxed">Connectez 5000+ apps via Zapier ou Make. Utilisez l'action "Créer un webhook" et pointez vers l'URL GrowthOS.</p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Annuler</button>
              <button onClick={create} disabled={!name||saving} className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                {saving?<Loader2 className="w-4 h-4 animate-spin"/>:<CheckCircle className="w-4 h-4"/>}Créer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function InboundPage() {
  const router = useRouter();
  const [forms, setForms] = useState(MOCK_FORMS);
  const [showNew, setShowNew] = useState(false);
  const [showToken, setShowToken] = useState<string|null>(null);
  const [copied, setCopied] = useState<string|null>(null);

  const copy = (id:string, text:string) => { navigator.clipboard.writeText(text); setCopied(id); setTimeout(()=>setCopied(null),2000); };
  const toggle = (id:string) => setForms(f=>f.map(x=>x.id===id?{...x,status:x.status==='active'?'paused':'active'}:x));
  const del = (id:string) => setForms(f=>f.filter(x=>x.id!==id));

  const totalSub = forms.reduce((s,f)=>s+f.submissions,0);
  const totalConv = forms.reduce((s,f)=>s+f.conversions,0);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {showNew && <NewSourceModal apiUrl={API_URL} onClose={()=>setShowNew(false)}/>}

      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Inbound</h1>
          <p className="text-sm text-gray-400">Captez vos leads depuis formulaires, webhooks et intégrations</p></div>
        <button onClick={()=>setShowNew(true)} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700">
          <Plus className="w-4 h-4"/>Nouvelle source
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          {label:'Sources actives', value:forms.filter(f=>f.status==='active').length, icon:<Globe className="w-5 h-5"/>, color:'text-blue-600 bg-blue-50'},
          {label:'Soumissions totales', value:totalSub, icon:<Download className="w-5 h-5"/>, color:'text-teal-600 bg-teal-50'},
          {label:'Leads convertis', value:totalConv, icon:<CheckCircle className="w-5 h-5"/>, color:'text-green-600 bg-green-50'},
          {label:'Taux conversion', value:`${totalSub>0?Math.round(totalConv/totalSub*100):0}%`, icon:<BarChart2 className="w-5 h-5"/>, color:'text-purple-600 bg-purple-50'},
        ].map((s,i)=>(
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>{s.icon}</div>
            <div><div className="text-2xl font-bold text-gray-900">{s.value}</div><div className="text-xs text-gray-400">{s.label}</div></div>
          </div>
        ))}
      </div>

      {/* Sources */}
      <h2 className="font-semibold text-gray-900 mb-3">Sources de leads</h2>
      <div className="space-y-3 mb-6">
        {forms.map(form=>(
          <div key={form.id} className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0"><Globe className="w-5 h-5"/></div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-0.5">
                  <h3 className="font-semibold text-gray-900">{form.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${form.status==='active'?'bg-green-50 text-green-600':'bg-amber-50 text-amber-600'}`}>{form.status}</span>
                </div>
                <p className="text-xs text-gray-400">{form.source}</p>
                {/* URL webhook */}
                <div className="flex items-center gap-2 mt-2">
                  <code className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg font-mono truncate max-w-xs">
                    {showToken===form.id ? `${API_URL}/api/v1/inbound/webhook/${form.embedToken}` : `${API_URL}/api/v1/inbound/webhook/●●●●●●`}
                  </code>
                  <button onClick={()=>setShowToken(showToken===form.id?null:form.id)} className="text-gray-300 hover:text-gray-500">
                    {showToken===form.id?<EyeOff className="w-3.5 h-3.5"/>:<Eye className="w-3.5 h-3.5"/>}
                  </button>
                  <button onClick={()=>copy(form.id,`${API_URL}/api/v1/inbound/webhook/${form.embedToken}`)} className="text-gray-300 hover:text-teal-600">
                    {copied===form.id?<CheckCircle className="w-3.5 h-3.5 text-teal-600"/>:<Copy className="w-3.5 h-3.5"/>}
                  </button>
                </div>
              </div>
              <div className="flex gap-6 text-sm">
                <div className="text-center"><div className="font-bold text-gray-900">{form.submissions}</div><div className="text-xs text-gray-400">Soumissions</div></div>
                <div className="text-center"><div className="font-bold text-green-600">{form.conversions}</div><div className="text-xs text-gray-400">Convertis</div></div>
                <div className="text-center"><div className="font-bold text-teal-600">{Math.round(form.conversions/form.submissions*100)}%</div><div className="text-xs text-gray-400">Taux</div></div>
              </div>
              <div className="flex gap-2">
                <button onClick={()=>toggle(form.id)} className={`px-3 py-1.5 rounded-xl text-sm ${form.status==='active'?'bg-amber-50 text-amber-600':'bg-green-50 text-green-600'}`}>
                  {form.status==='active'?'Pause':'Activer'}
                </button>
                <button onClick={()=>del(form.id)} className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-xl"><Trash2 className="w-4 h-4"/></button>
              </div>
            </div>
          </div>
        ))}
        {forms.length===0&&(
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
            <Globe className="w-10 h-10 text-gray-200 mx-auto mb-3"/>
            <p className="text-gray-400 text-sm">Aucune source de leads</p>
            <button onClick={()=>setShowNew(true)} className="mt-3 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm">Créer la première</button>
          </div>
        )}
      </div>

      {/* Comment ça marche */}
      <div className="bg-teal-50 border border-teal-100 rounded-2xl p-5">
        <h3 className="font-semibold text-teal-800 mb-3 flex items-center gap-2"><Zap className="w-4 h-4"/>Comment les leads entrent dans GrowthOS</h3>
        <div className="grid grid-cols-4 gap-4">
          {[
            {icon:'🌐',step:'1',title:'Formulaire soumis',desc:'Visiteur remplit votre formulaire sur n\'importe quel outil'},
            {icon:'⚡',step:'2',title:'Webhook déclenché',desc:'Votre outil envoie les données à votre URL GrowthOS'},
            {icon:'👤',step:'3',title:'Prospect créé',desc:'GrowthOS crée automatiquement un prospect enrichi'},
            {icon:'🤖',step:'4',title:'Plugins activés',desc:'SEO Analyzer et CRM Enricher s\'exécutent automatiquement'},
          ].map((s,i)=>(
            <div key={i} className="bg-white rounded-xl p-4">
              <div className="text-2xl mb-2">{s.icon}</div>
              <div className="font-medium text-gray-900 text-sm mb-1">{s.step}. {s.title}</div>
              <div className="text-xs text-gray-500 leading-relaxed">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
