import { useState } from 'react';
import {
  Plus, TrendingUp, Users, Target, Globe, Code, Copy, CheckCircle,
  Settings, Zap, ArrowRight, Mail, Phone, UserPlus, X, Filter,
  ChevronDown, BarChart2, Flame, Thermometer, Wind, Edit2, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

/* ─────────────── types & data ─────────────── */

type Lead = {
  id: string; name: string; email: string; company: string; jobTitle: string;
  source: string; score: number; status: 'new'|'qualified'|'contacted'|'converted'|'rejected';
  createdAt: string; assignedTo?: string; utm?: string; pageViewed?: string;
};

const MOCK_LEADS: Lead[] = [
  { id:'1', name:'Claire Fontaine', email:'c.fontaine@innovatech.fr', company:'InnovaTech',  jobTitle:'Directrice Marketing', source:'Formulaire Contact', score:82, status:'new',       createdAt:'2026-05-31T08:12:00', utm:'google/cpc', pageViewed:'/pricing' },
  { id:'2', name:'Marc Lebeau',     email:'m.lebeau@stratexis.com',   company:'Stratexis',   jobTitle:'CEO',                  source:'Landing Page',      score:65, status:'contacted', createdAt:'2026-05-30T15:44:00', assignedTo:'Alice M.', utm:'linkedin/organic', pageViewed:'/features' },
  { id:'3', name:'Sophie Renard',   email:'s.renard@digitalia.io',    company:'Digitalia',   jobTitle:'VP Sales',             source:'Chatbot',           score:91, status:'qualified', createdAt:'2026-05-30T09:20:00', assignedTo:'Benoît G.', pageViewed:'/pricing' },
  { id:'4', name:'Antoine Morel',   email:'a.morel@techbridge.fr',    company:'TechBridge',  jobTitle:'Head of Sales',        source:'Formulaire Demo',   score:78, status:'new',       createdAt:'2026-05-29T14:05:00', utm:'newsletter', pageViewed:'/demo' },
  { id:'5', name:'Lucie Bernard',   email:'l.bernard@axelab.eu',      company:'AxeLab',      jobTitle:'Operations Manager',   source:'Landing Page',      score:54, status:'rejected',  createdAt:'2026-05-28T11:30:00', utm:'google/cpc', pageViewed:'/blog' },
  { id:'6', name:'Paul Mercier',    email:'p.mercier@nexusgrowth.io', company:'Nexus Growth',jobTitle:'CMO',                  source:'Formulaire Contact',score:88, status:'converted', createdAt:'2026-05-27T10:00:00', assignedTo:'Alice M.', pageViewed:'/pricing' },
  { id:'7', name:'Emma Roux',       email:'e.roux@cloudify.fr',       company:'Cloudify',    jobTitle:'Sales Director',       source:'Chatbot',           score:73, status:'new',       createdAt:'2026-05-31T13:22:00', utm:'linkedin/paid', pageViewed:'/features' },
];

type RoutingRule = {
  id: string; name: string; condition: string; action: string; assignTo: string; active: boolean;
};

const INITIAL_RULES: RoutingRule[] = [
  { id:'1', name:'Leads haute priorité', condition:'score >= 80', action:'Assigner + notifier Slack', assignTo:'Alice Martin', active:true },
  { id:'2', name:'Demos demandées',      condition:'source = "Formulaire Demo"', action:'Assigner immédiatement', assignTo:'Benoît Girard', active:true },
  { id:'3', name:'Leads chatbot',        condition:'source = "Chatbot" AND score >= 70', action:'Séquence automatique', assignTo:'Clara Rousseau', active:false },
];

const STATUS_CONFIG: Record<string, { l:string; c:string; bg:string }> = {
  new:       { l:'Nouveau',   c:'#2563EB', bg:'#EFF6FF' },
  qualified: { l:'Qualifié',  c:'#7C3AED', bg:'#F5F3FF' },
  contacted: { l:'Contacté',  c:'#D97706', bg:'#FFFBEB' },
  converted: { l:'Converti',  c:'#059669', bg:'#ECFDF5' },
  rejected:  { l:'Rejeté',    c:'#6B7280', bg:'#F3F4F6' },
};

const SOURCES = ['Tous', 'Formulaire Contact', 'Landing Page', 'Chatbot', 'Formulaire Demo'];
const EMBED_CODE = `<!-- GrowthOS Lead Capture -->
<script src="https://cdn.growthos.io/capture.js"
  data-token="YOUR_TOKEN"
  data-workspace="YOUR_WORKSPACE"
  data-theme="light">
</script>`;

function scoreLabel(s:number):{icon:React.ReactNode;c:string} {
  if (s>=80) return { icon:<Flame size={11}/>, c:'#DC2626' };
  if (s>=60) return { icon:<Thermometer size={11}/>, c:'#D97706' };
  return        { icon:<Wind size={11}/>,  c:'#6B7280' };
}

/* ─────────────── lead detail modal ─────────────── */
function LeadModal({ lead, onClose, onAction }: { lead:Lead; onClose:()=>void; onAction:(a:string,lead:Lead)=>void }) {
  const st = STATUS_CONFIG[lead.status];
  const sl = scoreLabel(lead.score);
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'var(--card-bg)', borderRadius:20, width:'100%', maxWidth:440, boxShadow:'0 20px 60px rgba(0,0,0,.2)', overflow:'hidden' }}>
        <div style={{ padding:'18px 20px', borderBottom:'1px solid var(--card-border)', display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:44, height:44, borderRadius:12, background:'var(--color-primary)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:17 }}>{lead.name[0]}</div>
          <div style={{ flex:1 }}>
            <h2 style={{ fontWeight:700, fontSize:15, color:'var(--text-primary)', margin:'0 0 2px' }}>{lead.name}</h2>
            <div style={{ fontSize:12, color:'var(--text-muted)' }}>{lead.jobTitle} · {lead.company}</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:9999, background:'rgba(0,0,0,.05)' }}>
            <span style={{ color:sl.c }}>{sl.icon}</span>
            <span style={{ fontWeight:800, fontSize:16, color:sl.c }}>{lead.score}</span>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex' }}><X size={18}/></button>
        </div>
        <div style={{ padding:20 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
            {[
              { l:'Email', v:lead.email },
              { l:'Source', v:lead.source },
              { l:'UTM', v:lead.utm||'—' },
              { l:'Page vue', v:lead.pageViewed||'—' },
              { l:'Assigné à', v:lead.assignedTo||'Non assigné' },
              { l:'Statut', v:st.l },
            ].map(f=>(
              <div key={f.l} style={{ padding:'8px 12px', borderRadius:9, background:'var(--body-bg)', border:'1px solid var(--card-border)' }}>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:2 }}>{f.l}</div>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)' }}>{f.v}</div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>{onAction('qualify',lead);onClose();}} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:9, borderRadius:10, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>
              <CheckCircle size={12}/>Qualifier
            </button>
            <button onClick={()=>{onAction('email',lead);onClose();}} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:9, borderRadius:10, border:'1px solid var(--card-border)', background:'var(--body-bg)', color:'var(--text-secondary)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
              <Mail size={12}/>Email
            </button>
            <button onClick={()=>{onAction('convert',lead);onClose();}} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:9, borderRadius:10, border:'1px solid var(--card-border)', background:'#ECFDF5', color:'#059669', fontSize:12, fontWeight:700, cursor:'pointer' }}>
              <UserPlus size={12}/>Convertir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── main ─────────────── */
export default function InboundPage() {
  const [leads, setLeads] = useState<Lead[]>(MOCK_LEADS);
  const [rules, setRules] = useState<RoutingRule[]>(INITIAL_RULES);
  const [source, setSource] = useState('Tous');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCode, setShowCode] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead|null>(null);
  const [tab, setTab] = useState<'leads'|'routing'|'sources'>('leads');

  const filtered = leads.filter(l => {
    if (source!=='Tous' && l.source!==source) return false;
    if (statusFilter!=='all' && l.status!==statusFilter) return false;
    return true;
  });

  const avgScore = Math.round(filtered.reduce((s,l)=>s+l.score,0)/(filtered.length||1));
  const hot = leads.filter(l=>l.score>=80).length;
  const converted = leads.filter(l=>l.status==='converted').length;
  const convRate = Math.round(converted/leads.length*100);

  const copy = () => { navigator.clipboard.writeText(EMBED_CODE); setCopied(true); setTimeout(()=>setCopied(false),2000); toast.success('Code copié'); };

  const handleAction = (action:string, lead:Lead) => {
    if (action==='qualify') { setLeads(ls=>ls.map(l=>l.id===lead.id?{...l,status:'qualified'}:l)); toast.success(`${lead.name} qualifié`); }
    if (action==='convert') { setLeads(ls=>ls.map(l=>l.id===lead.id?{...l,status:'converted'}:l)); toast.success(`${lead.name} converti en prospect`); }
    if (action==='email') toast.success(`Email en cours pour ${lead.name}`);
  };

  const toggleRule = (id:string) => setRules(rs=>rs.map(r=>r.id===id?{...r,active:!r.active}:r));

  return (
    <div style={{ minHeight:'100vh', padding:'20px 24px', background:'var(--body-bg)' }}>
      {selectedLead && <LeadModal lead={selectedLead} onClose={()=>setSelectedLead(null)} onAction={handleAction}/>}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text-primary)', margin:'0 0 2px' }}>Inbound</h1>
          <p style={{ fontSize:13, color:'var(--text-muted)', margin:0 }}>Leads entrants · scoring automatique · routing intelligent</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={()=>setShowCode(v=>!v)} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:10, border:'1px solid var(--card-border)', background:showCode?'var(--color-primary)':'var(--card-bg)', color:showCode?'#fff':'var(--text-secondary)', fontSize:13, cursor:'pointer', fontWeight:600 }}>
            <Code size={13}/>Intégrer
          </button>
          <button style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
            <Plus size={13}/>Landing page
          </button>
        </div>
      </div>

      {/* Embed code */}
      {showCode && (
        <div style={{ borderRadius:16, border:'1px solid var(--card-border)', background:'var(--card-bg)', padding:18, marginBottom:18 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <h2 style={{ fontWeight:700, fontSize:14, color:'var(--text-primary)', margin:0 }}>Code d'intégration</h2>
            <button onClick={copy} style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:9, border:'1px solid var(--card-border)', background:copied?'#ECFDF5':'var(--body-bg)', color:copied?'#059669':'var(--text-secondary)', fontSize:12, cursor:'pointer' }}>
              {copied?<CheckCircle size={12}/>:<Copy size={12}/>}{copied?'Copié !':'Copier'}
            </button>
          </div>
          <pre style={{ padding:'12px 14px', borderRadius:10, background:'var(--body-bg)', color:'var(--text-secondary)', fontSize:12, fontFamily:'monospace', overflowX:'auto', margin:0 }}>{EMBED_CODE}</pre>
          <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:8, marginBottom:0 }}>Collez ce code avant la balise &lt;/body&gt;. Remplacez YOUR_TOKEN par votre clé API Settings → API.</p>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          { l:'Leads ce mois',   v:leads.length,  icon:<Users size={17}/>,    c:'#2563EB', bg:'#EFF6FF' },
          { l:'Score moyen',     v:`${avgScore}`,  icon:<Target size={17}/>,   c:'#7C3AED', bg:'#F5F3FF' },
          { l:'Taux conversion', v:`${convRate}%`, icon:<TrendingUp size={17}/>,c:'#059669', bg:'#ECFDF5' },
          { l:'Hot leads (80+)', v:hot,            icon:<Flame size={17}/>,    c:'#DC2626', bg:'#FEF2F2' },
        ].map((m,i)=>(
          <div key={i} style={{ borderRadius:14, border:'1px solid var(--card-border)', background:'var(--card-bg)', padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:38, height:38, borderRadius:10, background:m.bg, display:'flex', alignItems:'center', justifyContent:'center', color:m.c }}>{m.icon}</div>
            <div>
              <div style={{ fontSize:22, fontWeight:800, color:'var(--text-primary)' }}>{m.v}</div>
              <div style={{ fontSize:12, color:'var(--text-muted)' }}>{m.l}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:0, marginBottom:18, borderBottom:'1px solid var(--card-border)' }}>
        {([['leads','📥 Leads'],['routing','⚡ Routing'],['sources','🌐 Sources']] as const).map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            style={{ padding:'9px 20px', border:'none', background:'transparent', cursor:'pointer', fontSize:13, fontWeight:700, color:tab===k?'var(--color-primary)':'var(--text-muted)', borderBottom:`2px solid ${tab===k?'var(--color-primary)':'transparent'}`, marginBottom:-1, transition:'all .15s' }}>
            {l}
          </button>
        ))}
      </div>

      {/* ── LEADS TAB ── */}
      {tab==='leads' && (
        <>
          <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
            {SOURCES.map(s=>(
              <button key={s} onClick={()=>setSource(s)}
                style={{ padding:'6px 14px', borderRadius:10, border:'none', fontSize:12, fontWeight:600, cursor:'pointer', background:source===s?'var(--color-primary)':'var(--card-bg)', color:source===s?'#fff':'var(--text-secondary)', boxShadow:source===s?'none':'0 0 0 1px var(--card-border)' }}>
                {s}
              </button>
            ))}
            <div style={{ height:24, width:1, background:'var(--card-border)', margin:'4px 0' }}/>
            {Object.entries(STATUS_CONFIG).map(([k,v])=>(
              <button key={k} onClick={()=>setStatusFilter(sf=>sf===k?'all':k)}
                style={{ padding:'6px 12px', borderRadius:10, border:'none', fontSize:12, fontWeight:600, cursor:'pointer', background:statusFilter===k?v.bg:'var(--card-bg)', color:statusFilter===k?v.c:'var(--text-secondary)', boxShadow:statusFilter===k?`0 0 0 1.5px ${v.c}`:'0 0 0 1px var(--card-border)' }}>
                {v.l}
              </button>
            ))}
          </div>

          <div style={{ background:'var(--card-bg)', borderRadius:16, border:'1px solid var(--card-border)', overflow:'hidden' }}>
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1.5fr 1fr 1fr 1fr 90px', gap:12, padding:'10px 16px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em', color:'var(--text-muted)', borderBottom:'1px solid var(--card-border)', background:'var(--body-bg)' }}>
              <span>Lead</span><span>Source & UTM</span><span>Score</span><span>Assigné</span><span>Statut</span><span>Actions</span>
            </div>
            {filtered.map(lead=>{
              const st = STATUS_CONFIG[lead.status];
              const sl = scoreLabel(lead.score);
              return (
                <div key={lead.id}
                  style={{ display:'grid', gridTemplateColumns:'2fr 1.5fr 1fr 1fr 1fr 90px', gap:12, alignItems:'center', padding:'13px 16px', borderBottom:'1px solid var(--card-border)', transition:'background .1s', cursor:'pointer' }}
                  onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='var(--body-bg)'}
                  onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}
                  onClick={()=>setSelectedLead(lead)}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:30, height:30, borderRadius:8, background:'var(--color-primary)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:12, flexShrink:0 }}>{lead.name[0]}</div>
                      <div>
                        <div style={{ fontWeight:600, fontSize:13, color:'var(--text-primary)' }}>{lead.name}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)' }}>{lead.jobTitle} · {lead.company}</div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{lead.source}</div>
                    {lead.utm && <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'monospace' }}>{lead.utm}</div>}
                    {lead.pageViewed && <div style={{ fontSize:10, color:'var(--color-primary)' }}>{lead.pageViewed}</div>}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ color:sl.c }}>{sl.icon}</span>
                    <span style={{ fontWeight:800, fontSize:16, color:sl.c }}>{lead.score}</span>
                  </div>
                  <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{lead.assignedTo||<span style={{ color:'var(--text-muted)', fontStyle:'italic' }}>Non assigné</span>}</div>
                  <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:9999, background:st.bg, color:st.c, width:'fit-content' }}>{st.l}</span>
                  <div style={{ display:'flex', gap:5 }} onClick={e=>e.stopPropagation()}>
                    <button onClick={()=>handleAction('qualify',lead)} title="Qualifier" style={{ padding:6, borderRadius:7, border:'1px solid var(--card-border)', background:'var(--body-bg)', cursor:'pointer', color:'#7C3AED', display:'flex' }}><CheckCircle size={12}/></button>
                    <button onClick={()=>handleAction('email',lead)} title="Email" style={{ padding:6, borderRadius:7, border:'1px solid var(--card-border)', background:'var(--body-bg)', cursor:'pointer', color:'#2563EB', display:'flex' }}><Mail size={12}/></button>
                    <button onClick={()=>handleAction('convert',lead)} title="Convertir" style={{ padding:6, borderRadius:7, border:'1px solid var(--card-border)', background:'var(--body-bg)', cursor:'pointer', color:'#059669', display:'flex' }}><UserPlus size={12}/></button>
                  </div>
                </div>
              );
            })}
            {filtered.length===0 && <div style={{ textAlign:'center', padding:'48px 0', color:'var(--text-muted)', fontSize:14 }}>Aucun lead trouvé</div>}
          </div>
        </>
      )}

      {/* ── ROUTING TAB ── */}
      {tab==='routing' && (
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <p style={{ fontSize:13, color:'var(--text-muted)', margin:0 }}>Règles de routing automatique — traitement en cascade</p>
            <button onClick={()=>toast.info('Éditeur de règle…')} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:10, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
              <Plus size={13}/>Nouvelle règle
            </button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {rules.map((rule,i)=>(
              <div key={rule.id} style={{ borderRadius:14, border:`1.5px solid ${rule.active?'var(--color-primary)':'var(--card-border)'}`, background:'var(--card-bg)', padding:'14px 16px', display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:24, height:24, borderRadius:7, background:'var(--body-bg)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:12, color:'var(--text-muted)', flexShrink:0 }}>{i+1}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:13, color:'var(--text-primary)', marginBottom:4 }}>{rule.name}</div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <span style={{ fontSize:11, padding:'2px 8px', borderRadius:6, background:'var(--body-bg)', color:'var(--text-secondary)', fontFamily:'monospace' }}>IF {rule.condition}</span>
                    <ArrowRight size={12} color="var(--text-muted)" style={{ alignSelf:'center' }}/>
                    <span style={{ fontSize:11, padding:'2px 8px', borderRadius:6, background:'#ECFDF5', color:'#059669' }}>{rule.action}</span>
                    <span style={{ fontSize:11, padding:'2px 8px', borderRadius:6, background:'#EFF6FF', color:'#2563EB' }}>→ {rule.assignTo}</span>
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
                  <button onClick={()=>toggleRule(rule.id)}
                    style={{ width:40, height:22, borderRadius:11, border:'none', background:rule.active?'var(--color-primary)':'var(--card-border)', cursor:'pointer', position:'relative', transition:'background .2s' }}>
                    <div style={{ position:'absolute', top:3, left:rule.active?20:3, width:16, height:16, borderRadius:'50%', background:'#fff', transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)' }}/>
                  </button>
                  <button onClick={()=>toast.info('Édition…')} style={{ padding:6, borderRadius:7, border:'1px solid var(--card-border)', background:'var(--body-bg)', cursor:'pointer', color:'var(--text-muted)', display:'flex' }}><Edit2 size={12}/></button>
                  <button onClick={()=>setRules(rs=>rs.filter(r=>r.id!==rule.id))} style={{ padding:6, borderRadius:7, border:'1px solid var(--card-border)', background:'var(--body-bg)', cursor:'pointer', color:'#EF4444', display:'flex' }}><Trash2 size={12}/></button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop:16, borderRadius:14, border:'1px solid var(--card-border)', background:'var(--card-bg)', padding:16 }}>
            <h3 style={{ fontWeight:700, fontSize:13, color:'var(--text-primary)', marginBottom:12 }}>Scoring automatique</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {[
                { l:'Visite page /pricing',      points:'+20', c:'#059669', bg:'#ECFDF5' },
                { l:'Demande de démo',            points:'+30', c:'#059669', bg:'#ECFDF5' },
                { l:'Source LinkedIn Ads',        points:'+15', c:'#2563EB', bg:'#EFF6FF' },
                { l:'Taille entreprise 50-500',   points:'+10', c:'#7C3AED', bg:'#F5F3FF' },
                { l:'Email personnel (gmail…)',   points:'-20', c:'#EF4444', bg:'#FEF2F2' },
                { l:'Domaine blacklisté',         points:'-50', c:'#DC2626', bg:'#FEF2F2' },
              ].map(sc=>(
                <div key={sc.l} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:9, background:'var(--body-bg)', border:'1px solid var(--card-border)' }}>
                  <span style={{ fontSize:13, fontWeight:800, color:sc.c, padding:'2px 8px', borderRadius:7, background:sc.bg, flexShrink:0 }}>{sc.points}</span>
                  <span style={{ fontSize:12, color:'var(--text-secondary)' }}>{sc.l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SOURCES TAB ── */}
      {tab==='sources' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          {['Formulaire Contact','Landing Page','Chatbot','Formulaire Demo'].map(src=>{
            const srcLeads = leads.filter(l=>l.source===src);
            const srcAvg = srcLeads.length ? Math.round(srcLeads.reduce((s,l)=>s+l.score,0)/srcLeads.length) : 0;
            const srcConv = srcLeads.filter(l=>l.status==='converted').length;
            const ICONS: Record<string,string> = { 'Formulaire Contact':'📋', 'Landing Page':'🌐', 'Chatbot':'💬', 'Formulaire Demo':'🎯' };
            return (
              <div key={src} style={{ borderRadius:16, border:'1px solid var(--card-border)', background:'var(--card-bg)', padding:20 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                  <span style={{ fontSize:24 }}>{ICONS[src]}</span>
                  <div>
                    <div style={{ fontWeight:700, fontSize:14, color:'var(--text-primary)' }}>{src}</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)' }}>{srcLeads.length} lead{srcLeads.length>1?'s':''}</div>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:12 }}>
                  {[{ l:'Leads', v:srcLeads.length },{ l:'Score moy.', v:srcAvg },{ l:'Convertis', v:srcConv }].map(m=>(
                    <div key={m.l} style={{ textAlign:'center', padding:'8px 0', borderRadius:9, background:'var(--body-bg)' }}>
                      <div style={{ fontSize:18, fontWeight:800, color:'var(--color-primary)' }}>{m.v}</div>
                      <div style={{ fontSize:10, color:'var(--text-muted)' }}>{m.l}</div>
                    </div>
                  ))}
                </div>
                <div style={{ height:6, borderRadius:9999, background:'var(--body-bg)', overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:9999, background:'var(--color-primary)', width:`${srcLeads.length/leads.length*100}%`, transition:'width .4s' }}/>
                </div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:5 }}>{Math.round(srcLeads.length/leads.length*100)}% du total</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
