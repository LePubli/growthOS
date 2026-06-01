import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import {
  Building2, Users, DollarSign, TrendingUp, Search, Plus, ChevronRight,
  Mail, Phone, MapPin, X, Activity, Calendar, Star, Edit2, Zap,
  BarChart2, CheckCircle, Clock, ExternalLink, UserPlus,
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

/* ─────────────── types & data ─────────────── */

interface Contact { name:string; email:string; phone:string; role:string; isDecider?:boolean }
interface TimelineEvent { date:string; type:string; description:string; user?:string }

interface Account {
  id:string; name:string; domain:string; industry:string; size:string; city:string;
  contactCount:number; dealValue:number; dealCount:number;
  status:'active'|'prospect'|'customer'|'churned'; lastActivity:string;
  score:number; revenue?:string; employees?:string;
  contacts:Contact[]; timeline:TimelineEvent[];
}

const MOCK_ACCOUNTS: Account[] = [
  {
    id:'1', name:'TechCorp', domain:'techcorp.fr', industry:'SaaS', size:'51-200', city:'Paris',
    contactCount:3, dealValue:12500, dealCount:2, status:'active', lastActivity:'il y a 2h', score:92,
    revenue:'4.2M€', employees:'87',
    contacts:[
      { name:'Sophie Martin',   email:'sophie@techcorp.fr',  phone:'+33 6 12 34 56 78', role:'Dir. Commercial', isDecider:true },
      { name:'Luc Garnier',     email:'luc@techcorp.fr',     phone:'+33 6 23 45 67 89', role:'DSI', isDecider:true },
      { name:'Alice Renard',    email:'alice@techcorp.fr',   phone:'', role:'Account Manager' },
    ],
    timeline:[
      { date:'2026-05-31', type:'email',    description:'Email de suivi envoyé à Sophie Martin', user:'Alice M.' },
      { date:'2026-05-29', type:'call',     description:'Appel 25 min — discussion budget Q3',   user:'Benoît G.' },
      { date:'2026-05-26', type:'meeting',  description:'Demo produit — 3 participants',          user:'Alice M.' },
      { date:'2026-05-20', type:'deal',     description:'Deal "Contrat SaaS" créé — 12 500€' },
      { date:'2026-05-15', type:'signal',   description:'Levée de fonds Série A signalée' },
    ],
  },
  {
    id:'2', name:'StartupX', domain:'startupx.io', industry:'Fintech', size:'11-50', city:'Lyon',
    contactCount:1, dealValue:4800, dealCount:1, status:'prospect', lastActivity:'il y a 1j', score:74,
    revenue:'850k€', employees:'23',
    contacts:[{ name:'Emma Leroy', email:'emma@startupx.io', phone:'', role:'CEO', isDecider:true }],
    timeline:[
      { date:'2026-05-30', type:'email', description:'Email de prospection envoyé', user:'Clara R.' },
      { date:'2026-05-28', type:'signal', description:'Recrutement VP Sales détecté' },
    ],
  },
  {
    id:'3', name:'BigSales SAS', domain:'bigsales.fr', industry:'Distribution', size:'200+', city:'Bordeaux',
    contactCount:5, dealValue:28200, dealCount:3, status:'customer', lastActivity:'il y a 3h', score:88,
    revenue:'18M€', employees:'340',
    contacts:[
      { name:'Paul Dupont',   email:'paul@bigsales.fr',   phone:'+33 6 34 56 78 90', role:'Head of Sales', isDecider:true },
      { name:'Nadia Blanc',   email:'nadia@bigsales.fr',  phone:'+33 6 45 67 89 01', role:'Directrice Achats', isDecider:true },
      { name:'Remi Vidal',    email:'remi@bigsales.fr',   phone:'', role:'Commercial Senior' },
    ],
    timeline:[
      { date:'2026-05-31', type:'call',    description:'Appel renouvellement contrat', user:'Alice M.' },
      { date:'2026-05-25', type:'email',   description:'Envoi proposition renouvellement', user:'Alice M.' },
      { date:'2026-05-10', type:'meeting', description:'QBR trimestriel — satisfaction 9/10' },
      { date:'2026-04-15', type:'deal',    description:'Deal "Renouvellement" gagné — 9 600€' },
    ],
  },
  {
    id:'4', name:'DataInc', domain:'datainc.com', industry:'Data & IA', size:'11-50', city:'Nantes',
    contactCount:2, dealValue:3600, dealCount:1, status:'prospect', lastActivity:'il y a 5j', score:61,
    revenue:'620k€', employees:'34',
    contacts:[{ name:'Camille Bernard', email:'camille@datainc.com', phone:'', role:'CTO', isDecider:true }],
    timeline:[
      { date:'2026-05-26', type:'email', description:'Pas de réponse au 2ème email' },
      { date:'2026-05-19', type:'email', description:'Email de prospection initial', user:'Benoît G.' },
    ],
  },
  {
    id:'5', name:'GrowthCo', domain:'growthco.fr', industry:'Marketing', size:'11-50', city:'Paris',
    contactCount:2, dealValue:9600, dealCount:1, status:'customer', lastActivity:'il y a 30 min', score:95,
    revenue:'2.1M€', employees:'41',
    contacts:[
      { name:'Luc Moreau',    email:'luc@growthco.fr',    phone:'+33 6 56 78 90 12', role:'VP Marketing', isDecider:true },
      { name:'Safia Bouzid',  email:'safia@growthco.fr',  phone:'', role:'Growth Manager' },
    ],
    timeline:[
      { date:'2026-05-31', type:'meeting', description:'Revue stratégie Q2 — upsell discuté' },
      { date:'2026-05-20', type:'email',   description:'Rapport mensuel envoyé',    user:'Alice M.' },
      { date:'2026-05-01', type:'deal',    description:'Deal "Renouvellement Pro" gagné — 9 600€' },
    ],
  },
  {
    id:'6', name:'AlphaTech', domain:'alphatech.io', industry:'SaaS', size:'51-200', city:'Paris',
    contactCount:4, dealValue:22000, dealCount:2, status:'active', lastActivity:'il y a 1h', score:79,
    revenue:'7.8M€', employees:'124',
    contacts:[
      { name:'Marie Dubois',  email:'marie@alphatech.io', phone:'+33 6 78 90 12 34', role:'Dir. Achats', isDecider:true },
      { name:'Pierre Garçon', email:'pierre@alphatech.io',phone:'+33 6 89 01 23 45', role:'CDO', isDecider:false },
    ],
    timeline:[
      { date:'2026-05-31', type:'email', description:'Relance proposition Enterprise', user:'Benoît G.' },
      { date:'2026-05-22', type:'meeting',description:'Présentation licence Enterprise' },
      { date:'2026-05-15', type:'deal',   description:'Deal "Licence Enterprise" créé — 22 000€' },
    ],
  },
];

const STATUS_CONFIG: Record<string,{l:string;c:string;bg:string}> = {
  active:   { l:'Actif',    c:'#2563EB', bg:'#EFF6FF' },
  prospect: { l:'Prospect', c:'#D97706', bg:'#FEF3C7' },
  customer: { l:'Client',   c:'#059669', bg:'#ECFDF5' },
  churned:  { l:'Churné',   c:'#DC2626', bg:'#FEF2F2' },
};

const TIMELINE_ICONS: Record<string,{icon:React.ReactNode;c:string;bg:string}> = {
  email:   { icon:<Mail size={11}/>,      c:'#2563EB', bg:'#EFF6FF' },
  call:    { icon:<Phone size={11}/>,     c:'#059669', bg:'#ECFDF5' },
  meeting: { icon:<Calendar size={11}/>,  c:'#7C3AED', bg:'#F5F3FF' },
  deal:    { icon:<DollarSign size={11}/>,c:'#D97706', bg:'#FFFBEB' },
  signal:  { icon:<Zap size={11}/>,       c:'#DC2626', bg:'#FEF2F2' },
};

/* ─────────────── account detail panel ─────────────── */
function AccountPanel({ account, onClose }: { account:Account; onClose:()=>void }) {
  const [, navigate] = useLocation();
  const st = STATUS_CONFIG[account.status];
  const deciders = account.contacts.filter(c=>c.isDecider).length;
  return (
    <div style={{ position:'fixed', top:0, right:0, bottom:0, width:420, background:'var(--card-bg)', borderLeft:'1px solid var(--card-border)', zIndex:40, display:'flex', flexDirection:'column', boxShadow:'-8px 0 32px rgba(0,0,0,.12)', overflowY:'auto' }}>
      {/* Header */}
      <div style={{ padding:'18px 20px', borderBottom:'1px solid var(--card-border)', display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
        <div style={{ width:46, height:46, borderRadius:13, background:'var(--color-primary)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:900, fontSize:18, flexShrink:0 }}>{account.name[0]}</div>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <h2 style={{ fontWeight:700, fontSize:16, color:'var(--text-primary)', margin:0 }}>{account.name}</h2>
            <span style={{ fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:9999, background:st.bg, color:st.c }}>{st.l}</span>
          </div>
          <a href={`https://${account.domain}`} target="_blank" rel="noreferrer" style={{ fontSize:12, color:'var(--color-primary)', textDecoration:'none', display:'flex', alignItems:'center', gap:3 }}>
            {account.domain}<ExternalLink size={9}/>
          </a>
        </div>
        <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex', padding:4 }}><X size={18}/></button>
      </div>

      <div style={{ padding:18, display:'flex', flexDirection:'column', gap:16 }}>
        {/* Score + KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
          {[
            { l:'Score', v:account.score, c:account.score>=80?'#059669':account.score>=60?'#D97706':'#6B7280', bg:account.score>=80?'#ECFDF5':account.score>=60?'#FFFBEB':'#F3F4F6' },
            { l:'Deals',        v:account.dealCount,                          c:'#7C3AED', bg:'#F5F3FF' },
            { l:'Pipeline',     v:`${(account.dealValue/1000).toFixed(0)}k€`, c:'#2563EB', bg:'#EFF6FF' },
          ].map(m=>(
            <div key={m.l} style={{ textAlign:'center', padding:'10px 0', borderRadius:11, background:m.bg }}>
              <div style={{ fontSize:20, fontWeight:800, color:m.c }}>{m.v}</div>
              <div style={{ fontSize:11, color:m.c, opacity:.7 }}>{m.l}</div>
            </div>
          ))}
        </div>

        {/* Info pills */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {[
            { l:account.industry, icon:<Building2 size={10}/> },
            { l:account.city, icon:<MapPin size={10}/> },
            { l:`${account.employees||account.size} emp.`, icon:<Users size={10}/> },
            account.revenue && { l:account.revenue+' CA', icon:<DollarSign size={10}/> },
            { l:'Actif '+account.lastActivity, icon:<Clock size={10}/> },
          ].filter(Boolean).map((p:any)=>(
            <span key={p.l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, padding:'3px 9px', borderRadius:9999, background:'var(--body-bg)', color:'var(--text-secondary)', border:'1px solid var(--card-border)' }}>
              {p.icon}{p.l}
            </span>
          ))}
        </div>

        {/* Contacts */}
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <h3 style={{ fontWeight:700, fontSize:12, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.05em', margin:0 }}>Contacts ({account.contactCount})</h3>
            <button onClick={()=>toast.info('Ajout contact…')} style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, padding:'4px 9px', borderRadius:8, border:'none', background:'var(--color-primary)', color:'#fff', cursor:'pointer' }}>
              <UserPlus size={10}/>Ajouter
            </button>
          </div>
          {account.contacts.map((c,i)=>(
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:10, background:'var(--body-bg)', marginBottom:6, border:'1px solid var(--card-border)' }}>
              <div style={{ width:32, height:32, borderRadius:9, background:c.isDecider?'var(--color-primary)':'var(--card-border)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:12, flexShrink:0 }}>
                {c.name[0]}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{c.name}</span>
                  {c.isDecider && <span style={{ fontSize:9, padding:'1px 5px', borderRadius:9999, background:'#EDE9FE', color:'#7C3AED', fontWeight:700 }}>DÉCIDEUR</span>}
                </div>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>{c.role}</div>
              </div>
              <div style={{ display:'flex', gap:4 }}>
                {c.email && <a href={`mailto:${c.email}`} style={{ padding:5, borderRadius:7, background:'#EFF6FF', color:'#2563EB', display:'flex' }}><Mail size={11}/></a>}
                {c.phone && <a href={`tel:${c.phone}`} style={{ padding:5, borderRadius:7, background:'#ECFDF5', color:'#059669', display:'flex' }}><Phone size={11}/></a>}
              </div>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div>
          <h3 style={{ fontWeight:700, fontSize:12, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:12 }}>Historique</h3>
          <div style={{ position:'relative', paddingLeft:20 }}>
            <div style={{ position:'absolute', left:8, top:0, bottom:0, width:1, background:'var(--card-border)' }}/>
            {account.timeline.map((ev,i)=>{
              const tc = TIMELINE_ICONS[ev.type]||TIMELINE_ICONS.email;
              return (
                <div key={i} style={{ position:'relative', marginBottom:12 }}>
                  <div style={{ position:'absolute', left:-16, top:4, width:18, height:18, borderRadius:6, background:tc.bg, display:'flex', alignItems:'center', justifyContent:'center', color:tc.c, border:'2px solid var(--card-bg)' }}>{tc.icon}</div>
                  <div style={{ padding:'8px 10px', borderRadius:9, background:'var(--body-bg)', border:'1px solid var(--card-border)' }}>
                    <div style={{ fontSize:12, color:'var(--text-primary)', marginBottom:2 }}>{ev.description}</div>
                    <div style={{ display:'flex', gap:8, fontSize:10, color:'var(--text-muted)' }}>
                      <span>{new Date(ev.date).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}</span>
                      {ev.user && <span>par {ev.user}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={()=>{ navigate(`/prospects?company=${encodeURIComponent(account.name)}`); onClose(); }}
            style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:10, borderRadius:12, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
            <Users size={13}/>Voir prospects
          </button>
          <button onClick={()=>toast.success(`Séquence lancée pour ${account.name}`)}
            style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:10, borderRadius:12, border:'1px solid var(--card-border)', background:'var(--body-bg)', color:'var(--text-secondary)', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            <Mail size={13}/>Séquence
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── main ─────────────── */
export default function AccountsPage() {
  const [, navigate] = useLocation();
  const [accounts, setAccounts] = useState<Account[]>(MOCK_ACCOUNTS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Tous');
  const [industryFilter, setIndustryFilter] = useState('Tous');
  const [view, setView] = useState<'grid'|'list'>('grid');
  const [selected, setSelected] = useState<Account|null>(null);

  useEffect(()=>{
    apiClient.get('/accounts').then((d:any)=>{ const l=Array.isArray(d)?d:d?.data||[]; if(l.length>0) console.log('API accounts:',l.length); }).catch(()=>{});
  },[]);

  const filtered = accounts.filter(a=>{
    const q = search.toLowerCase();
    if (q && !`${a.name} ${a.domain} ${a.industry} ${a.city}`.toLowerCase().includes(q)) return false;
    if (statusFilter!=='Tous' && a.status!==statusFilter.toLowerCase()) return false;
    if (industryFilter!=='Tous' && a.industry!==industryFilter) return false;
    return true;
  });

  const totalValue = accounts.reduce((s,a)=>s+a.dealValue,0);
  const customers = accounts.filter(a=>a.status==='customer').length;
  const totalContacts = accounts.reduce((s,a)=>s+a.contactCount,0);
  const avgScore = Math.round(accounts.reduce((s,a)=>s+a.score,0)/accounts.length);

  const industries = ['Tous',...Array.from(new Set(accounts.map(a=>a.industry)))];

  return (
    <div style={{ minHeight:'100vh', padding:'20px 24px', background:'var(--body-bg)' }}>
      {selected && <AccountPanel account={selected} onClose={()=>setSelected(null)}/>}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text-primary)', margin:'0 0 2px' }}>Comptes</h1>
          <p style={{ fontSize:13, color:'var(--text-muted)', margin:0 }}>{accounts.length} entreprises · vue Account-Based</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <div style={{ display:'flex', padding:3, borderRadius:11, gap:1, background:'var(--card-bg)', border:'1px solid var(--card-border)' }}>
            {(['grid','list'] as const).map(v=>(
              <button key={v} onClick={()=>setView(v)} style={{ padding:'5px 12px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:600, background:view===v?'var(--color-primary)':'transparent', color:view===v?'#fff':'var(--text-muted)' }}>
                {v==='grid'?'⊞ Grille':'≡ Liste'}
              </button>
            ))}
          </div>
          <button onClick={()=>toast.info('Nouveau compte…')} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:11, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
            <Plus size={14}/>Nouveau compte
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          { l:'Comptes',       v:accounts.length, icon:<Building2 size={17}/>, c:'#2563EB', bg:'#EFF6FF' },
          { l:'Clients actifs',v:customers,       icon:<TrendingUp size={17}/>,c:'#059669', bg:'#ECFDF5' },
          { l:'Contacts',      v:totalContacts,   icon:<Users size={17}/>,     c:'#7C3AED', bg:'#F5F3FF' },
          { l:'Pipeline total',v:`${(totalValue/1000).toFixed(0)}k€`, icon:<DollarSign size={17}/>, c:'#D97706', bg:'#FFFBEB' },
        ].map((k,i)=>(
          <div key={i} style={{ borderRadius:14, border:'1px solid var(--card-border)', background:'var(--card-bg)', padding:'13px 16px', display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:38, height:38, borderRadius:10, background:k.bg, display:'flex', alignItems:'center', justifyContent:'center', color:k.c, flexShrink:0 }}>{k.icon}</div>
            <div>
              <div style={{ fontSize:20, fontWeight:800, color:'var(--text-primary)' }}>{k.v}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>{k.l}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:10, marginBottom:18, flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, minWidth:200 }}>
          <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un compte…"
            style={{ width:'100%', paddingLeft:32, paddingRight:12, paddingTop:9, paddingBottom:9, borderRadius:11, border:'1px solid var(--card-border)', background:'var(--card-bg)', color:'var(--text-primary)', fontSize:13, outline:'none', boxSizing:'border-box' }}/>
        </div>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{ padding:'9px 12px', borderRadius:10, border:'1px solid var(--card-border)', background:'var(--card-bg)', color:'var(--text-primary)', fontSize:13, outline:'none' }}>
          {['Tous','prospect','active','customer','churned'].map(s=><option key={s}>{s}</option>)}
        </select>
        <select value={industryFilter} onChange={e=>setIndustryFilter(e.target.value)} style={{ padding:'9px 12px', borderRadius:10, border:'1px solid var(--card-border)', background:'var(--card-bg)', color:'var(--text-primary)', fontSize:13, outline:'none' }}>
          {industries.map(s=><option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Grid */}
      {view==='grid' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:14 }}>
          {filtered.map(acc=>{
            const st = STATUS_CONFIG[acc.status];
            return (
              <div key={acc.id} onClick={()=>setSelected(acc)}
                style={{ borderRadius:16, border:'1px solid var(--card-border)', background:'var(--card-bg)', overflow:'hidden', cursor:'pointer', transition:'all .15s' }}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.boxShadow='0 4px 20px rgba(0,0,0,.1)';(e.currentTarget as HTMLElement).style.borderColor='var(--color-primary)';}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.boxShadow='none';(e.currentTarget as HTMLElement).style.borderColor='var(--card-border)';}}>
                <div style={{ padding:'16px 16px 12px' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:10 }}>
                    <div style={{ width:44, height:44, borderRadius:11, background:'var(--color-primary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:900, color:'#fff', flexShrink:0 }}>{acc.name[0]}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:15, color:'var(--text-primary)', marginBottom:1 }}>{acc.name}</div>
                      <div style={{ fontSize:12, color:'var(--text-muted)' }}>{acc.domain} · {acc.industry}</div>
                    </div>
                    <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:9999, background:st.bg, color:st.c, flexShrink:0 }}>{st.l}</span>
                  </div>
                  <div style={{ display:'flex', gap:10, fontSize:12, color:'var(--text-muted)', marginBottom:12, flexWrap:'wrap' }}>
                    {acc.city && <span style={{ display:'flex', alignItems:'center', gap:3 }}><MapPin size={10}/>{acc.city}</span>}
                    <span style={{ display:'flex', alignItems:'center', gap:3 }}><Users size={10}/>{acc.size}</span>
                    {acc.revenue && <span style={{ display:'flex', alignItems:'center', gap:3 }}><DollarSign size={10}/>{acc.revenue}</span>}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                    {[
                      { l:'Contacts', v:acc.contactCount },
                      { l:'Deals',    v:acc.dealCount },
                      { l:'Score',    v:acc.score },
                    ].map((s,i)=>(
                      <div key={i} style={{ textAlign:'center', padding:'7px 0', borderRadius:9, background:'var(--body-bg)' }}>
                        <div style={{ fontSize:16, fontWeight:800, color:'var(--color-primary)' }}>{s.v}</div>
                        <div style={{ fontSize:10, color:'var(--text-muted)' }}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ padding:'9px 16px', borderTop:'1px solid var(--card-border)', display:'flex', alignItems:'center', gap:8, background:'var(--body-bg)' }}>
                  <Clock size={11} color="var(--text-muted)"/>
                  <span style={{ fontSize:11, color:'var(--text-muted)', flex:1 }}>{acc.lastActivity}</span>
                  <ChevronRight size={13} color="var(--text-muted)"/>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List */}
      {view==='list' && (
        <div style={{ background:'var(--card-bg)', borderRadius:16, border:'1px solid var(--card-border)', overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 1fr auto', gap:12, padding:'10px 16px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em', color:'var(--text-muted)', borderBottom:'1px solid var(--card-border)', background:'var(--body-bg)' }}>
            <span>Compte</span><span>Secteur</span><span>Contacts</span><span>Pipeline</span><span>Score</span><span>Dernière activité</span><span>Statut</span>
          </div>
          {filtered.map(acc=>{
            const st = STATUS_CONFIG[acc.status];
            return (
              <div key={acc.id} onClick={()=>setSelected(acc)}
                style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 1fr auto', gap:12, alignItems:'center', padding:'13px 16px', borderBottom:'1px solid var(--card-border)', cursor:'pointer', transition:'background .1s' }}
                onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='var(--body-bg)'}
                onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:34, height:34, borderRadius:9, background:'var(--color-primary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:900, color:'#fff', flexShrink:0 }}>{acc.name[0]}</div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>{acc.name}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>{acc.domain}</div>
                  </div>
                </div>
                <span style={{ fontSize:12, color:'var(--text-secondary)' }}>{acc.industry}</span>
                <span style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{acc.contactCount}</span>
                <span style={{ fontSize:13, fontWeight:700, color:'var(--color-primary)' }}>{acc.dealValue.toLocaleString('fr-FR')}€</span>
                <span style={{ fontSize:13, fontWeight:800, color:acc.score>=80?'#059669':acc.score>=60?'#D97706':'#6B7280' }}>{acc.score}</span>
                <span style={{ fontSize:11, color:'var(--text-muted)' }}>{acc.lastActivity}</span>
                <span style={{ fontSize:10, fontWeight:700, padding:'2px 9px', borderRadius:9999, background:st.bg, color:st.c, whiteSpace:'nowrap' }}>{st.l}</span>
              </div>
            );
          })}
          {filtered.length===0 && <div style={{ textAlign:'center', padding:'48px 0', color:'var(--text-muted)', fontSize:14 }}>Aucun compte trouvé</div>}
        </div>
      )}
    </div>
  );
}
