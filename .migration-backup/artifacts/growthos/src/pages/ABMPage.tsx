import { useState } from 'react';
import {
  Target, Plus, Building2, TrendingUp, Users, ChevronRight, X,
  Mail, Phone, Globe, UserPlus, Zap, BarChart2, Edit2, Trash2,
  CheckCircle, Search, ArrowUpRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

/* ─────────────── types ─────────────── */

type Account = {
  id: string; company: string; domain: string; industry: string; size: string;
  tam: number; status: 'target' | 'engaged' | 'prospect'; contacts: number;
  engaged: number; score: number; logo: string; revenue?: string;
  lastActivity?: string; signals?: string[];
};

type Contact = { name: string; role: string; email: string; engaged: boolean };

/* ─────────────── data ─────────────── */

const INITIAL_ACCOUNTS: Account[] = [
  { id:'1', company:'Schneider Electric', domain:'se.com',       industry:'Energie',       size:'10 000+',   tam:2800000, status:'target',   contacts:12, engaged:8,  score:92, logo:'SE', revenue:'29B€',   lastActivity:'il y a 2h',   signals:['Recrutement x3','Budget Q2 ouvert'] },
  { id:'2', company:'Dassault Systèmes',  domain:'3ds.com',       industry:'Logiciel',      size:'1000–5000', tam:1500000, status:'engaged',  contacts:5,  engaged:3,  score:78, logo:'DS', revenue:'5.6B€',  lastActivity:'il y a 1j',   signals:['Visite pricing x5'] },
  { id:'3', company:'Bureau Veritas',     domain:'bureauveritas.com', industry:'Services',  size:'5000–10000',tam:950000,  status:'target',   contacts:9,  engaged:2,  score:65, logo:'BV', revenue:'5.1B€',  lastActivity:'il y a 3j',   signals:['Nouveau DG nommé'] },
  { id:'4', company:'Veolia',             domain:'veolia.com',    industry:'Environnement', size:'10 000+',   tam:3200000, status:'engaged',  contacts:7,  engaged:6,  score:87, logo:'VE', revenue:'42B€',   lastActivity:'il y a 4h',   signals:['Levée de fonds','ESG initiative'] },
  { id:'5', company:'Arkema',             domain:'arkema.com',    industry:'Chimie',        size:'1000–5000', tam:720000,  status:'prospect', contacts:3,  engaged:1,  score:45, logo:'AR', revenue:'9.5B€',  lastActivity:'il y a 2sem',  signals:[] },
  { id:'6', company:'TotalEnergies',      domain:'totalenergies.com',industry:'Energie',    size:'10 000+',   tam:4100000, status:'target',   contacts:4,  engaged:1,  score:58, logo:'TE', revenue:'200B€', lastActivity:'il y a 1sem',  signals:['Nouveau responsable digital'] },
];

const ACCOUNT_CONTACTS: Record<string, Contact[]> = {
  '1': [{ name:'Sophie Bernard', role:'VP Digital',      email:'s.bernard@se.com',     engaged:true  },
        { name:'Alain Dumont',   role:'DSI',             email:'a.dumont@se.com',       engaged:true  },
        { name:'Claire Martin',  role:'Achats',          email:'c.martin@se.com',       engaged:false }],
  '4': [{ name:'Jean-Paul Vidal',role:'CDO',             email:'jp.vidal@veolia.com',   engaged:true  },
        { name:'Marie Lefèvre',  role:'VP Innovation',   email:'m.lefevre@veolia.com',  engaged:true  }],
};

const TIERS = [
  { value:'all',      label:'Tous les comptes', color:'' },
  { value:'target',   label:'Tier 1 — Cibles',   color:'#7C3AED' },
  { value:'engaged',  label:'Tier 2 — Engagés',  color:'#2563EB' },
  { value:'prospect', label:'Tier 3 — Prospects',color:'#6B7280' },
];

/* ─────────────── score gauge ─────────────── */
function ScoreGauge({ score }: { score: number }) {
  const color = score >= 80 ? '#059669' : score >= 60 ? '#D97706' : '#6B7280';
  const bg    = score >= 80 ? '#ECFDF5' : score >= 60 ? '#FFFBEB' : '#F3F4F6';
  const label = score >= 80 ? 'Hot' : score >= 60 ? 'Warm' : 'Cold';
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
      <div style={{ position:'relative', width:56, height:56 }}>
        <svg width="56" height="56" style={{ transform:'rotate(-90deg)' }}>
          <circle cx="28" cy="28" r="22" fill="none" stroke="var(--card-border)" strokeWidth="5" />
          <circle cx="28" cy="28" r="22" fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={`${2*Math.PI*22}`} strokeDashoffset={`${2*Math.PI*22*(1-score/100)}`}
            strokeLinecap="round" style={{ transition:'stroke-dashoffset .5s' }} />
        </svg>
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color }}>{score}</div>
      </div>
      <span style={{ fontSize:10, fontWeight:700, color, padding:'1px 7px', borderRadius:9999, background:bg }}>{label}</span>
    </div>
  );
}

/* ─────────────── TAM Calculator modal ─────────────── */
function TamCalculator({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ companies:1200, avgDeal:18000, penetration:12, growth:15 });
  const set = (k: string, v: number) => setF(p => ({ ...p, [k]: v }));
  const tam = f.companies * f.avgDeal;
  const sam = Math.round(tam * f.penetration / 100);
  const som = Math.round(sam * f.growth / 100);

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'var(--card-bg)', borderRadius:20, width:'100%', maxWidth:480, boxShadow:'0 20px 60px rgba(0,0,0,.2)', overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 22px', borderBottom:'1px solid var(--card-border)' }}>
          <h2 style={{ fontWeight:700, fontSize:16, color:'var(--text-primary)', margin:0 }}>🎯 Calculateur TAM/SAM/SOM</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex' }}><X size={18}/></button>
        </div>
        <div style={{ padding:22 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:18 }}>
            {[
              { k:'companies',  l:'Entreprises cibles',       unit:'',   min:100,  max:50000 },
              { k:'avgDeal',    l:'Deal moyen (€)',            unit:'€',  min:1000, max:500000 },
              { k:'penetration',l:'Pénétration marché (%)',   unit:'%',  min:1,    max:60 },
              { k:'growth',     l:'Part de marché ciblée (%)' ,unit:'%', min:1,    max:50 },
            ].map(field => (
              <div key={field.k}>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>{field.l}</label>
                <div style={{ position:'relative' }}>
                  <input type="number" min={field.min} max={field.max} value={(f as any)[field.k]}
                    onChange={e => set(field.k, +e.target.value)}
                    style={{ width:'100%', padding:'8px 12px', border:'1px solid var(--card-border)', borderRadius:10, fontSize:14, outline:'none', background:'var(--body-bg)', color:'var(--text-primary)', boxSizing:'border-box' }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:18 }}>
            {[
              { l:'TAM',     v:tam, desc:'Marché total adressable',     color:'#7C3AED', bg:'#F5F3FF' },
              { l:'SAM',     v:sam, desc:`${f.penetration}% du TAM`,    color:'#2563EB', bg:'#EFF6FF' },
              { l:'SOM',     v:som, desc:`${f.growth}% du SAM`,         color:'#059669', bg:'#ECFDF5' },
            ].map(m => (
              <div key={m.l} style={{ borderRadius:12, background:m.bg, padding:'12px 14px' }}>
                <div style={{ fontSize:11, fontWeight:700, color:m.color, marginBottom:4, textTransform:'uppercase' }}>{m.l}</div>
                <div style={{ fontSize:18, fontWeight:800, color:m.color }}>{(m.v/1000000).toFixed(2)}M€</div>
                <div style={{ fontSize:11, color:m.color, opacity:0.7 }}>{m.desc}</div>
              </div>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={[{ name:'TAM', v:tam }, { name:'SAM', v:sam }, { name:'SOM', v:som }]} barSize={36}>
              <XAxis dataKey="name" tick={{ fontSize:11, fill:'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip formatter={(v:any) => [`${(+v/1000).toFixed(0)}k€`,'Marché']} contentStyle={{ fontSize:12, borderRadius:10, border:'1px solid var(--card-border)', background:'var(--card-bg)' }} />
              <Bar dataKey="v" radius={[6,6,0,0]}>
                {['#7C3AED','#2563EB','#059669'].map((c,i) => <Cell key={i} fill={c} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <button onClick={onClose} style={{ width:'100%', marginTop:14, padding:11, borderRadius:12, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Add account modal ─────────────── */
function AddAccountModal({ onClose, onAdd }: { onClose:()=>void; onAdd:(a:Account)=>void }) {
  const [f, setF] = useState({ company:'', domain:'', industry:'', size:'100–500', tam:'', status:'target' as const });
  const set = (k:string,v:string) => setF(p=>({...p,[k]:v}));
  const submit = () => {
    if (!f.company.trim()) { toast.error('Nom requis'); return; }
    const a: Account = { id:crypto.randomUUID(), ...f, tam:+f.tam||100000, contacts:0, engaged:0, score:50, logo:f.company.slice(0,2).toUpperCase() };
    onAdd(a); onClose(); toast.success(`${f.company} ajouté`);
  };
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'var(--card-bg)', borderRadius:20, width:'100%', maxWidth:420, boxShadow:'0 20px 60px rgba(0,0,0,.2)', overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid var(--card-border)' }}>
          <h2 style={{ fontWeight:700, fontSize:15, color:'var(--text-primary)', margin:0 }}>Ajouter un compte cible</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex' }}><X size={16}/></button>
        </div>
        <div style={{ padding:20, display:'flex', flexDirection:'column', gap:10 }}>
          {[
            { k:'company', l:'Nom entreprise *', placeholder:'Schneider Electric' },
            { k:'domain',  l:'Domaine',          placeholder:'schneider.com' },
            { k:'industry',l:'Secteur',          placeholder:'Energie, Logiciel...' },
            { k:'tam',     l:'TAM estimé (€)',   placeholder:'2800000' },
          ].map(field => (
            <div key={field.k}>
              <label style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)', display:'block', marginBottom:4 }}>{field.l}</label>
              <input value={(f as any)[field.k]} onChange={e=>set(field.k,e.target.value)} placeholder={field.placeholder}
                style={{ width:'100%', padding:'8px 12px', border:'1px solid var(--card-border)', borderRadius:10, fontSize:13, outline:'none', background:'var(--body-bg)', color:'var(--text-primary)', boxSizing:'border-box' }} />
            </div>
          ))}
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)', display:'block', marginBottom:4 }}>Tier</label>
            <select value={f.status} onChange={e=>set('status',e.target.value)}
              style={{ width:'100%', padding:'8px 12px', border:'1px solid var(--card-border)', borderRadius:10, fontSize:13, outline:'none', background:'var(--body-bg)', color:'var(--text-primary)' }}>
              <option value="target">Tier 1 — Cible</option>
              <option value="engaged">Tier 2 — Engagé</option>
              <option value="prospect">Tier 3 — Prospect</option>
            </select>
          </div>
          <div style={{ display:'flex', gap:10, marginTop:4 }}>
            <button onClick={onClose} style={{ flex:1, padding:10, borderRadius:12, border:'1px solid var(--card-border)', background:'transparent', fontSize:14, cursor:'pointer', color:'var(--text-secondary)' }}>Annuler</button>
            <button onClick={submit} style={{ flex:2, padding:10, borderRadius:12, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>Ajouter</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Account detail panel ─────────────── */
function AccountPanel({ account, onClose }: { account: Account; onClose: () => void }) {
  const contacts = ACCOUNT_CONTACTS[account.id] || [];
  const coverage = account.contacts > 0 ? Math.round(account.engaged / account.contacts * 100) : 0;
  return (
    <div style={{ position:'fixed', top:0, right:0, bottom:0, width:400, background:'var(--card-bg)', borderLeft:'1px solid var(--card-border)', zIndex:40, overflowY:'auto', boxShadow:'-8px 0 32px rgba(0,0,0,.12)' }}>
      {/* Header */}
      <div style={{ padding:'18px 20px', borderBottom:'1px solid var(--card-border)', display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:44, height:44, borderRadius:12, background:'var(--color-primary)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:15, flexShrink:0 }}>{account.logo}</div>
        <div style={{ flex:1 }}>
          <h2 style={{ fontWeight:700, fontSize:16, color:'var(--text-primary)', margin:0 }}>{account.company}</h2>
          <a href={`https://${account.domain}`} target="_blank" rel="noreferrer" style={{ fontSize:12, color:'var(--color-primary)', textDecoration:'none', display:'flex', alignItems:'center', gap:3 }}>
            {account.domain}<ArrowUpRight size={10}/>
          </a>
        </div>
        <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex' }}><X size={18}/></button>
      </div>

      <div style={{ padding:18, display:'flex', flexDirection:'column', gap:16 }}>
        {/* Score + coverage */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div style={{ borderRadius:12, border:'1px solid var(--card-border)', padding:14, display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
            <ScoreGauge score={account.score} />
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>Score d'engagement</span>
          </div>
          <div style={{ borderRadius:12, border:'1px solid var(--card-border)', padding:14, display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
            <div style={{ fontSize:26, fontWeight:800, color:'var(--color-primary)' }}>{coverage}%</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', textAlign:'center' }}>Couverture décideurs</div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>{account.engaged}/{account.contacts} contacts</div>
          </div>
        </div>

        {/* Info pills */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {[
            { l:account.industry, icon:<Building2 size={11}/> },
            { l:account.size+' employés', icon:<Users size={11}/> },
            { l:account.revenue||'N/A', icon:<TrendingUp size={11}/> },
            { l:'Dernière activité : '+account.lastActivity, icon:<CheckCircle size={11}/> },
          ].map(p => (
            <span key={p.l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, padding:'4px 10px', borderRadius:9999, background:'var(--body-bg)', color:'var(--text-secondary)', border:'1px solid var(--card-border)' }}>
              {p.icon}{p.l}
            </span>
          ))}
        </div>

        {/* Signals */}
        {account.signals && account.signals.length > 0 && (
          <div>
            <h3 style={{ fontWeight:700, fontSize:12, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>Signaux récents</h3>
            {account.signals.map(s => (
              <div key={s} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:8, background:'#FEF3C7', marginBottom:5 }}>
                <Zap size={12} color="#D97706"/><span style={{ fontSize:12, color:'#92400E', fontWeight:500 }}>{s}</span>
              </div>
            ))}
          </div>
        )}

        {/* Contacts */}
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <h3 style={{ fontWeight:700, fontSize:12, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.05em', margin:0 }}>Contacts ({account.contacts})</h3>
            <button onClick={()=>toast.info('Ajout de contact…')} style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, padding:'4px 9px', borderRadius:8, border:'none', background:'var(--color-primary)', color:'#fff', cursor:'pointer' }}>
              <UserPlus size={10}/>Ajouter
            </button>
          </div>
          {contacts.length > 0 ? contacts.map(c => (
            <div key={c.name} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 10px', borderRadius:10, background:'var(--body-bg)', marginBottom:6, border:'1px solid var(--card-border)' }}>
              <div style={{ width:30, height:30, borderRadius:8, background:c.engaged?'#ECFDF5':'var(--card-border)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:11, fontWeight:700, color:c.engaged?'#059669':'var(--text-muted)' }}>
                {c.name.split(' ').map(n=>n[0]).join('')}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{c.name}</div>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>{c.role}</div>
              </div>
              {c.engaged && <CheckCircle size={14} color="#059669"/>}
              <button onClick={()=>toast.info(`Email à ${c.name}`)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex', padding:3 }}><Mail size={12}/></button>
            </div>
          )) : (
            <div style={{ textAlign:'center', padding:'20px 0', color:'var(--text-muted)', fontSize:13 }}>Aucun contact enregistré</div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={()=>toast.success(`Séquence lancée pour ${account.company}`)}
            style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:10, borderRadius:12, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            <Mail size={13}/>Séquence
          </button>
          <button onClick={()=>toast.info('Ajout aux prospects...')}
            style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:10, borderRadius:12, border:'1px solid var(--card-border)', background:'var(--body-bg)', color:'var(--text-secondary)', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            <UserPlus size={13}/>Prospects
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── main ─────────────── */
export default function ABMPage() {
  const [accounts, setAccounts] = useState<Account[]>(INITIAL_ACCOUNTS);
  const [tier, setTier] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Account | null>(null);
  const [showTam, setShowTam] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const filtered = accounts.filter(a => {
    if (tier !== 'all' && a.status !== tier) return false;
    if (search && !`${a.company} ${a.industry} ${a.domain}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalTam = accounts.reduce((s,a)=>s+a.tam,0);
  const engagedCount = accounts.filter(a=>a.status==='engaged').length;
  const avgScore = Math.round(accounts.reduce((s,a)=>s+a.score,0)/accounts.length);
  const coveragePct = Math.round(accounts.reduce((s,a)=>s+a.engaged,0) / accounts.reduce((s,a)=>s+a.contacts,0) * 100);

  const industryData = Object.entries(
    accounts.reduce((m,a)=>{ m[a.industry]=(m[a.industry]||0)+a.tam; return m; },{} as Record<string,number>)
  ).map(([l,v])=>({ l,v })).sort((a,b)=>b.v-a.v);

  return (
    <div style={{ minHeight:'100vh', padding:24, background:'var(--body-bg)' }}>
      {showTam && <TamCalculator onClose={()=>setShowTam(false)} />}
      {showAdd && <AddAccountModal onClose={()=>setShowAdd(false)} onAdd={a=>setAccounts(p=>[...p,a])} />}
      {selected && <AccountPanel account={selected} onClose={()=>setSelected(null)} />}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text-primary)', margin:'0 0 2px' }}>ABM / TAM</h1>
          <p style={{ fontSize:13, color:'var(--text-muted)', margin:0 }}>Account-Based Marketing · {accounts.length} comptes cibles</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={()=>setShowTam(true)} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, border:'1px solid var(--card-border)', background:'var(--card-bg)', color:'var(--text-secondary)', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            <BarChart2 size={13}/>TAM Calculator
          </button>
          <button onClick={()=>setShowAdd(true)} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
            <Plus size={13}/>Ajouter un compte
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          { l:'TAM total',      v:`${(totalTam/1000000).toFixed(1)}M€`,  icon:<Target size={17}/>,    color:'#7C3AED', bg:'#F5F3FF' },
          { l:'Comptes cibles', v:accounts.filter(a=>a.status==='target').length, icon:<Building2 size={17}/>, color:'#2563EB', bg:'#EFF6FF' },
          { l:'Engagés',        v:engagedCount,                           icon:<TrendingUp size={17}/>,color:'#059669', bg:'#ECFDF5' },
          { l:'Score moyen',    v:avgScore,                               icon:<CheckCircle size={17}/>,color:'#D97706', bg:'#FFFBEB' },
        ].map((m,i) => (
          <div key={i} style={{ borderRadius:14, border:'1px solid var(--card-border)', background:'var(--card-bg)', padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:38, height:38, borderRadius:10, background:m.bg, display:'flex', alignItems:'center', justifyContent:'center', color:m.color }}>{m.icon}</div>
            <div>
              <div style={{ fontSize:22, fontWeight:800, color:'var(--text-primary)' }}>{m.v}</div>
              <div style={{ fontSize:12, color:'var(--text-muted)' }}>{m.l}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:14, marginBottom:18 }}>
        <div style={{ borderRadius:16, border:'1px solid var(--card-border)', background:'var(--card-bg)', padding:20 }}>
          <h2 style={{ fontWeight:700, fontSize:14, color:'var(--text-primary)', marginBottom:14 }}>TAM par industrie</h2>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {industryData.map((item, i) => {
              const pct = Math.round(item.v/totalTam*100);
              const COLORS = ['#7C3AED','#059669','#2563EB','#D97706','#6B7280'];
              return (
                <div key={item.l}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:13, color:'var(--text-secondary)' }}>{item.l}</span>
                    <div style={{ display:'flex', gap:12 }}>
                      <span style={{ fontSize:12, color:'var(--text-muted)' }}>{pct}%</span>
                      <span style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>{(item.v/1000000).toFixed(1)}M€</span>
                    </div>
                  </div>
                  <div style={{ height:7, borderRadius:9999, background:'var(--body-bg)' }}>
                    <div style={{ height:'100%', borderRadius:9999, background:COLORS[i%COLORS.length], width:`${pct}%`, transition:'width .4s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ borderRadius:16, border:'1px solid var(--card-border)', background:'var(--card-bg)', padding:20 }}>
          <h2 style={{ fontWeight:700, fontSize:14, color:'var(--text-primary)', marginBottom:14 }}>Couverture contacts</h2>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
            <div style={{ position:'relative', width:90, height:90 }}>
              <svg width="90" height="90" style={{ transform:'rotate(-90deg)' }}>
                <circle cx="45" cy="45" r="36" fill="none" stroke="var(--card-border)" strokeWidth="8" />
                <circle cx="45" cy="45" r="36" fill="none" stroke="var(--color-primary)" strokeWidth="8"
                  strokeDasharray={`${2*Math.PI*36}`} strokeDashoffset={`${2*Math.PI*36*(1-coveragePct/100)}`}
                  strokeLinecap="round" />
              </svg>
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column' }}>
                <span style={{ fontSize:20, fontWeight:800, color:'var(--color-primary)' }}>{coveragePct}%</span>
              </div>
            </div>
            <div style={{ fontSize:12, color:'var(--text-muted)', textAlign:'center' }}>des décideurs<br/>sont engagés</div>
            <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:6 }}>
              {TIERS.slice(1).map(t => {
                const count = accounts.filter(a=>a.status===t.value).length;
                const pct2 = Math.round(count/accounts.length*100);
                return (
                  <div key={t.value} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:12, color:'var(--text-secondary)' }}>{t.label.split('—')[1]?.trim()}</span>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <div style={{ width:60, height:5, borderRadius:9999, background:'var(--body-bg)' }}>
                        <div style={{ height:'100%', borderRadius:9999, background:t.color, width:`${pct2}%` }} />
                      </div>
                      <span style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)', minWidth:16 }}>{count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Filters + list */}
      <div style={{ display:'flex', gap:8, marginBottom:14, alignItems:'center' }}>
        <div style={{ position:'relative' }}>
          <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher..."
            style={{ paddingLeft:32, paddingRight:12, paddingTop:8, paddingBottom:8, border:'1px solid var(--card-border)', borderRadius:10, fontSize:13, outline:'none', background:'var(--card-bg)', color:'var(--text-primary)' }} />
        </div>
        {TIERS.map(t => (
          <button key={t.value} onClick={()=>setTier(t.value)}
            style={{ padding:'7px 14px', borderRadius:10, border:'none', fontSize:12, fontWeight:600, cursor:'pointer', background:tier===t.value?'var(--color-primary)':'var(--card-bg)', color:tier===t.value?'#fff':'var(--text-secondary)', boxShadow:tier===t.value?'none':'0 0 0 1px var(--card-border)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Accounts table */}
      <div style={{ borderRadius:16, border:'1px solid var(--card-border)', background:'var(--card-bg)', overflow:'hidden' }}>
        <div style={{ padding:'10px 20px', borderBottom:'1px solid var(--card-border)', background:'var(--body-bg)', display:'grid', gridTemplateColumns:'2fr 1fr 1fr 80px 120px 60px', gap:12, alignItems:'center' }}>
          {['Compte','Secteur','Contacts','TAM','Engagement','Score'].map(h => (
            <span key={h} style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.05em' }}>{h}</span>
          ))}
        </div>

        {filtered.map(account => {
          const tierInfo = TIERS.find(t=>t.value===account.status);
          const COLORS = ['#6D28D9','#2563EB','#059669','#D97706','#DC2626','#0891B2'];
          const hash = account.id.charCodeAt(0) % COLORS.length;
          return (
            <div key={account.id}
              style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 80px 120px 60px', gap:12, alignItems:'center', padding:'14px 20px', borderBottom:'1px solid var(--card-border)', cursor:'pointer', transition:'background .15s' }}
              onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='var(--body-bg)'}
              onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}
              onClick={()=>setSelected(account)}>
              {/* Company */}
              <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:COLORS[hash], display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:12, flexShrink:0 }}>{account.logo}</div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:13, color:'var(--text-primary)' }}>{account.company}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <span style={{ fontSize:10, padding:'1px 6px', borderRadius:9999, background:tierInfo?.color?`${tierInfo.color}15`:'#F3F4F6', color:tierInfo?.color||'#6B7280', fontWeight:700 }}>
                      {tierInfo?.label.split('—')[1]?.trim()}
                    </span>
                    {account.signals && account.signals.length > 0 && (
                      <span style={{ fontSize:9, padding:'1px 5px', borderRadius:9999, background:'#FEF3C7', color:'#D97706', fontWeight:700 }}>⚡ {account.signals.length}</span>
                    )}
                  </div>
                </div>
              </div>
              {/* Industry */}
              <div>
                <div style={{ fontSize:13, color:'var(--text-secondary)' }}>{account.industry}</div>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>{account.size}</div>
              </div>
              {/* Contacts */}
              <div style={{ fontSize:13, color:'var(--text-primary)', fontWeight:600 }}>
                {account.engaged}/{account.contacts}
                <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:400 }}>engagés</div>
              </div>
              {/* TAM */}
              <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>
                {(account.tam/1000000).toFixed(1)}M€
              </div>
              {/* Engagement bar */}
              <div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>
                  {account.contacts > 0 ? Math.round(account.engaged/account.contacts*100) : 0}% couverture
                </div>
                <div style={{ height:6, borderRadius:9999, background:'var(--body-bg)' }}>
                  <div style={{ height:'100%', borderRadius:9999, background:'var(--color-primary)', width:`${account.contacts>0?account.engaged/account.contacts*100:0}%`, transition:'width .4s' }} />
                </div>
              </div>
              {/* Score gauge */}
              <div style={{ display:'flex', justifyContent:'center' }}>
                <ScoreGauge score={account.score} />
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:'48px 0', color:'var(--text-muted)' }}>
            <Target size={36} style={{ margin:'0 auto 10px', color:'var(--card-border)' }} />
            <p style={{ fontSize:13 }}>Aucun compte trouvé</p>
          </div>
        )}
      </div>
    </div>
  );
}
