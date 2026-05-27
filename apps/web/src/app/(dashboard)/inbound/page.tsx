'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Globe, Zap, Plus, BarChart2, CheckCircle, X, Loader2, Copy, Eye, EyeOff, Trash2, Code, Link, ChevronRight, AlertCircle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL||'';
const MOCK_FORMS = [
  {id:'1',name:'Formulaire Contact Site',source:'le-publicitaire.fr',submissions:47,conversions:12,status:'active',embedToken:'tok_abc123'},
  {id:'2',name:'Landing SEO Audit',source:'audit.le-publicitaire.fr',submissions:23,conversions:8,status:'active',embedToken:'tok_def456'},
  {id:'3',name:'Webinar Inscription',source:'calendly.com',submissions:89,conversions:34,status:'paused',embedToken:'tok_ghi789'},
];

function NewSourceModal({ onClose, onSave }: any) {
  const [type, setType] = useState<'webhook'|'embed'|'zapier'>('webhook');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string|null>(null);

  const create = async () => {
    if (!name) return;
    setSaving(true);
    await new Promise(r=>setTimeout(r,700));
    const token = `tok_${Math.random().toString(36).slice(2,12)}`;
    setResult(token);
    onSave({id:Date.now().toString(),name,source:type,submissions:0,conversions:0,status:'active',embedToken:token});
    setSaving(false);
  };

  const webhookUrl = `${API_URL}/api/v1/inbound/webhook/${result||'[TOKEN]'}`;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="rounded-2xl w-full max-w-md p-6 shadow-2xl" style={{background:'var(--card-bg)'}}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold" style={{color:'var(--text-primary)'}}>Nouvelle source de leads</h2>
          <button onClick={onClose} style={{color:'var(--text-muted)'}}><X className="w-5 h-5"/></button>
        </div>
        {result ? (
          <>
            <div className="flex items-center gap-3 rounded-xl p-4 mb-4" style={{background:'var(--color-primary-light)'}}>
              <CheckCircle className="w-8 h-8" style={{color:'var(--color-primary)'}}/>
              <div><div className="font-bold" style={{color:'var(--color-primary)'}}>{name} créé ✓</div></div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium mb-1" style={{color:'var(--text-muted)'}}>URL Webhook</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs px-3 py-2.5 rounded-xl truncate" style={{background:'var(--body-bg)',color:'var(--text-secondary)'}}>{webhookUrl}</code>
                <button onClick={()=>navigator.clipboard.writeText(webhookUrl)} className="p-2 rounded-lg" style={{color:'var(--color-primary)'}}><Copy className="w-4 h-4"/></button>
              </div>
            </div>
            <button onClick={onClose} className="w-full py-2.5 rounded-xl text-sm font-medium text-white" style={{background:'var(--color-primary)'}}>Fermer</button>
          </>
        ) : (
          <>
            <div className="flex gap-1 p-1 rounded-xl mb-4" style={{background:'var(--body-bg)'}}>
              {[{k:'webhook',l:'Webhook'},{k:'embed',l:'Formulaire'},{k:'zapier',l:'Zapier/Make'}].map(t=>(
                <button key={t.k} onClick={()=>setType(t.k as any)} className="flex-1 py-2 rounded-lg text-sm font-medium" style={type===t.k?{background:'var(--color-primary)',color:'#fff'}:{color:'var(--text-muted)'}}>
                  {t.l}
                </button>
              ))}
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium mb-1" style={{color:'var(--text-muted)'}}>Nom de la source</label>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ex: Formulaire contact site" className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none" style={{borderColor:'var(--card-border)',background:'var(--body-bg)',color:'var(--text-primary)'}}/>
            </div>
            <div className="rounded-xl p-3 mb-4" style={{background:'var(--color-primary-light)'}}>
              <p className="text-xs" style={{color:'var(--color-primary)'}}>
                {type==='webhook'?'Une URL unique sera générée. Configurez-la comme destination dans votre outil (HubSpot, Typeform, JotForm...).'
                :type==='embed'?'Un snippet JS à intégrer sur votre site. Les soumissions arrivent automatiquement dans GrowthOS.'
                :'Connectez via Zapier ou Make à 5000+ apps.'}
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm" style={{borderColor:'var(--card-border)',color:'var(--text-secondary)'}}>Annuler</button>
              <button onClick={create} disabled={!name||saving} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{background:'var(--color-primary)'}}>
                {saving?<Loader2 className="w-4 h-4 animate-spin inline"/>:'Créer'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SourceDetail({ form, onClose, onUpdate, onDelete }: any) {
  const [show, setShow] = useState(false);
  const webhookUrl = `${API_URL}/api/v1/inbound/webhook/${form.embedToken}`;
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(webhookUrl); setCopied(true); setTimeout(()=>setCopied(false),2000); };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="rounded-2xl w-full max-w-lg p-6 shadow-2xl" style={{background:'var(--card-bg)'}}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold" style={{color:'var(--text-primary)'}}>{form.name}</h2>
          <button onClick={onClose} style={{color:'var(--text-muted)'}}><X className="w-5 h-5"/></button>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[{l:'Soumissions',v:form.submissions},{l:'Convertis',v:form.conversions},{l:'Taux',v:`${form.submissions>0?Math.round(form.conversions/form.submissions*100):0}%`}].map((s,i)=>(
            <div key={i} className="text-center rounded-xl p-3" style={{background:'var(--body-bg)'}}>
              <div className="text-xl font-bold" style={{color:'var(--color-primary)'}}>{s.v}</div>
              <div className="text-xs" style={{color:'var(--text-muted)'}}>{s.l}</div>
            </div>
          ))}
        </div>
        <div className="mb-4">
          <label className="block text-xs font-medium mb-2" style={{color:'var(--text-muted)'}}>URL Webhook</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs px-3 py-2.5 rounded-xl truncate" style={{background:'var(--body-bg)',color:'var(--text-secondary)'}}>
              {show?webhookUrl:`${API_URL}/api/v1/inbound/webhook/●●●●●●`}
            </code>
            <button onClick={()=>setShow(s=>!s)} style={{color:'var(--text-muted)'}}>{show?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}</button>
            <button onClick={copy} style={{color:copied?'var(--color-primary)':'var(--text-muted)'}}>{copied?<CheckCircle className="w-4 h-4"/>:<Copy className="w-4 h-4"/>}</button>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={()=>{onDelete(form.id);onClose();}} className="px-4 py-2.5 bg-red-50 text-red-500 rounded-xl text-sm"><Trash2 className="w-4 h-4 inline mr-1"/>Supprimer</button>
          <button onClick={()=>{onUpdate(form.id,{status:form.status==='active'?'paused':'active'});onClose();}}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium ${form.status==='active'?'bg-amber-50 text-amber-600':'bg-green-50 text-green-600'}`}>
            {form.status==='active'?'Mettre en pause':'Activer'}
          </button>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white" style={{background:'var(--color-primary)'}}>Fermer</button>
        </div>
      </div>
    </div>
  );
}

export default function InboundPage() {
  const searchParams = useSearchParams();
  const [forms, setForms] = useState(MOCK_FORMS);
  const [showNew, setShowNew] = useState(searchParams.get('new')==='1');
  const [selected, setSelected] = useState<any>(null);

  const total = {sub:forms.reduce((s,f)=>s+f.submissions,0), conv:forms.reduce((s,f)=>s+f.conversions,0)};

  return (
    <div className="min-h-screen p-6" style={{background:'var(--body-bg)'}}>
      {showNew&&<NewSourceModal onClose={()=>setShowNew(false)} onSave={(f:any)=>{setForms(p=>[...p,f]);setShowNew(false);}}/>}
      {selected&&<SourceDetail form={selected} onClose={()=>setSelected(null)}
        onUpdate={(id:string,patch:any)=>setForms(fs=>fs.map(f=>f.id===id?{...f,...patch}:f))}
        onDelete={(id:string)=>setForms(fs=>fs.filter(f=>f.id!==id))}/>}

      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>Inbound</h1>
          <p className="text-sm" style={{color:'var(--text-muted)'}}>Cliquez sur une source pour voir les détails</p></div>
        <button onClick={()=>setShowNew(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{background:'var(--color-primary)'}}>
          <Plus className="w-4 h-4"/>Nouvelle source
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[{l:'Sources actives',v:forms.filter(f=>f.status==='active').length},{l:'Soumissions',v:total.sub},{l:'Convertis',v:total.conv},{l:'Taux',v:`${total.sub>0?Math.round(total.conv/total.sub*100):0}%`}].map((s,i)=>(
          <div key={i} className="rounded-2xl border p-4 flex items-center gap-3" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:'var(--color-primary-light)',color:'var(--color-primary)'}}>{[<Globe className="w-5 h-5"/>,<BarChart2 className="w-5 h-5"/>,<CheckCircle className="w-5 h-5"/>,<Zap className="w-5 h-5"/>][i]}</div>
            <div><div className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>{s.v}</div><div className="text-xs" style={{color:'var(--text-muted)'}}>{s.l}</div></div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {forms.map(form=>(
          <div key={form.id} onClick={()=>setSelected(form)}
            className="rounded-2xl border p-5 flex items-center gap-4 cursor-pointer hover:shadow-md transition-all"
            style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}
            onMouseEnter={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--color-primary)'}
            onMouseLeave={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--card-border)'}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:'var(--color-primary-light)',color:'var(--color-primary)'}}><Globe className="w-5 h-5"/></div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-sm" style={{color:'var(--text-primary)'}}>{form.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${form.status==='active'?'bg-green-50 text-green-600':'bg-amber-50 text-amber-600'}`}>{form.status}</span>
              </div>
              <p className="text-xs" style={{color:'var(--text-muted)'}}>{form.source}</p>
              <div className="flex gap-5 mt-1 text-xs" style={{color:'var(--text-muted)'}}>
                <span>{form.submissions} soumissions</span><span>{form.conversions} convertis</span>
                <span>{form.submissions>0?Math.round(form.conversions/form.submissions*100):0}% taux</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4" style={{color:'var(--text-muted)'}}/>
          </div>
        ))}
      </div>
    </div>
  );
}
