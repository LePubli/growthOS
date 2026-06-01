import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import {
  ArrowLeft, CheckCircle, Loader2, AlertCircle, Download, Users,
  Mail, Building2, ExternalLink, Search, Play, Pause, RefreshCw,
  Filter, Star, ChevronDown, X, Zap, BarChart2, Clock, Target,
} from 'lucide-react';
import { toast } from 'sonner';

/* ─────────────── types & config ─────────────── */

const TYPE_CONFIG: Record<string,{name:string;icon:string;color:string}> = {
  linkedin:    { name:'LinkedIn',     icon:'💼', color:'#0A66C2' },
  google:      { name:'Google Maps',  icon:'🗺️', color:'#EA4335' },
  societe_info:{ name:'Societe.info', icon:'🏢', color:'#059669' },
  custom:      { name:'Custom',       icon:'⚙️', color:'#7C3AED' },
};

const STATUS_CONFIG: Record<string,{label:string;color:string;bg:string}> = {
  completed: { label:'Terminé',  color:'#059669', bg:'#ECFDF5' },
  running:   { label:'En cours', color:'#2563EB', bg:'#EFF6FF' },
  paused:    { label:'Pausé',    color:'#D97706', bg:'#FEF3C7' },
  error:     { label:'Erreur',   color:'#DC2626', bg:'#FEF2F2' },
};

type Prospect = { name:string; title:string; company:string; email:string; linkedin:string; score:number; enriched?:boolean; location?:string; employees?:string };

const MOCK_RESULTS: Record<string,any> = {
  '1': {
    id:'1', type:'linkedin', name:'Directeurs commerciaux Paris',
    status:'completed', count:127, duration:'2m 34s', createdAt:'2026-05-31 14:23',
    query:'Directeur commercial Paris site:linkedin.com',
    logs:['[14:23:01] Démarrage du scraping LinkedIn','[14:23:04] 127 profils identifiés','[14:23:12] Enrichissement des emails...','[14:23:45] Vérification des emails...','[14:24:18] Calcul des scores IA...','[14:25:35] ✅ Job terminé — 127 prospects, 98 emails vérifiés'],
    prospects:[
      { name:'Alexandre Bernard', title:'Directeur Commercial',   company:'Acme SaaS',  email:'a.bernard@acme.fr',     linkedin:'linkedin.com/in/alexandre-bernard', score:88, enriched:true,  location:'Paris 8e',   employees:'51-200' },
      { name:'Marie Rousseau',    title:'VP Sales France',         company:'TechVision', email:'marie.rousseau@tv.fr',   linkedin:'linkedin.com/in/marie-rousseau',    score:92, enriched:true,  location:'Paris 9e',   employees:'200+' },
      { name:'Thomas Leclerc',    title:'Head of Sales',           company:'GrowFast',   email:'',                       linkedin:'linkedin.com/in/thomas-leclerc',    score:74, enriched:false, location:'Neuilly',    employees:'11-50' },
      { name:'Camille Petit',     title:'Directrice des Ventes',   company:'CloudPro',   email:'camille@cloudpro.io',    linkedin:'linkedin.com/in/camille-petit',     score:81, enriched:true,  location:'Paris 17e',  employees:'51-200' },
      { name:'Nicolas Martin',    title:'Sales Director EMEA',     company:'DataHub',    email:'n.martin@datahub.com',   linkedin:'',                                   score:68, enriched:true,  location:'La Défense', employees:'1000+' },
      { name:'Julie Fontaine',    title:'Responsable Commercial',  company:'SaaSWorks',  email:'j.fontaine@saasworks.io',linkedin:'linkedin.com/in/julie-fontaine',    score:79, enriched:true,  location:'Paris 2e',   employees:'11-50' },
    ],
  },
  '2': {
    id:'2', type:'google', name:'Agences immobilières Bordeaux',
    status:'running', count:45, duration:'1m 12s', createdAt:'2026-05-31 15:10',
    query:'agence immobilière Bordeaux Gironde',
    logs:['[15:10:01] Démarrage Google Maps','[15:10:08] 45 établissements trouvés','[15:10:34] Extraction des contacts...','[15:11:22] ⟳ Enrichissement en cours...'],
    prospects:[
      { name:'Immobilier Bordeaux Centre', title:'', company:'Bordeaux Immo', email:'contact@bdx-immo.fr', linkedin:'', score:55, location:'Bordeaux Centre', employees:'1-10' },
      { name:'Agence du Lac',              title:'', company:'Agence du Lac', email:'info@agence-lac.fr',  linkedin:'', score:62, location:'Mérignac',       employees:'1-10' },
    ],
  },
};

/* ─────────────── live progress ─────────────── */

function LiveProgress({ count, total = 127 }: { count:number; total?:number }) {
  const pct = Math.min(100, Math.round(count/total*100));
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
        <span style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>Collecte en cours…</span>
        <span style={{ fontSize:13, fontWeight:700, color:'var(--color-primary)' }}>{count}/{total} prospects</span>
      </div>
      <div style={{ height:8, borderRadius:9999, background:'var(--body-bg)', overflow:'hidden' }}>
        <div style={{ height:'100%', borderRadius:9999, background:'var(--color-primary)', width:`${pct}%`, transition:'width .5s', backgroundImage:'linear-gradient(90deg, var(--color-primary), #A78BFA)' }}/>
      </div>
      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>{pct}% · Enrichissement des emails en cours</div>
    </div>
  );
}

/* ─────────────── log panel ─────────────── */

function LogPanel({ logs }: { logs:string[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:'smooth'}); },[logs]);
  return (
    <div style={{ borderRadius:12, background:'#0F172A', padding:'12px 14px', maxHeight:160, overflowY:'auto', fontFamily:'monospace', fontSize:11 }}>
      {logs.map((l,i)=>(
        <div key={i} style={{ color:l.includes('✅')?'#22C55E':l.includes('⟳')||l.includes('...')?'#F59E0B':'#94A3B8', lineHeight:1.8 }}>{l}</div>
      ))}
      <div ref={bottomRef}/>
    </div>
  );
}

/* ─────────────── main ─────────────── */

export default function SourcingJobPage() {
  const params = useParams<{id:string}>();
  const [, navigate] = useLocation();
  const [job, setJob] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [showLogs, setShowLogs] = useState(false);
  const [emailOnly, setEmailOnly] = useState(false);
  const [minScore, setMinScore] = useState(0);
  const [importing, setImporting] = useState<Set<string>>(new Set());
  const [imported, setImported] = useState<Set<string>>(new Set());
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const [liveCount, setLiveCount] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(()=>{
    const data = MOCK_RESULTS[params.id||''] || {
      id:params.id, type:'linkedin', name:`Scraping #${params.id}`, status:'completed',
      count:0, duration:'—', createdAt:'—', query:'—', prospects:[], logs:[],
    };
    setJob(data);
    setLogs(data.logs||[]);
    if (data.status==='running') {
      setLiveCount(data.count);
      const interval = setInterval(()=>{
        setLiveCount(c=>{
          const next = Math.min(c+Math.floor(Math.random()*5+1),127);
          setLogs(l=>[...l,`[${new Date().toLocaleTimeString('fr-FR')}] ${next} prospects collectés…`]);
          if (next>=127) { clearInterval(interval); setJob((j:any)=>j?{...j,status:'completed',count:127}:j); }
          return next;
        });
      }, 1800);
      return ()=>{ clearInterval(interval); };
    }
    return undefined;
  },[params.id]);

  const importProspect = async (name:string) => {
    setImporting(s=>new Set([...s,name]));
    await new Promise(r=>setTimeout(r,800));
    setImporting(s=>{ const n=new Set(s); n.delete(name); return n; });
    setImported(s=>new Set([...s,name]));
    toast.success(`${name} importé dans les prospects`);
  };

  const importAll = async () => {
    const toImport = filtered.filter((p:Prospect)=>!imported.has(p.name));
    for (const p of toImport) { await importProspect(p.name); await new Promise(r=>setTimeout(r,200)); }
  };

  const exportCSV = () => {
    if (!job) return;
    const rows = [['Nom','Titre','Entreprise','Email','LinkedIn','Score','Localisation'],
      ...job.prospects.map((p:Prospect)=>[p.name,p.title,p.company,p.email,p.linkedin,p.score,p.location||''])];
    const blob = new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`scraping_${job.name}.csv`; a.click();
    toast.success('Export CSV téléchargé');
  };

  if (!job) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', background:'var(--body-bg)' }}>
      <Loader2 size={28} className="animate-spin" style={{ color:'var(--color-primary)' }}/>
    </div>
  );

  const type = TYPE_CONFIG[job.type]||{name:job.type,icon:'🔍',color:'#6B7280'};
  const st = STATUS_CONFIG[job.status]||STATUS_CONFIG.completed;
  const filtered = (job.prospects||[]).filter((p:Prospect)=>{
    const q = search.toLowerCase();
    if (q && !`${p.name} ${p.company} ${p.title}`.toLowerCase().includes(q)) return false;
    if (emailOnly && !p.email) return false;
    if (p.score < minScore) return false;
    return true;
  });

  const withEmail = (job.prospects||[]).filter((p:Prospect)=>p.email).length;
  const avgScore = (job.prospects||[]).length ? Math.round((job.prospects||[]).reduce((s:number,p:Prospect)=>s+p.score,0)/(job.prospects||[]).length) : 0;

  return (
    <div style={{ minHeight:'100vh', padding:'20px 24px', background:'var(--body-bg)' }}>
      {/* Back */}
      <button onClick={()=>navigate('/sourcing')} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', color:'var(--text-muted)', fontSize:13, cursor:'pointer', marginBottom:18, padding:0 }}>
        <ArrowLeft size={14}/>Retour au scraping
      </button>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap', marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:50, height:50, borderRadius:14, background:'var(--card-bg)', border:'1px solid var(--card-border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>{type.icon}</div>
          <div>
            <h1 style={{ fontSize:18, fontWeight:700, color:'var(--text-primary)', margin:'0 0 5px' }}>{job.name}</h1>
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              <span style={{ fontSize:12, fontWeight:700, padding:'2px 10px', borderRadius:9999, background:st.bg, color:st.color, display:'flex', alignItems:'center', gap:4 }}>
                {job.status==='running'&&<Loader2 size={10} className="animate-spin"/>}
                {st.label}
              </span>
              <span style={{ fontSize:12, color:type.color, fontWeight:600 }}>{type.name}</span>
              <span style={{ fontSize:12, color:'var(--text-muted)' }}>📅 {job.createdAt}</span>
              <span style={{ fontSize:12, color:'var(--text-muted)' }}>⏱ {job.duration}</span>
            </div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button onClick={()=>setShowLogs(v=>!v)} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 13px', borderRadius:10, border:`1px solid ${showLogs?'var(--color-primary)':'var(--card-border)'}`, background:showLogs?'var(--color-primary)':'var(--card-bg)', color:showLogs?'#fff':'var(--text-secondary)', fontSize:12, cursor:'pointer', fontWeight:600 }}>
            <BarChart2 size={13}/>Logs
          </button>
          <button onClick={exportCSV} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 13px', borderRadius:10, border:'1px solid var(--card-border)', background:'var(--card-bg)', color:'var(--text-secondary)', fontSize:12, cursor:'pointer' }}>
            <Download size={13}/>Export CSV
          </button>
          <button onClick={importAll} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 16px', borderRadius:10, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>
            <Users size={13}/>Importer tout ({filtered.filter((p:Prospect)=>!imported.has(p.name)).length})
          </button>
        </div>
      </div>

      {/* Query */}
      <div style={{ padding:'9px 14px', borderRadius:10, background:'var(--card-bg)', border:'1px solid var(--card-border)', fontSize:12, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:8, marginBottom:18, fontFamily:'monospace' }}>
        <Search size={12}/>
        <span>{job.query}</span>
      </div>

      {/* Live progress (running only) */}
      {job.status==='running' && <LiveProgress count={liveCount}/>}

      {/* Logs */}
      {showLogs && <div style={{ marginBottom:18 }}><LogPanel logs={logs}/></div>}

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          { l:'Collectés',      v:job.count,         c:'#2563EB', bg:'#EFF6FF', icon:<Users size={16}/> },
          { l:'Importés',       v:imported.size,      c:'#059669', bg:'#ECFDF5', icon:<CheckCircle size={16}/> },
          { l:'Avec email',     v:withEmail,          c:'#7C3AED', bg:'#F5F3FF', icon:<Mail size={16}/> },
          { l:'Score moyen',    v:avgScore,           c:'#D97706', bg:'#FFFBEB', icon:<Target size={16}/> },
        ].map((s,i)=>(
          <div key={i} style={{ borderRadius:12, border:'1px solid var(--card-border)', background:'var(--card-bg)', padding:'12px 14px', display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:34, height:34, borderRadius:9, background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', color:s.c, flexShrink:0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize:20, fontWeight:800, color:s.c }}>{s.v}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>{s.l}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ position:'relative', flex:1, minWidth:200 }}>
          <Search size={12} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filtrer les résultats…"
            style={{ width:'100%', paddingLeft:30, paddingRight:12, paddingTop:8, paddingBottom:8, borderRadius:10, border:'1px solid var(--card-border)', background:'var(--card-bg)', color:'var(--text-primary)', fontSize:13, outline:'none', boxSizing:'border-box' }}/>
        </div>
        <button onClick={()=>setEmailOnly(v=>!v)} style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 14px', borderRadius:10, border:`1px solid ${emailOnly?'var(--color-primary)':'var(--card-border)'}`, background:emailOnly?'var(--color-primary)':'var(--card-bg)', color:emailOnly?'#fff':'var(--text-secondary)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
          <Mail size={12}/>Avec email seulement
        </button>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap' }}>Score min :</span>
          <input type="range" min={0} max={100} step={5} value={minScore} onChange={e=>setMinScore(+e.target.value)} style={{ width:90, accentColor:'var(--color-primary)' }}/>
          <span style={{ fontSize:12, fontWeight:700, color:'var(--color-primary)', minWidth:24 }}>{minScore}</span>
        </div>
        <span style={{ fontSize:12, color:'var(--text-muted)' }}>{filtered.length} résultat{filtered.length>1?'s':''}</span>
      </div>

      {/* Results */}
      <div style={{ background:'var(--card-bg)', borderRadius:16, border:'1px solid var(--card-border)', overflow:'hidden' }}>
        {filtered.length===0 ? (
          <div style={{ padding:'48px 0', textAlign:'center', color:'var(--text-muted)' }}>
            <Users size={40} style={{ margin:'0 auto 12px', opacity:.3 }}/>
            <div style={{ fontSize:14 }}>Aucun résultat</div>
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'var(--body-bg)' }}>
                  {['','Nom','Poste','Entreprise','Email','LinkedIn','Loc.','Score','Statut','Action'].map(h=>(
                    <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.04em', whiteSpace:'nowrap', borderBottom:'1px solid var(--card-border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p:Prospect,i:number)=>{
                  const isImp = imported.has(p.name);
                  const isStar = starred.has(p.name);
                  const scoreColor = p.score>=80?'#059669':p.score>=60?'#D97706':'#6B7280';
                  const scoreBg = p.score>=80?'#ECFDF5':p.score>=60?'#FFFBEB':'#F3F4F6';
                  return (
                    <tr key={i} style={{ borderBottom:'1px solid var(--card-border)' }}
                      onMouseEnter={e=>(e.currentTarget as HTMLTableRowElement).style.background='var(--body-bg)'}
                      onMouseLeave={e=>(e.currentTarget as HTMLTableRowElement).style.background='transparent'}>
                      <td style={{ padding:'10px 8px 10px 14px' }}>
                        <button onClick={()=>setStarred(s=>{ const n=new Set(s); isStar?n.delete(p.name):n.add(p.name); return n; })}
                          style={{ background:'none', border:'none', cursor:'pointer', color:isStar?'#F59E0B':'var(--card-border)', display:'flex' }}>
                          <Star size={13} fill={isStar?'#F59E0B':'none'}/>
                        </button>
                      </td>
                      <td style={{ padding:'10px 12px', fontWeight:600, fontSize:13, color:'var(--text-primary)', whiteSpace:'nowrap' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                          <div style={{ width:28, height:28, borderRadius:8, background:'var(--color-primary)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:11, flexShrink:0 }}>{p.name[0]}</div>
                          {p.name}
                          {p.enriched && <span title="Enrichi"><CheckCircle size={11} color="#059669"/></span>}
                        </div>
                      </td>
                      <td style={{ padding:'10px 12px', fontSize:12, color:'var(--text-muted)', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.title||'—'}</td>
                      <td style={{ padding:'10px 12px', fontSize:12, color:'var(--text-secondary)', whiteSpace:'nowrap' }}>
                        <span style={{ display:'flex', alignItems:'center', gap:4 }}><Building2 size={11}/>{p.company}</span>
                        {p.employees && <span style={{ fontSize:10, color:'var(--text-muted)' }}>{p.employees}</span>}
                      </td>
                      <td style={{ padding:'10px 12px', fontSize:12, whiteSpace:'nowrap' }}>
                        {p.email ? <a href={`mailto:${p.email}`} style={{ color:'var(--color-primary)', textDecoration:'none', display:'flex', alignItems:'center', gap:4 }}><Mail size={10}/>{p.email}</a> : <span style={{ color:'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ padding:'10px 12px' }}>
                        {p.linkedin ? <a href={`https://${p.linkedin}`} target="_blank" rel="noopener noreferrer" style={{ color:'#0A66C2', display:'flex', alignItems:'center', gap:4, fontSize:12 }}><ExternalLink size={11}/>Profil</a> : <span style={{ color:'var(--text-muted)', fontSize:12 }}>—</span>}
                      </td>
                      <td style={{ padding:'10px 12px', fontSize:11, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{p.location||'—'}</td>
                      <td style={{ padding:'10px 12px' }}>
                        <span style={{ fontWeight:800, fontSize:13, padding:'3px 9px', borderRadius:9999, background:scoreBg, color:scoreColor }}>{p.score}</span>
                      </td>
                      <td style={{ padding:'10px 12px' }}>
                        {isImp ? (
                          <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'#059669', fontWeight:600, whiteSpace:'nowrap' }}><CheckCircle size={12}/>Importé</span>
                        ) : (
                          <span style={{ fontSize:11, color:'var(--text-muted)' }}>En attente</span>
                        )}
                      </td>
                      <td style={{ padding:'10px 12px' }}>
                        {!isImp && (
                          <button onClick={()=>importProspect(p.name)} disabled={importing.has(p.name)}
                            style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 11px', borderRadius:8, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', opacity:importing.has(p.name)?.6:1 }}>
                            {importing.has(p.name)?<Loader2 size={10} className="animate-spin"/>:<Users size={10}/>}
                            Importer
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
