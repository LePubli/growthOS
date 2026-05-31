import { useState, useEffect } from 'react';
import { Search, Zap, CheckCircle, AlertCircle, Users, Loader2, RefreshCw, ChevronRight, Mail, Phone, Building2, Star, Trash2, MergeIcon, X, TrendingUp, Shield, Activity } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

const MOCK_CONTACTS = [
  { id:'1', name:'Sophie Martin', email:'sophie.martin@techcorp.fr', company:'TechCorp',    linkedin:'linkedin.com/in/sophie-martin', phone:'+33 6 12 34 56 78', score:92, enriched:true,  duplicate:false, lastActivity:'il y a 2h',  tags:['chaud','décideur'],   emailConfidence:95, linkedinConfidence:88, phoneConfidence:72 },
  { id:'2', name:'Emma Leroy',    email:'emma.leroy@startupx.io',    company:'StartupX',    linkedin:'', phone:'', score:74, enriched:false, duplicate:false, lastActivity:'il y a 1j',  tags:['prospect'],           emailConfidence:82, linkedinConfidence:0,  phoneConfidence:0  },
  { id:'3', name:'Sophie Martin', email:'sophie@techcorp.fr',        company:'TechCorp',    linkedin:'', phone:'', score:45, enriched:false, duplicate:true,  lastActivity:'il y a 5j',  tags:[],                     emailConfidence:61, linkedinConfidence:0,  phoneConfidence:0  },
  { id:'4', name:'Paul Dupont',   email:'paul.dupont@bigsales.fr',   company:'BigSales SAS',linkedin:'linkedin.com/in/paul-dupont', phone:'+33 6 34 56 78 90', score:88, enriched:true, duplicate:false, lastActivity:'il y a 3h',  tags:['chaud','négociation'],emailConfidence:97, linkedinConfidence:91, phoneConfidence:85 },
  { id:'5', name:'Camille Bernard',email:'camille@datainc.com',       company:'DataInc',     linkedin:'linkedin.com/in/camille-bernard', phone:'', score:61, enriched:true, duplicate:false, lastActivity:'il y a 1j', tags:['prospect'],           emailConfidence:78, linkedinConfidence:74, phoneConfidence:0  },
  { id:'6', name:'Luc Moreau',    email:'luc.moreau@growthco.fr',    company:'GrowthCo',    linkedin:'', phone:'+33 6 56 78 90 12', score:95, enriched:false, duplicate:false, lastActivity:'il y a 30 min', tags:['client','gagné'], emailConfidence:91, linkedinConfidence:0, phoneConfidence:79 },
  { id:'7', name:'Alice Rousseau',email:'alice@alphainno.fr',         company:'AlphaInno',   linkedin:'linkedin.com/in/alice-rousseau', phone:'+33 6 11 22 33 44', score:79, enriched:false, duplicate:false, lastActivity:'il y a 2j', tags:['froid'],             emailConfidence:86, linkedinConfidence:83, phoneConfidence:68 },
  { id:'8', name:'Marc Lefebvre', email:'m.lefebvre@techcorp.fr',    company:'TechCorp',    linkedin:'', phone:'', score:52, enriched:false, duplicate:true,  lastActivity:'il y a 4j',  tags:[],                     emailConfidence:70, linkedinConfidence:0,  phoneConfidence:0  },
];

const ENRICH_SOURCES = [
  { id:'linkedin', label:'LinkedIn',   icon:'💼', fields:['Poste','Ancienneté','Connexions','Photo'], color:'#0077B5' },
  { id:'hunter',   label:'Hunter.io',  icon:'🎯', fields:['Email vérifié','Format email','Score'], color:'#7C3AED' },
  { id:'clearbit', label:'Clearbit',   icon:'🔍', fields:['Taille équipe','Secteur','CA estimé'], color:'#2563EB' },
  { id:'pappers',  label:'Pappers.fr', icon:'🏢', fields:['SIREN','Effectifs','Capital social'], color:'#059669' },
];

const HISTORY = [
  { id:'h1', contact:'Sophie Martin', source:'LinkedIn + Hunter.io', date:'Il y a 2j', fieldsAdded:4, score:92 },
  { id:'h2', contact:'Paul Dupont',   source:'Clearbit + LinkedIn',  date:'Il y a 3j', fieldsAdded:6, score:88 },
  { id:'h3', contact:'Camille Bernard',source:'LinkedIn',            date:'Il y a 4j', fieldsAdded:3, score:61 },
];

function EnrichModal({ contacts, onClose, onDone }: { contacts:any[]; onClose:()=>void; onDone:(ids:string[])=>void }) {
  const [selected, setSelected] = useState<string[]>(['linkedin','hunter']);
  const [loading, setLoading]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone]         = useState(false);
  const isBulk = contacts.length > 1;

  const toggle = (id:string)=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);

  const run = async ()=>{
    setLoading(true);
    const steps = isBulk ? contacts.length : 3;
    for (let i=0;i<=steps;i++) {
      await new Promise(r=>setTimeout(r,isBulk?400:600));
      setProgress(Math.round((i/steps)*100));
    }
    setDone(true); setLoading(false);
    onDone(contacts.map(c=>c.id));
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={onClose}>
      <div style={{ background:'var(--card-bg)', borderRadius:20, width:'100%', maxWidth:480, padding:24, boxShadow:'0 20px 60px rgba(0,0,0,.2)' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <div>
            <h2 style={{ fontSize:17, fontWeight:700, color:'var(--text-primary)', margin:0 }}>{isBulk?`Enrichir ${contacts.length} contacts`:`Enrichir — ${contacts[0].name}`}</h2>
            <p style={{ fontSize:12, color:'var(--text-muted)', margin:'3px 0 0' }}>Sélectionnez les sources d'enrichissement</p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={18}/></button>
        </div>
        {!done ? (
          <>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:18 }}>
              {ENRICH_SOURCES.map(src=>(
                <label key={src.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:12, border:`1px solid ${selected.includes(src.id)?src.color:'var(--card-border)'}`, background:selected.includes(src.id)?`${src.color}08`:'var(--body-bg)', cursor:'pointer' }}>
                  <input type="checkbox" checked={selected.includes(src.id)} onChange={()=>toggle(src.id)} style={{ accentColor:src.color, flexShrink:0 }}/>
                  <span style={{ fontSize:18 }}>{src.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:selected.includes(src.id)?'var(--text-primary)':'var(--text-muted)' }}>{src.label}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:1 }}>{src.fields.join(' · ')}</div>
                  </div>
                  {selected.includes(src.id) && <CheckCircle size={15} style={{ color:src.color, flexShrink:0 }}/>}
                </label>
              ))}
            </div>
            {loading && (
              <div style={{ marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                  <span style={{ fontSize:12, color:'var(--text-muted)' }}>{isBulk?`Enrichissement en cours (${Math.round(progress/100*contacts.length)}/${contacts.length})...`:'Enrichissement en cours...'}</span>
                  <span style={{ fontSize:12, fontWeight:700, color:'var(--color-primary)' }}>{progress}%</span>
                </div>
                <div style={{ height:6, borderRadius:9999, background:'var(--card-border)', overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${progress}%`, background:'var(--color-primary)', borderRadius:9999, transition:'width .3s' }}/>
                </div>
              </div>
            )}
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={onClose} style={{ flex:1, padding:'10px', borderRadius:10, border:'1px solid var(--card-border)', background:'transparent', color:'var(--text-secondary)', fontSize:13, cursor:'pointer' }}>Annuler</button>
              <button onClick={run} disabled={loading||selected.length===0}
                style={{ flex:2, padding:'10px', borderRadius:10, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, opacity:loading||selected.length===0?0.7:1 }}>
                {loading?<Loader2 size={14} style={{ animation:'spin 1s linear infinite' }}/>:<Zap size={14}/>}
                Lancer l'enrichissement
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign:'center', padding:'12px 0' }}>
            <div style={{ width:56, height:56, borderRadius:'50%', background:'#ECFDF5', margin:'0 auto 12px', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <CheckCircle size={28} style={{ color:'#059669' }}/>
            </div>
            <h3 style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)', marginBottom:6 }}>Enrichissement terminé !</h3>
            <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:18 }}>
              {isBulk?`${contacts.length} contacts enrichis`:`${contacts[0].name} a été enrichi`} avec {selected.length} source{selected.length>1?'s':''}.
            </p>
            <button onClick={onClose} style={{ padding:'9px 24px', borderRadius:10, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>Fermer</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ContactIntelPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState<'all'|'enriched'|'not_enriched'|'duplicates'>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [enrichTarget, setEnrichTarget] = useState<any[]|null>(null);
  const [tab, setTab]           = useState<'contacts'|'history'>('contacts');

  useEffect(()=>{
    apiClient.get('/contacts')
      .then((data:any)=>{ setContacts(Array.isArray(data)&&data.length>0?data:MOCK_CONTACTS); })
      .catch(()=>setContacts(MOCK_CONTACTS))
      .finally(()=>setLoading(false));
  },[]);

  const markEnriched = (ids:string[])=>{
    setContacts(c=>c.map(x=>ids.includes(x.id)?{...x,enriched:true}:x));
  };

  const removeDuplicate = (id:string)=>{
    setContacts(c=>c.filter(x=>x.id!==id));
    toast.success('Contact supprimé');
  };

  const mergeDuplicate = (id:string)=>{
    setContacts(c=>c.filter(x=>x.id!==id));
    toast.success('Contact fusionné avec l\'original');
  };

  const toggleSelect = (id:string)=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  const selectAll = ()=>setSelected(filtered.map(c=>c.id));
  const clearAll = ()=>setSelected([]);

  const filtered = contacts.filter(c=>{
    if (filter==='enriched' && !c.enriched) return false;
    if (filter==='not_enriched' && c.enriched) return false;
    if (filter==='duplicates' && !c.duplicate) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.company?.toLowerCase().includes(search.toLowerCase()) && !c.email?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const duplicates    = contacts.filter(c=>c.duplicate);
  const notEnriched   = contacts.filter(c=>!c.enriched);
  const avgScore      = contacts.length ? Math.round(contacts.reduce((s,c)=>s+c.score,0)/contacts.length) : 0;
  const enrichedCount = contacts.filter(c=>c.enriched).length;

  return (
    <div style={{ minHeight:'100vh', padding:24, background:'var(--body-bg)' }}>
      {enrichTarget && <EnrichModal contacts={enrichTarget} onClose={()=>setEnrichTarget(null)} onDone={(ids)=>{ markEnriched(ids); setEnrichTarget(null); setSelected([]); }}/>}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'var(--text-primary)', margin:0 }}>Contact Intelligence</h1>
          <p style={{ fontSize:13, color:'var(--text-muted)', margin:'2px 0 0' }}>Enrichissement, déduplication et qualité des données</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {selected.length>0 && (
            <button onClick={()=>setEnrichTarget(contacts.filter(c=>selected.includes(c.id)))}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:10, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
              <Zap size={13}/>Enrichir {selected.length} sélectionné{selected.length>1?'s':''}
            </button>
          )}
          <button onClick={()=>setEnrichTarget(notEnriched)} disabled={notEnriched.length===0}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:10, border:'1px solid var(--card-border)', background:'var(--card-bg)', color:'var(--text-secondary)', fontSize:13, fontWeight:500, cursor:'pointer', opacity:notEnriched.length===0?0.5:1 }}>
            <RefreshCw size={13}/>Enrichir tous ({notEnriched.length})
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:20 }}>
        {[
          { l:'Total contacts',     v:contacts.length,                       icon:<Users size={15}/>,       color:'#2563EB', bg:'#EFF6FF' },
          { l:'Enrichis',           v:`${enrichedCount}/${contacts.length}`,  icon:<CheckCircle size={15}/>, color:'#059669', bg:'#ECFDF5' },
          { l:'Score moyen',        v:avgScore,                               icon:<Star size={15}/>,        color:'#D97706', bg:'#FEF3C7' },
          { l:'Doublons détectés',  v:duplicates.length,                      icon:<AlertCircle size={15}/>, color:duplicates.length>0?'#DC2626':'#059669', bg:duplicates.length>0?'#FEF2F2':'#ECFDF5' },
          { l:'À enrichir',         v:notEnriched.length,                     icon:<Zap size={15}/>,         color:'#7C3AED', bg:'#EDE9FE' },
          { l:'Qualité données',    v:`${contacts.length?Math.round((enrichedCount/contacts.length)*100):0}%`, icon:<TrendingUp size={15}/>, color:'#0891B2', bg:'#ECFEFF' },
        ].map((k,i)=>(
          <div key={i} style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:13, padding:'13px 14px', display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:9, background:k.bg, color:k.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{k.icon}</div>
            <div>
              <div style={{ fontSize:19, fontWeight:800, color:'var(--text-primary)', lineHeight:1.1 }}>{k.v}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>{k.l}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Duplicate alert banner */}
      {duplicates.length>0 && (
        <div style={{ padding:'12px 16px', borderRadius:12, marginBottom:14, background:'#FEF2F2', border:'1px solid #FECACA', display:'flex', alignItems:'center', gap:10 }}>
          <AlertCircle size={16} style={{ color:'#DC2626', flexShrink:0 }}/>
          <div style={{ flex:1 }}>
            <span style={{ fontSize:13, fontWeight:700, color:'#991B1B' }}>{duplicates.length} doublon{duplicates.length>1?'s':''} détecté{duplicates.length>1?'s':''} — </span>
            <span style={{ fontSize:12, color:'#DC2626' }}>des contacts semblent être des duplicatas. Fusionnez ou supprimez-les.</span>
          </div>
          <button onClick={()=>setFilter('duplicates')} style={{ padding:'4px 12px', borderRadius:8, border:'1px solid #FCA5A5', background:'transparent', color:'#DC2626', fontSize:12, fontWeight:600, cursor:'pointer', flexShrink:0 }}>
            Voir les doublons
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, padding:3, borderRadius:11, background:'var(--card-bg)', border:'1px solid var(--card-border)', marginBottom:14, width:'fit-content' }}>
        {([['contacts','Contacts'],['history','Historique enrichissement']] as const).map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{ padding:'6px 14px', borderRadius:8, border:'none', fontSize:13, fontWeight:tab===t?700:400, cursor:'pointer', background:tab===t?'var(--color-primary)':'transparent', color:tab===t?'#fff':'var(--text-muted)', transition:'all .15s' }}>
            {l}
          </button>
        ))}
      </div>

      {tab==='history' && (
        <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'var(--body-bg)' }}>
                {['Contact','Sources','Champs ajoutés','Score final','Date'].map(h=>(
                  <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', color:'var(--text-muted)', borderBottom:'1px solid var(--card-border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HISTORY.map(h=>(
                <tr key={h.id} style={{ borderBottom:'1px solid var(--card-border)' }}>
                  <td style={{ padding:'11px 16px', fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{h.contact}</td>
                  <td style={{ padding:'11px 16px', fontSize:12, color:'var(--text-secondary)' }}>{h.source}</td>
                  <td style={{ padding:'11px 16px', fontSize:13, fontWeight:700, color:'#059669', textAlign:'center' }}>+{h.fieldsAdded}</td>
                  <td style={{ padding:'11px 16px', textAlign:'center' }}>
                    <span style={{ fontSize:13, fontWeight:800, color:'var(--color-primary)' }}>{h.score}</span>
                  </td>
                  <td style={{ padding:'11px 16px', fontSize:12, color:'var(--text-muted)' }}>{h.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab==='contacts' && (
        <>
          {/* Filters */}
          <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
            <div style={{ position:'relative', flex:1, minWidth:200 }}>
              <Search size={13} style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher..."
                style={{ width:'100%', padding:'7px 12px 7px 32px', borderRadius:9, border:'1px solid var(--card-border)', background:'var(--card-bg)', color:'var(--text-primary)', fontSize:12, outline:'none', boxSizing:'border-box' }}/>
            </div>
            <div style={{ display:'flex', gap:5 }}>
              {[['all','Tous'],['enriched','Enrichis'],['not_enriched','À enrichir'],['duplicates','Doublons']] .map(([v,l])=>(
                <button key={v} onClick={()=>setFilter(v as any)}
                  style={{ padding:'5px 11px', borderRadius:8, border:'none', fontSize:12, fontWeight:500, cursor:'pointer', background:filter===v?'var(--color-primary)':'var(--card-bg)', color:filter===v?'#fff':'var(--text-muted)', outline:filter===v?'none':'1px solid var(--card-border)' }}>
                  {l}
                </button>
              ))}
            </div>
            <div style={{ display:'flex', gap:6, marginLeft:'auto' }}>
              {selected.length>0 && <button onClick={clearAll} style={{ fontSize:12, color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer' }}>Désélectionner</button>}
              <button onClick={selectAll} style={{ fontSize:12, color:'var(--color-primary)', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>Tout sélectionner</button>
            </div>
          </div>

          {loading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:'48px 0' }}>
              <Loader2 size={24} style={{ color:'var(--color-primary)', animation:'spin 1s linear infinite' }}/>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {filtered.map(c=>{
                const isSel = selected.includes(c.id);
                return (
                  <div key={c.id} style={{ background:'var(--card-bg)', border:`1px solid ${c.duplicate?'#FCA5A5':isSel?'var(--color-primary)':'var(--card-border)'}`, borderRadius:14, padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
                    <input type="checkbox" checked={isSel} onChange={()=>toggleSelect(c.id)} style={{ accentColor:'var(--color-primary)', flexShrink:0 }}/>

                    {/* Avatar */}
                    <div style={{ width:38, height:38, borderRadius:'50%', background:c.enriched?'var(--color-primary)':'var(--card-border)', color:c.enriched?'#fff':'var(--text-muted)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, flexShrink:0 }}>
                      {c.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                    </div>

                    {/* Info */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
                        <span style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>{c.name}</span>
                        {c.enriched && <span style={{ fontSize:10, padding:'1px 7px', borderRadius:9999, background:'#ECFDF5', color:'#059669', fontWeight:700, display:'flex', alignItems:'center', gap:3 }}><CheckCircle size={9}/>Enrichi</span>}
                        {c.duplicate && <span style={{ fontSize:10, padding:'1px 7px', borderRadius:9999, background:'#FEF2F2', color:'#DC2626', fontWeight:700, display:'flex', alignItems:'center', gap:3 }}><AlertCircle size={9}/>Doublon</span>}
                        {c.tags.map((t:string)=>(
                          <span key={t} style={{ fontSize:10, padding:'1px 7px', borderRadius:9999, background:'var(--body-bg)', color:'var(--text-muted)', border:'1px solid var(--card-border)' }}>{t}</span>
                        ))}
                      </div>
                      <div style={{ display:'flex', gap:10, marginTop:3, flexWrap:'wrap' }}>
                        <span style={{ fontSize:11, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:3 }}><Building2 size={9}/>{c.company}</span>
                        {c.email && <span style={{ fontSize:11, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:3 }}><Mail size={9}/>{c.email}</span>}
                        {c.phone && <span style={{ fontSize:11, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:3 }}><Phone size={9}/>{c.phone}</span>}
                      </div>

                      {/* Field confidence bars */}
                      {c.enriched && (
                        <div style={{ display:'flex', gap:10, marginTop:6, flexWrap:'wrap' }}>
                          {[
                            { l:'Email', v:c.emailConfidence },
                            { l:'LinkedIn', v:c.linkedinConfidence },
                            { l:'Tél.', v:c.phoneConfidence },
                          ].map(f=>(
                            <div key={f.l} style={{ display:'flex', alignItems:'center', gap:5 }}>
                              <span style={{ fontSize:10, color:'var(--text-muted)', width:44 }}>{f.l}</span>
                              <div style={{ width:48, height:3, borderRadius:9999, background:'var(--card-border)', overflow:'hidden' }}>
                                <div style={{ height:'100%', width:`${f.v}%`, background:f.v>=80?'#059669':f.v>=50?'#D97706':'#DC2626', borderRadius:9999 }}/>
                              </div>
                              <span style={{ fontSize:10, fontWeight:700, color:f.v>=80?'#059669':f.v>=50?'#D97706':'#DC2626' }}>{f.v}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Score */}
                    <div style={{ textAlign:'center', flexShrink:0 }}>
                      <div style={{ fontSize:18, fontWeight:800, color:c.score>=80?'#059669':c.score>=60?'#D97706':'#DC2626' }}>{c.score}</div>
                      <div style={{ fontSize:10, color:'var(--text-muted)' }}>score</div>
                    </div>

                    {/* Actions */}
                    <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                      {c.duplicate ? (
                        <>
                          <button onClick={()=>mergeDuplicate(c.id)} style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 10px', borderRadius:8, border:'1px solid #FCA5A5', background:'transparent', color:'#DC2626', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                            Fusionner
                          </button>
                          <button onClick={()=>removeDuplicate(c.id)} style={{ width:28, height:28, borderRadius:8, border:'none', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#EF4444' }}>
                            <Trash2 size={13}/>
                          </button>
                        </>
                      ) : !c.enriched ? (
                        <button onClick={()=>setEnrichTarget([c])}
                          style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:8, border:'1px solid var(--color-primary)', background:`color-mix(in srgb, var(--color-primary) 8%, transparent)`, color:'var(--color-primary)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                          <Zap size={12}/>Enrichir
                        </button>
                      ) : (
                        <span style={{ fontSize:11, color:'var(--text-muted)', padding:'5px 8px' }}>✓ OK</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
