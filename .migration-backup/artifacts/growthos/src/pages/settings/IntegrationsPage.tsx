import { useState } from 'react';
import { CheckCircle, Link as LinkIcon, Settings, X, ExternalLink, Loader2, RefreshCw, AlertCircle, Zap } from 'lucide-react';
import { toast } from 'sonner';

type Integration = {
  id: string;
  name: string;
  desc: string;
  logo: string;
  category: string;
  connected: boolean;
  syncedAt?: string;
  syncCount?: number;
  config?: Record<string,string>;
  configFields?: { key:string; label:string; type?:string; placeholder:string; required?:boolean }[];
  oauthUrl?: string;
};

const INTEGRATIONS: Integration[] = [
  {
    id:'hubspot', name:'HubSpot', desc:'Sync bidirectionnel CRM — contacts, deals, activités', logo:'🟠', category:'CRM',
    connected:false, configFields:[
      {key:'portal_id',label:'Portal ID',placeholder:'12345678',required:true},
      {key:'api_key',label:'Clé API HubSpot',placeholder:'pat-eu1-xxxxxxxx',required:true},
    ],
  },
  {
    id:'salesforce', name:'Salesforce', desc:'Import/export leads et opportunités', logo:'☁️', category:'CRM',
    connected:false, oauthUrl:'#', configFields:[
      {key:'instance_url',label:'URL Instance',placeholder:'https://mycompany.salesforce.com',required:true},
      {key:'token',label:'Access Token',placeholder:'00Dxxxxxxxxx...',required:true},
    ],
  },
  {
    id:'gmail', name:'Gmail', desc:"Envoi d'emails depuis votre boîte Gmail", logo:'📧', category:'Email',
    connected:true, syncedAt:'il y a 5 min', syncCount:1247, config:{email:'admin@acme.fr'},
    configFields:[{key:'email',label:'Compte Gmail',placeholder:'vous@gmail.com',required:true}],
  },
  {
    id:'outlook', name:'Outlook', desc:'Synchronisation calendrier et emails', logo:'📨', category:'Email',
    connected:false, oauthUrl:'#', configFields:[
      {key:'email',label:'Email Outlook',placeholder:'vous@outlook.com',required:true},
    ],
  },
  {
    id:'slack', name:'Slack', desc:'Notifications en temps réel dans vos channels', logo:'💬', category:'Notifications',
    connected:true, syncedAt:'il y a 1h', syncCount:89, config:{channel:'#growthos-alerts'},
    configFields:[
      {key:'webhook_url',label:'Webhook URL Slack',placeholder:'https://hooks.slack.com/services/...',required:true},
      {key:'channel',label:'Channel par défaut',placeholder:'#sales-alerts'},
    ],
  },
  {
    id:'zapier', name:'Zapier', desc:'Connectez GrowthOS à 5000+ apps', logo:'⚡', category:'Automation',
    connected:false, configFields:[
      {key:'webhook_key',label:'Clé Zapier',placeholder:'Générée depuis votre compte Zapier'},
    ],
  },
  {
    id:'linkedin', name:'LinkedIn Sales Navigator', desc:'Import de leads et enrichissement', logo:'💼', category:'Prospecting',
    connected:false, configFields:[
      {key:'token',label:'Access Token',placeholder:'AQV...',required:true},
      {key:'org_id',label:'Organization ID',placeholder:'12345'},
    ],
  },
  {
    id:'stripe', name:'Stripe', desc:'Suivi des paiements et revenus clients', logo:'💳', category:'Finance',
    connected:false, configFields:[
      {key:'secret_key',label:'Secret Key',type:'password',placeholder:'sk_live_...',required:true},
      {key:'webhook_secret',label:'Webhook Secret',placeholder:'whsec_...',required:true},
    ],
  },
  {
    id:'hunter', name:'Hunter.io', desc:'Trouve et vérifie les emails professionnels', logo:'🎯', category:'Prospecting',
    connected:false, configFields:[
      {key:'api_key',label:'Clé API Hunter',placeholder:'xxxxxxxxxxxxxxxx',required:true},
    ],
  },
  {
    id:'clearbit', name:'Clearbit', desc:'Enrichissement automatique des prospects', logo:'🔍', category:'Enrichment',
    connected:false, configFields:[
      {key:'api_key',label:'Clé API Clearbit',placeholder:'sk_...',required:true},
    ],
  },
];

const CATEGORIES = ['Tous','CRM','Email','Notifications','Automation','Prospecting','Finance','Enrichment'];

function ConfigModal({ integration, onClose, onSave }: { integration:Integration; onClose:()=>void; onSave:(config:Record<string,string>)=>void }) {
  const [config, setConfig] = useState<Record<string,string>>(integration.config || {});
  const [saving, setSaving] = useState(false);
  const [showVals, setShowVals] = useState<Record<string,boolean>>({});

  const set = (k:string,v:string) => setConfig(c=>({...c,[k]:v}));

  const save = async () => {
    const required = (integration.configFields||[]).filter(f=>f.required);
    for (const f of required) {
      if (!config[f.key]?.trim()) { toast.error(`${f.label} est requis`); return; }
    }
    setSaving(true);
    await new Promise(r=>setTimeout(r,900));
    onSave(config);
    setSaving(false);
    onClose();
    toast.success(`${integration.name} connecté avec succès`);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-2xl">{integration.logo}</div>
            <div>
              <h2 className="text-base font-bold text-gray-900">{integration.name}</h2>
              <p className="text-xs text-gray-400">{integration.connected?'Modifier la configuration':'Connexion'}</p>
            </div>
          </div>
          <button onClick={onClose}><X size={18} className="text-gray-400"/></button>
        </div>

        <div className="p-6">
          {integration.oauthUrl && !integration.connected && (
            <button onClick={()=>toast.info('Redirection OAuth... (simulation)')}
              className="w-full mb-4 py-2.5 border-2 border-blue-300 rounded-xl text-sm font-medium text-blue-700 bg-blue-50 flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors">
              <ExternalLink size={14}/>Se connecter via OAuth
            </button>
          )}

          <div className="space-y-3 mb-5">
            {(integration.configFields||[]).map(f=>{
              const isPassword = f.type === 'password';
              const shown = showVals[f.key];
              return (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}{f.required&&<span className="text-red-400 ml-0.5">*</span>}</label>
                  <div className="relative">
                    <input
                      type={isPassword&&!shown?'password':'text'}
                      value={config[f.key]||''} onChange={e=>set(f.key,e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder={f.placeholder}/>
                    {isPassword && (
                      <button onClick={()=>setShowVals(s=>({...s,[f.key]:!s[f.key]}))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        <span className="text-xs">{shown?'Cacher':'Voir'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Annuler</button>
            <button onClick={save} disabled={saving}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
              {saving?<><Loader2 size={14} className="animate-spin"/>Connexion...</>:<><CheckCircle size={14}/>{integration.connected?'Mettre à jour':'Connecter'}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState(INTEGRATIONS);
  const [category, setCategory] = useState('Tous');
  const [configuring, setConfiguring] = useState<Integration|null>(null);
  const [syncing, setSyncing] = useState<string|null>(null);

  const filtered = integrations.filter(i=>category==='Tous'||i.category===category);
  const connected = integrations.filter(i=>i.connected).length;

  const disconnect = (id:string, name:string) => {
    if (!confirm(`Déconnecter ${name} ?`)) return;
    setIntegrations(ints=>ints.map(i=>i.id===id?{...i,connected:false,syncedAt:undefined,syncCount:undefined,config:undefined}:i));
    toast.success(`${name} déconnecté`);
  };

  const syncNow = async (id:string) => {
    setSyncing(id);
    await new Promise(r=>setTimeout(r,1500));
    setIntegrations(ints=>ints.map(i=>i.id===id?{...i,syncedAt:'à l\'instant',syncCount:(i.syncCount||0)+Math.floor(Math.random()*20)+1}:i));
    setSyncing(null);
    toast.success('Synchronisation effectuée');
  };

  const handleSave = (id:string, config:Record<string,string>) => {
    setIntegrations(ints=>ints.map(i=>i.id===id?{...i,connected:true,config,syncedAt:'à l\'instant',syncCount:0}:i));
  };

  return (
    <div className="min-h-screen p-6" style={{background:'var(--body-bg)'}}>
      {configuring && (
        <ConfigModal
          integration={configuring}
          onClose={()=>setConfiguring(null)}
          onSave={config=>{ handleSave(configuring.id,config); setConfiguring(null); }}
        />
      )}

      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
        <h1 style={{fontSize:22,fontWeight:700,color:'var(--text-primary)',margin:0}}>Intégrations</h1>
        <div style={{display:'flex',alignItems:'center',gap:6,padding:'6px 14px',borderRadius:10,background:'#ECFDF5',border:'1px solid #D1FAE5'}}>
          <CheckCircle size={13} color="#059669"/>
          <span style={{fontSize:13,fontWeight:600,color:'#059669'}}>{connected} connectée{connected>1?'s':''}</span>
        </div>
      </div>
      <p style={{fontSize:14,color:'var(--text-muted)',marginBottom:24}}>{connected} sur {integrations.length} intégrations disponibles</p>

      {/* Category tabs */}
      <div style={{display:'flex',gap:6,marginBottom:20,flexWrap:'wrap'}}>
        {CATEGORIES.map(c=>(
          <button key={c} onClick={()=>setCategory(c)}
            style={{padding:'6px 14px',borderRadius:10,border:'none',fontSize:13,fontWeight:500,cursor:'pointer',
              background:category===c?'var(--color-primary)':'var(--card-bg)',
              color:category===c?'#fff':'var(--text-secondary)',
              boxShadow:category===c?'none':'0 0 0 1px var(--card-border)'}}>
            {c}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(290px,1fr))',gap:14}}>
        {filtered.map(intg=>(
          <div key={intg.id} style={{borderRadius:16,border:`1.5px solid ${intg.connected?'var(--color-primary)':'var(--card-border)'}`,background:'var(--card-bg)',padding:18,transition:'all .15s',position:'relative'}}
            onMouseEnter={e=>{if(!intg.connected)(e.currentTarget as HTMLElement).style.borderColor='var(--text-muted)';}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor=intg.connected?'var(--color-primary)':'var(--card-border)';}}>

            {intg.connected && (
              <div style={{position:'absolute',top:12,right:12,width:8,height:8,borderRadius:'50%',background:'#10B981',boxShadow:'0 0 0 2px #D1FAE5'}}/>
            )}

            <div style={{display:'flex',alignItems:'flex-start',gap:12,marginBottom:14}}>
              <div style={{width:44,height:44,borderRadius:10,background:'var(--body-bg)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>{intg.logo}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
                  <h3 style={{fontWeight:600,fontSize:14,color:'var(--text-primary)',margin:0}}>{intg.name}</h3>
                </div>
                <p style={{fontSize:12,color:'var(--text-muted)',margin:0,lineHeight:1.5}}>{intg.desc}</p>
                {intg.connected && intg.syncedAt && (
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>
                    Sync : {intg.syncedAt} · {intg.syncCount||0} éléments
                  </div>
                )}
              </div>
            </div>

            <div style={{display:'flex',gap:8}}>
              {intg.connected ? (
                <>
                  <button onClick={()=>syncNow(intg.id)} disabled={syncing===intg.id}
                    style={{flex:1,padding:'7px',borderRadius:10,border:'1px solid var(--card-border)',background:'var(--body-bg)',color:'var(--text-secondary)',fontSize:13,fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:5,opacity:syncing===intg.id?0.6:1}}>
                    {syncing===intg.id?<Loader2 size={12} className="animate-spin"/>:<RefreshCw size={12}/>}Sync
                  </button>
                  <button onClick={()=>setConfiguring(intg)}
                    style={{padding:'7px 10px',borderRadius:10,border:'1px solid var(--card-border)',background:'var(--body-bg)',color:'var(--text-secondary)',cursor:'pointer',display:'flex',alignItems:'center'}}>
                    <Settings size={13}/>
                  </button>
                  <button onClick={()=>disconnect(intg.id,intg.name)}
                    style={{padding:'7px 10px',borderRadius:10,border:'1px solid #FEE2E2',background:'#FEF2F2',color:'#EF4444',cursor:'pointer',display:'flex',alignItems:'center',fontSize:12}}>
                    Déconnecter
                  </button>
                </>
              ) : (
                <button onClick={()=>setConfiguring(intg)}
                  style={{flex:1,padding:'8px',borderRadius:10,border:'1px solid var(--card-border)',background:'var(--body-bg)',color:'var(--text-secondary)',fontSize:13,fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6,transition:'all .15s'}}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='var(--color-primary)';(e.currentTarget as HTMLElement).style.color='#fff';(e.currentTarget as HTMLElement).style.borderColor='var(--color-primary)';}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='var(--body-bg)';(e.currentTarget as HTMLElement).style.color='var(--text-secondary)';(e.currentTarget as HTMLElement).style.borderColor='var(--card-border)';}}>
                  <LinkIcon size={13}/>Connecter
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
