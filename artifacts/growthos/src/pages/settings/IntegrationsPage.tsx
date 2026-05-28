import { useState } from 'react';
import { CheckCircle, Link as LinkIcon, Settings } from 'lucide-react';

const INTEGRATIONS = [
  { id:'hubspot', name:'HubSpot', desc:'Sync bidirectionnel CRM — contacts, deals, activités', logo:'🟠', category:'CRM', connected:false },
  { id:'salesforce', name:'Salesforce', desc:'Import/export leads et opportunités', logo:'☁️', category:'CRM', connected:false },
  { id:'gmail', name:'Gmail', desc:"Envoi d'emails depuis votre boîte Gmail", logo:'📧', category:'Email', connected:true },
  { id:'outlook', name:'Outlook', desc:'Synchronisation calendrier et emails', logo:'📨', category:'Email', connected:false },
  { id:'slack', name:'Slack', desc:'Notifications en temps réel dans vos channels', logo:'💬', category:'Notifications', connected:true },
  { id:'zapier', name:'Zapier', desc:'Connectez GrowthOS à 5000+ apps', logo:'⚡', category:'Automation', connected:false },
  { id:'linkedin', name:'LinkedIn Sales Navigator', desc:'Import de leads et enrichissement', logo:'💼', category:'Prospecting', connected:false },
  { id:'stripe', name:'Stripe', desc:'Suivi des paiements et revenus clients', logo:'💳', category:'Finance', connected:false },
];

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState(INTEGRATIONS);
  const [category, setCategory] = useState('Tous');
  const cats = ['Tous', ...Array.from(new Set(INTEGRATIONS.map(i => i.category)))];
  const filtered = integrations.filter(i => category === 'Tous' || i.category === category);
  const toggle = (id: string) => setIntegrations(ints => ints.map(i => i.id===id ? {...i,connected:!i.connected} : i));

  return (
    <div className="min-h-screen p-6" style={{background:'var(--body-bg)'}}>
      <h1 style={{fontSize:22,fontWeight:700,color:'var(--text-primary)',marginBottom:4}}>Intégrations</h1>
      <p style={{fontSize:14,color:'var(--text-muted)',marginBottom:24}}>{integrations.filter(i=>i.connected).length} connectées sur {integrations.length} disponibles</p>

      <div style={{display:'flex',gap:8,marginBottom:24,flexWrap:'wrap'}}>
        {cats.map(c=>(
          <button key={c} onClick={()=>setCategory(c)}
            style={{padding:'6px 14px',borderRadius:10,border:'none',fontSize:13,fontWeight:500,cursor:'pointer',background:category===c?'var(--color-primary)':'var(--card-bg)',color:category===c?'#fff':'var(--text-secondary)',boxShadow:category===c?'none':'0 0 0 1px var(--card-border)'}}>
            {c}
          </button>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:16}}>
        {filtered.map(integration=>(
          <div key={integration.id} style={{borderRadius:16,border:`1px solid ${integration.connected?'var(--color-primary)':'var(--card-border)'}`,background:'var(--card-bg)',padding:20}}>
            <div style={{display:'flex',alignItems:'flex-start',gap:12,marginBottom:16}}>
              <div style={{width:44,height:44,borderRadius:10,background:'var(--body-bg)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>{integration.logo}</div>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
                  <h3 style={{fontWeight:600,fontSize:14,color:'var(--text-primary)',margin:0}}>{integration.name}</h3>
                  {integration.connected&&<CheckCircle size={14} color="var(--color-primary)"/>}
                </div>
                <p style={{fontSize:12,color:'var(--text-muted)',margin:0,lineHeight:1.5}}>{integration.desc}</p>
              </div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>toggle(integration.id)}
                style={{flex:1,padding:'8px',borderRadius:10,border:`1px solid ${integration.connected?'var(--color-primary)':'var(--card-border)'}`,background:integration.connected?'var(--color-primary-light)':'var(--body-bg)',color:integration.connected?'var(--color-primary)':'var(--text-secondary)',fontSize:13,fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                {integration.connected?<><CheckCircle size={13}/>Connecté</>:<><LinkIcon size={13}/>Connecter</>}
              </button>
              {integration.connected&&(
                <button style={{padding:'8px 12px',borderRadius:10,border:'1px solid var(--card-border)',background:'var(--body-bg)',color:'var(--text-secondary)',cursor:'pointer',display:'flex',alignItems:'center'}}>
                  <Settings size={14}/>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
