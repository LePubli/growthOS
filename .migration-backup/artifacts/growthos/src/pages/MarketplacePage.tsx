import { useState } from 'react';
import { useLocation } from 'wouter';
import { Star, Download, CheckCircle, Search, Zap, Map, Users, Mail, BarChart2, Bot, Globe, Puzzle, Shield, X, ChevronRight, TrendingUp, Clock, Filter } from 'lucide-react';

const CATEGORIES = [
  { value:'all',         label:'Tous',          icon:<Puzzle size={14}/> },
  { value:'crm',         label:'CRM',           icon:<Users size={14}/> },
  { value:'enrichment',  label:'Enrichissement', icon:<Zap size={14}/> },
  { value:'analytics',   label:'Analytics',     icon:<BarChart2 size={14}/> },
  { value:'automation',  label:'Automation',    icon:<Bot size={14}/> },
  { value:'integrations',label:'Intégrations',  icon:<Globe size={14}/> },
  { value:'security',    label:'Sécurité',      icon:<Shield size={14}/> },
];

const PLUGINS = [
  { id:'crm-map', name:'CRM Map & Tournée', slug:'crm-map', description:'Visualisez vos prospects sur une carte interactive. Planifiez vos tournées commerciales avec optimisation de trajets et zones géographiques.', longDesc:'Optimisez vos déplacements commerciaux grâce à une carte interactive avec clustering, zones de chalandise, calcul de tournée optimale (algorithme TSP) et intégration GPS. Compatible avec Google Maps et Apple Maps.', version:'1.0.0', category:'crm', rating:4.9, reviews:142, installs:3800, price:'Gratuit', icon:'🗺️', featured:true, tags:['carte','tournée','géolocalisation'], author:'GrowthOS Labs', updatedAt:'Il y a 3j', installed:true },
  { id:'linkedin-enricher', name:'LinkedIn Enricher', slug:'linkedin-enricher', description:'Enrichissement automatique des profils prospects avec données LinkedIn — poste, entreprise, ancienneté, réseau.', longDesc:'Connectez votre compte LinkedIn Sales Navigator pour enrichir automatiquement vos contacts. Mise à jour hebdomadaire, score de confiance par champ, historique des changements.', version:'2.1.0', category:'enrichment', rating:4.8, reviews:98, installs:1240, price:'29€/mois', icon:'💼', featured:true, tags:['linkedin','enrichissement'], author:'DataFlow SAS', updatedAt:'Il y a 1sem', installed:false },
  { id:'email-verifier', name:'Email Verifier Pro', slug:'email-verifier', description:'Vérifiez la délivrabilité de vos emails en temps réel avec Hunter.io, Bouncer et NeverBounce.', longDesc:'Réduisez votre taux de rebond en vérifiant chaque email avant envoi. Vérification SMTP, MX record, catch-all, disposable address detection. Score de confiance 0-100.', version:'3.0.2', category:'enrichment', rating:4.7, reviews:67, installs:890, price:'19€/mois', icon:'✉️', featured:false, tags:['email','délivrabilité'], author:'MailGuard', updatedAt:'Il y a 2sem', installed:true },
  { id:'revenue-analytics', name:'Revenue Analytics', slug:'revenue-analytics', description:'Tableaux de bord avancés sur votre performance commerciale : ARR, MRR, churn, LTV et forecasting IA.', longDesc:'Connectez votre CRM pour obtenir des métriques SaaS avancées. Segmentation par industrie, taille, géographie. Export CSV/Excel. Alertes sur seuils.', version:'1.5.0', category:'analytics', rating:4.6, reviews:54, installs:567, price:'49€/mois', icon:'📈', featured:true, tags:['analytics','revenu','SaaS'], author:'Metric Labs', updatedAt:'Il y a 5j', installed:false },
  { id:'zapier-connect', name:'Zapier Connect', slug:'zapier-connect', description:'Plus de 5 000 intégrations via Zapier. Synchronisez GrowthOS avec Slack, HubSpot, Salesforce et plus.', longDesc:'Déclenchez des zaps depuis GrowthOS : nouveau prospect, deal gagné, signal détecté. Plus de 5 000 apps compatibles. Configuration sans code en moins de 5 minutes.', version:'2.0.1', category:'integrations', rating:4.5, reviews:211, installs:4200, price:'Gratuit', icon:'⚡', featured:false, tags:['zapier','automation','intégration'], author:'Zapier Inc.', updatedAt:'Il y a 1j', installed:false },
  { id:'ai-copywriter', name:'AI Copywriter', slug:'ai-copywriter', description:'Génération automatique d\'emails de prospection personnalisés avec GPT-4. Rédaction contextuelle selon le profil du prospect.', longDesc:'Créez des emails ultra-personnalisés en 1 clic. Analyse du profil LinkedIn, actualités de l\'entreprise, signal détecté. Templates ajustables par secteur et persona.', version:'1.2.0', category:'automation', rating:4.4, reviews:39, installs:320, price:'39€/mois', icon:'🤖', featured:false, tags:['IA','copywriting','email'], author:'GrowthOS Labs', updatedAt:'Il y a 4j', installed:false },
  { id:'gdpr-shield', name:'GDPR Shield', slug:'gdpr-shield', description:'Conformité RGPD automatique : gestion des consentements, purge programmée, audit trail complet.', longDesc:'Assurez votre conformité RGPD sans effort. Gestion des droits à l\'effacement, portabilité, consentement. Audit log complet. Génération de rapports pour DPO.', version:'1.1.0', category:'security', rating:4.3, reviews:28, installs:210, price:'29€/mois', icon:'🔒', featured:false, tags:['RGPD','conformité','sécurité'], author:'LegalTech SAS', updatedAt:'Il y a 2sem', installed:false },
  { id:'slack-alerts', name:'Slack Alerts', slug:'slack-alerts', description:'Notifications Slack en temps réel sur vos prospects, deals et signaux. Configurez des alertes personnalisées.', longDesc:'Restez informé sans quitter Slack. Configurez des webhooks pour chaque événement GrowthOS. Résumé quotidien, alertes deal, notifications d\'équipe.', version:'1.0.3', category:'integrations', rating:4.8, reviews:76, installs:980, price:'Gratuit', icon:'💬', featured:false, tags:['slack','notifications'], author:'GrowthOS Labs', updatedAt:'Il y a 6j', installed:true },
  { id:'forecast-ai', name:'Forecast AI', slug:'forecast-ai', description:'Prédiction du chiffre d\'affaires pour les 3 prochains mois grâce au machine learning sur l\'historique de deals.', longDesc:'Modèle ML entraîné sur votre historique pour prédire le CA mensuel avec intervalle de confiance. Détection d\'anomalies, alertes pipeline insuffisant, recommandations automatiques.', version:'0.9.0', category:'analytics', rating:4.2, reviews:18, installs:145, price:'59€/mois', icon:'🔮', featured:false, tags:['IA','forecast','analytics'], author:'Predictive Labs', updatedAt:'Il y a 3sem', installed:false },
];

type SortKey = 'rating'|'installs'|'name'|'price';

function InstallModal({ plugin, onClose, onInstalled }: { plugin:any; onClose:()=>void; onInstalled:(id:string)=>void }) {
  const [step, setStep] = useState<'info'|'install'|'done'>('info');
  const [progress, setProgress] = useState(0);

  const install = async ()=>{
    setStep('install');
    for (let i=0;i<=100;i+=10) {
      await new Promise(r=>setTimeout(r,120));
      setProgress(i);
    }
    setStep('done');
    onInstalled(plugin.id);
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={step==='install'?undefined:onClose}>
      <div style={{ background:'var(--card-bg)', borderRadius:20, width:'100%', maxWidth:520, padding:26, boxShadow:'0 20px 60px rgba(0,0,0,.2)', maxHeight:'90vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
        {step==='info' && (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18 }}>
              <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                <div style={{ width:52, height:52, borderRadius:14, background:'var(--body-bg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, flexShrink:0 }}>{plugin.icon}</div>
                <div>
                  <h2 style={{ fontSize:18, fontWeight:700, color:'var(--text-primary)', margin:0 }}>{plugin.name}</h2>
                  <p style={{ fontSize:12, color:'var(--text-muted)', margin:'2px 0 0' }}>{plugin.author} · v{plugin.version}</p>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
                    <span style={{ fontSize:12, color:'#D97706', fontWeight:700 }}>★ {plugin.rating}</span>
                    <span style={{ fontSize:11, color:'var(--text-muted)' }}>{plugin.reviews} avis</span>
                    <span style={{ fontSize:11, color:'var(--text-muted)' }}>·</span>
                    <Download size={10} style={{ color:'var(--text-muted)' }}/>
                    <span style={{ fontSize:11, color:'var(--text-muted)' }}>{plugin.installs.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={18}/></button>
            </div>
            <p style={{ fontSize:13, color:'var(--text-secondary)', lineHeight:1.7, marginBottom:16 }}>{plugin.longDesc}</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:18 }}>
              {plugin.tags.map((t:string)=>(
                <span key={t} style={{ fontSize:11, padding:'3px 9px', borderRadius:8, background:'var(--body-bg)', border:'1px solid var(--card-border)', color:'var(--text-muted)' }}>#{t}</span>
              ))}
            </div>
            <div style={{ padding:'12px 14px', borderRadius:12, background:'var(--body-bg)', border:'1px solid var(--card-border)', marginBottom:16, display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:13, color:'var(--text-muted)' }}>Prix</span>
              <span style={{ fontSize:14, fontWeight:800, color:plugin.price==='Gratuit'?'#059669':'var(--color-primary)' }}>{plugin.price}</span>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={onClose} style={{ flex:1, padding:'10px', borderRadius:10, border:'1px solid var(--card-border)', background:'transparent', color:'var(--text-secondary)', fontSize:13, cursor:'pointer' }}>Fermer</button>
              <button onClick={install} style={{ flex:2, padding:'10px', borderRadius:10, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                <Download size={14}/>Installer {plugin.price!=='Gratuit'?`· ${plugin.price}`:'gratuitement'}
              </button>
            </div>
          </>
        )}
        {step==='install' && (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <div style={{ fontSize:40, marginBottom:14 }}>{plugin.icon}</div>
            <h3 style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)', marginBottom:6 }}>Installation en cours…</h3>
            <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:20 }}>Téléchargement et configuration de {plugin.name}</p>
            <div style={{ height:8, borderRadius:9999, background:'var(--card-border)', overflow:'hidden', marginBottom:8 }}>
              <div style={{ height:'100%', width:`${progress}%`, background:'var(--color-primary)', borderRadius:9999, transition:'width .15s' }}/>
            </div>
            <span style={{ fontSize:12, color:'var(--color-primary)', fontWeight:700 }}>{progress}%</span>
          </div>
        )}
        {step==='done' && (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <div style={{ width:60, height:60, borderRadius:'50%', background:'#ECFDF5', margin:'0 auto 14px', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <CheckCircle size={30} style={{ color:'#059669' }}/>
            </div>
            <h3 style={{ fontSize:17, fontWeight:700, color:'var(--text-primary)', marginBottom:6 }}>Installation réussie !</h3>
            <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:20 }}>{plugin.name} est maintenant actif dans votre espace.</p>
            <button onClick={onClose} style={{ padding:'9px 24px', borderRadius:10, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>Accéder au plugin</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  const [, navigate]  = useLocation();
  const [category, setCategory] = useState('all');
  const [search, setSearch]     = useState('');
  const [sortBy, setSortBy]     = useState<SortKey>('installs');
  const [installed, setInstalled] = useState<Set<string>>(new Set(PLUGINS.filter(p=>p.installed).map(p=>p.id)));
  const [modal, setModal]       = useState<any>(null);

  const filtered = PLUGINS
    .filter(p=>(category==='all'||p.category===category)&&(!search||p.name.toLowerCase().includes(search.toLowerCase())||p.description.toLowerCase().includes(search.toLowerCase())||p.tags.some((t:string)=>t.includes(search.toLowerCase()))))
    .sort((a,b)=>{
      if (sortBy==='rating') return b.rating-a.rating;
      if (sortBy==='installs') return b.installs-a.installs;
      if (sortBy==='name') return a.name.localeCompare(b.name);
      return 0;
    });

  const featured = PLUGINS.filter(p=>p.featured&&(category==='all'||p.category===category));
  const installedCount = installed.size;

  return (
    <div style={{ minHeight:'100vh', padding:24, background:'var(--body-bg)' }}>
      {modal && <InstallModal plugin={modal} onClose={()=>setModal(null)} onInstalled={id=>{ setInstalled(s=>new Set([...s,id])); }}/>}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'var(--text-primary)', margin:0 }}>Marketplace</h1>
          <p style={{ fontSize:13, color:'var(--text-muted)', margin:'2px 0 0' }}>{PLUGINS.length} plugins disponibles · {installedCount} installé{installedCount>1?'s':''}</p>
        </div>
        <button onClick={()=>navigate('/plugins')} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:10, border:'1px solid var(--card-border)', background:'var(--card-bg)', color:'var(--text-secondary)', fontSize:13, cursor:'pointer' }}>
          Mes plugins installés <ChevronRight size={13}/>
        </button>
      </div>

      {/* Stats strip */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:10, marginBottom:20 }}>
        {[
          { l:'Installés',     v:installedCount,                              color:'#059669', bg:'#ECFDF5', icon:<CheckCircle size={14}/> },
          { l:'Gratuits',      v:PLUGINS.filter(p=>p.price==='Gratuit').length, color:'#2563EB', bg:'#EFF6FF', icon:<Download size={14}/> },
          { l:'Plugins IA',    v:PLUGINS.filter(p=>p.tags.includes('IA')).length, color:'#7C3AED', bg:'#EDE9FE', icon:<Bot size={14}/> },
          { l:'Total installs',v:'10k+',                                      color:'#D97706', bg:'#FEF3C7', icon:<TrendingUp size={14}/> },
        ].map((k,i)=>(
          <div key={i} style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:12, padding:'11px 14px', display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:30, height:30, borderRadius:8, background:k.bg, color:k.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{k.icon}</div>
            <div>
              <div style={{ fontSize:17, fontWeight:800, color:'var(--text-primary)' }}>{k.v}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>{k.l}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + sort */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, minWidth:220 }}>
          <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un plugin..."
            style={{ width:'100%', padding:'9px 12px 9px 36px', borderRadius:11, border:'1px solid var(--card-border)', background:'var(--card-bg)', color:'var(--text-primary)', fontSize:13, outline:'none', boxSizing:'border-box' }}/>
        </div>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value as SortKey)}
          style={{ padding:'9px 12px', borderRadius:11, border:'1px solid var(--card-border)', background:'var(--card-bg)', color:'var(--text-secondary)', fontSize:13, outline:'none' }}>
          <option value="installs">Trier : Popularité</option>
          <option value="rating">Trier : Note</option>
          <option value="name">Trier : Nom A-Z</option>
        </select>
      </div>

      {/* Category pills */}
      <div style={{ display:'flex', gap:6, marginBottom:20, flexWrap:'wrap' }}>
        {CATEGORIES.map(c=>(
          <button key={c.value} onClick={()=>setCategory(c.value)}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 14px', borderRadius:10, border:'none', fontSize:12, fontWeight:500, cursor:'pointer', transition:'all .15s',
              background:category===c.value?'var(--color-primary)':'var(--card-bg)',
              color:category===c.value?'#fff':'var(--text-muted)',
              outline:category===c.value?'none':'1px solid var(--card-border)' }}>
            {c.icon}{c.label}
          </button>
        ))}
      </div>

      {/* Featured banner (top row) */}
      {!search && featured.length>0 && (
        <div style={{ marginBottom:22 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.06em', display:'flex', alignItems:'center', gap:6 }}>
            <Star size={12} style={{ color:'#D97706' }}/>Mis en avant
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
            {featured.map(p=>(
              <div key={p.id} onClick={()=>setModal(p)} style={{ background:'var(--card-bg)', border:'2px solid var(--color-primary)', borderRadius:16, padding:'16px 18px', cursor:'pointer', position:'relative', overflow:'hidden', transition:'transform .1s' }}>
                <div style={{ position:'absolute', top:10, right:10, fontSize:10, padding:'2px 8px', borderRadius:9999, background:'var(--color-primary)', color:'#fff', fontWeight:700 }}>FEATURED</div>
                <div style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:10 }}>
                  <div style={{ width:44, height:44, borderRadius:12, background:'var(--body-bg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>{p.icon}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>{p.name}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
                      <span style={{ fontSize:11, color:'#D97706', fontWeight:700 }}>★ {p.rating}</span>
                      <span style={{ fontSize:10, color:'var(--text-muted)' }}>{p.installs.toLocaleString()} installs</span>
                    </div>
                  </div>
                  <span style={{ fontSize:12, fontWeight:700, color:p.price==='Gratuit'?'#059669':'var(--color-primary)', flexShrink:0 }}>{p.price}</span>
                </div>
                <p style={{ fontSize:12, color:'var(--text-muted)', margin:0, lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{p.description}</p>
                {installed.has(p.id) && (
                  <div style={{ marginTop:8, fontSize:11, color:'#059669', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}><CheckCircle size={11}/>Installé</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All plugins grid */}
      <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.06em' }}>
        {search?`Résultats pour "${search}"`:'Tous les plugins'} ({filtered.length})
      </div>
      {filtered.length===0 ? (
        <div style={{ textAlign:'center', padding:'48px 0', color:'var(--text-muted)' }}>
          <Puzzle size={32} style={{ margin:'0 auto 10px', display:'block', opacity:.3 }}/>
          <p style={{ fontSize:13 }}>Aucun plugin trouvé</p>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:12 }}>
          {filtered.map(p=>{
            const isInstalled = installed.has(p.id);
            return (
              <div key={p.id} style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, padding:'16px 18px', display:'flex', flexDirection:'column', gap:10, cursor:'pointer', transition:'border-color .15s' }}
                onClick={()=>setModal(p)}>
                <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                  <div style={{ width:40, height:40, borderRadius:11, background:'var(--body-bg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>{p.icon}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                      <span style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>{p.name}</span>
                      {isInstalled && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:9999, background:'#ECFDF5', color:'#059669', fontWeight:700 }}>✓ Installé</span>}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
                      <span style={{ fontSize:11, color:'#D97706', fontWeight:700 }}>★ {p.rating}</span>
                      <span style={{ fontSize:10, color:'var(--text-muted)' }}>{p.reviews} avis</span>
                      <span style={{ fontSize:10, color:'var(--text-muted)' }}>·</span>
                      <Download size={9} style={{ color:'var(--text-muted)' }}/>
                      <span style={{ fontSize:10, color:'var(--text-muted)' }}>{p.installs.toLocaleString()}</span>
                    </div>
                  </div>
                  <span style={{ fontSize:12, fontWeight:700, color:p.price==='Gratuit'?'#059669':'var(--color-primary)', flexShrink:0 }}>{p.price}</span>
                </div>
                <p style={{ fontSize:12, color:'var(--text-muted)', margin:0, lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{p.description}</p>
                <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                  {p.tags.slice(0,3).map((t:string)=>(
                    <span key={t} style={{ fontSize:10, padding:'2px 7px', borderRadius:6, background:'var(--body-bg)', border:'1px solid var(--card-border)', color:'var(--text-muted)' }}>#{t}</span>
                  ))}
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'auto', paddingTop:8, borderTop:'1px solid var(--card-border)' }}>
                  <span style={{ fontSize:11, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:4 }}><Clock size={10}/>Mis à jour {p.updatedAt}</span>
                  <button onClick={e=>{ e.stopPropagation(); if (isInstalled) return; setModal(p); }}
                    style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:8, border:`1px solid ${isInstalled?'#059669':'var(--color-primary)'}`, background:isInstalled?'#ECFDF5':`color-mix(in srgb, var(--color-primary) 8%, transparent)`, color:isInstalled?'#059669':'var(--color-primary)', fontSize:11, fontWeight:600, cursor:isInstalled?'default':'pointer' }}>
                    {isInstalled?<><CheckCircle size={11}/>Installé</>:<><Download size={11}/>Installer</>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
