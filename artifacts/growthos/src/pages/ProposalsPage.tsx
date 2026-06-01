import { useState } from 'react';
import { FileText, Plus, Download, Send, Eye, X, Copy, CheckCircle, DollarSign, Building2, Calendar, Trash2, Edit2, TrendingUp, Clock, AlertCircle, Star, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

interface ProposalLine { id:string; desc:string; qty:number; unit:number; }
interface Proposal {
  id:string; title:string; client:string; company:string; email:string;
  status:'draft'|'sent'|'viewed'|'accepted'|'rejected';
  amount:number; createdAt:string; expiresAt:string;
  lines:ProposalLine[]; intro:string; terms:string;
}

const STATUS_CFG = {
  draft:    { l:'Brouillon', c:'#6B7280', bg:'#F3F4F6' },
  sent:     { l:'Envoyée',   c:'#2563EB', bg:'#EFF6FF' },
  viewed:   { l:'Consultée', c:'#D97706', bg:'#FEF3C7' },
  accepted: { l:'Acceptée',  c:'#059669', bg:'#ECFDF5' },
  rejected: { l:'Refusée',   c:'#DC2626', bg:'#FEF2F2' },
};

const MOCK_PROPOSALS: Proposal[] = [
  { id:'p1', title:'Proposition GrowthOS Pro — TechCorp', client:'Sophie Martin', company:'TechCorp', email:'sophie@techcorp.fr', status:'viewed', amount:14400, createdAt:'2026-05-20', expiresAt:'2026-06-20', intro:'Madame,\n\nSuite à notre échange du 15 mai, nous avons le plaisir de vous soumettre cette proposition pour l\'implémentation de GrowthOS Pro au sein de TechCorp.', terms:'Paiement à 30 jours. Abonnement annuel sans engagement au-delà.', lines:[{ id:'l1',desc:'Licence GrowthOS Pro (10 users)',qty:10,unit:120 },{ id:'l2',desc:'Intégration CRM sur-mesure',qty:1,unit:1200 },{ id:'l3',desc:'Formation équipe (2 sessions)',qty:2,unit:600 }] },
  { id:'p2', title:'Offre GrowthOS Starter — StartupX', client:'Emma Leroy', company:'StartupX', email:'emma@startupx.io', status:'sent', amount:4200, createdAt:'2026-05-25', expiresAt:'2026-06-25', intro:'Madame,\n\nVeuillez trouver ci-après notre proposition adaptée à votre structure.', terms:'Facturation mensuelle. Résiliation à tout moment.', lines:[{ id:'l1',desc:'Licence GrowthOS Starter (3 users)',qty:3,unit:90 },{ id:'l2',desc:'Onboarding & setup',qty:1,unit:900 },{ id:'l3',desc:'Support prioritaire 3 mois',qty:3,unit:300 }] },
  { id:'p3', title:'Renouvellement — BigSales SAS', client:'Paul Dupont', company:'BigSales SAS', email:'paul@bigsales.fr', status:'accepted', amount:28800, createdAt:'2026-05-10', expiresAt:'2026-06-10', intro:'Monsieur,\n\nNous vous soumettons le renouvellement de votre contrat GrowthOS pour l\'exercice 2026-2027.', terms:'Paiement annuel. Réduction fidélité 10% appliquée.', lines:[{ id:'l1',desc:'Licence Enterprise (20 users)',qty:20,unit:150 },{ id:'l2',desc:'Modules Analytics & IA',qty:1,unit:2400 },{ id:'l3',desc:'Support dédié 12 mois',qty:12,unit:400 }] },
  { id:'p4', title:'Proposition AlphaTech', client:'Marc Bernard', company:'AlphaTech', email:'marc@alphatech.fr', status:'draft', amount:8700, createdAt:'2026-05-28', expiresAt:'2026-06-28', intro:'', terms:'', lines:[{ id:'l1',desc:'Licence GrowthOS Business (5 users)',qty:5,unit:110 },{ id:'l2',desc:'Formation initiale',qty:1,unit:1100 }] },
  { id:'p5', title:'Offre DataInc — Pilot 3 mois', client:'Camille Bernard', company:'DataInc', email:'camille@datainc.com', status:'rejected', amount:1800, createdAt:'2026-05-01', expiresAt:'2026-06-01', intro:'', terms:'', lines:[{ id:'l1',desc:'Pilot GrowthOS (2 users)',qty:2,unit:90 },{ id:'l2',desc:'Accompagnement 3 mois',qty:3,unit:200 }] },
];

function lineTotal(l:ProposalLine){ return l.qty*l.unit; }
function proposalTotal(lines:ProposalLine[]){ return lines.reduce((s,l)=>s+lineTotal(l),0); }

function ProposalEditor({ proposal, onClose, onSave }: { proposal:Proposal|null; onClose:()=>void; onSave:(p:Proposal)=>void }) {
  const isNew = !proposal;
  const [form, setForm] = useState<Proposal>(proposal||{ id:Date.now().toString(), title:'', client:'', company:'', email:'', status:'draft', amount:0, createdAt:new Date().toISOString().slice(0,10), expiresAt:new Date(Date.now()+30*86400*1000).toISOString().slice(0,10), lines:[{ id:'1',desc:'',qty:1,unit:0 }], intro:'', terms:'' });
  const [tab, setTab] = useState<'info'|'lines'|'text'>('info');

  const addLine = ()=>setForm(f=>({ ...f,lines:[...f.lines,{ id:Date.now().toString(),desc:'',qty:1,unit:0 }] }));
  const removeLine = (id:string)=>setForm(f=>({ ...f,lines:f.lines.filter(l=>l.id!==id) }));
  const updateLine = (id:string, key:keyof ProposalLine, value:string|number)=>setForm(f=>({ ...f,lines:f.lines.map(l=>l.id===id?{...l,[key]:value}:l) }));

  const total = proposalTotal(form.lines);

  const save = ()=>{
    if (!form.title||!form.client) { toast.error('Remplissez le titre et le nom du client'); return; }
    onSave({ ...form, amount:total });
    toast.success(isNew?'Proposition créée':'Proposition mise à jour');
    onClose();
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={onClose}>
      <div style={{ background:'var(--card-bg)', borderRadius:20, width:'100%', maxWidth:680, padding:24, boxShadow:'0 20px 60px rgba(0,0,0,.2)', maxHeight:'92vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <h2 style={{ fontSize:18, fontWeight:700, color:'var(--text-primary)', margin:0 }}>{isNew?'Nouvelle proposition':'Modifier la proposition'}</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={18}/></button>
        </div>
        {/* Tabs */}
        <div style={{ display:'flex', gap:2, padding:3, borderRadius:10, background:'var(--body-bg)', border:'1px solid var(--card-border)', marginBottom:18, width:'fit-content' }}>
          {([['info','Informations'],['lines','Lignes & prix'],['text','Texte']] as const).map(([t,l])=>(
            <button key={t} onClick={()=>setTab(t)} style={{ padding:'5px 12px', borderRadius:7, border:'none', fontSize:12, fontWeight:tab===t?700:400, cursor:'pointer', background:tab===t?'var(--color-primary)':'transparent', color:tab===t?'#fff':'var(--text-muted)' }}>{l}</button>
          ))}
        </div>

        {tab==='info' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:4 }}>Titre *</label>
              <input value={form.title} onChange={e=>setForm(f=>({ ...f,title:e.target.value }))} placeholder="Ex: Proposition GrowthOS Pro"
                style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1px solid var(--card-border)', background:'var(--body-bg)', color:'var(--text-primary)', fontSize:13, outline:'none', boxSizing:'border-box' }}/>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {[
                { l:'Contact *', k:'client', p:'Prénom Nom' },
                { l:'Entreprise', k:'company', p:'Nom entreprise' },
                { l:'Email', k:'email', p:'contact@entreprise.fr' },
                { l:'Statut', k:'status', type:'select', options:Object.entries(STATUS_CFG).map(([v,c])=>({ v,l:c.l })) },
                { l:'Date de création', k:'createdAt', type:'date' },
                { l:'Date d\'expiration', k:'expiresAt', type:'date' },
              ].map((f:any)=>(
                <div key={f.k}>
                  <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:4 }}>{f.l}</label>
                  {f.type==='select' ? (
                    <select value={(form as any)[f.k]} onChange={e=>setForm(fm=>({ ...fm,[f.k]:e.target.value }))}
                      style={{ width:'100%', padding:'8px 10px', borderRadius:9, border:'1px solid var(--card-border)', background:'var(--body-bg)', color:'var(--text-primary)', fontSize:13, outline:'none' }}>
                      {f.options.map((o:any)=><option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  ) : (
                    <input type={f.type||'text'} value={(form as any)[f.k]} onChange={e=>setForm(fm=>({ ...fm,[f.k]:e.target.value }))} placeholder={f.p}
                      style={{ width:'100%', padding:'8px 10px', borderRadius:9, border:'1px solid var(--card-border)', background:'var(--body-bg)', color:'var(--text-primary)', fontSize:13, outline:'none', boxSizing:'border-box' }}/>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab==='lines' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 100px 100px 28px', gap:8, marginBottom:8 }}>
              {['Description','Qté','PU HT','Total',''].map(h=>(
                <div key={h} style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.04em' }}>{h}</div>
              ))}
            </div>
            {form.lines.map(l=>(
              <div key={l.id} style={{ display:'grid', gridTemplateColumns:'1fr 80px 100px 100px 28px', gap:8, marginBottom:6, alignItems:'center' }}>
                <input value={l.desc} onChange={e=>updateLine(l.id,'desc',e.target.value)} placeholder="Description du service"
                  style={{ padding:'8px 10px', borderRadius:8, border:'1px solid var(--card-border)', background:'var(--body-bg)', color:'var(--text-primary)', fontSize:12, outline:'none' }}/>
                <input type="number" value={l.qty} onChange={e=>updateLine(l.id,'qty',Number(e.target.value))}
                  style={{ padding:'8px 8px', borderRadius:8, border:'1px solid var(--card-border)', background:'var(--body-bg)', color:'var(--text-primary)', fontSize:12, outline:'none', textAlign:'center' }}/>
                <input type="number" value={l.unit} onChange={e=>updateLine(l.id,'unit',Number(e.target.value))} placeholder="0"
                  style={{ padding:'8px 8px', borderRadius:8, border:'1px solid var(--card-border)', background:'var(--body-bg)', color:'var(--text-primary)', fontSize:12, outline:'none', textAlign:'right' }}/>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--color-primary)', textAlign:'right', paddingRight:4 }}>{lineTotal(l).toLocaleString()}€</div>
                <button onClick={()=>removeLine(l.id)} disabled={form.lines.length<=1} style={{ background:'none', border:'none', cursor:'pointer', color:'#EF4444', opacity:form.lines.length<=1?0.3:1 }}><Trash2 size={13}/></button>
              </div>
            ))}
            <button onClick={addLine} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px', borderRadius:8, border:'1px dashed var(--card-border)', background:'transparent', color:'var(--text-muted)', fontSize:12, cursor:'pointer', marginTop:8 }}>
              <Plus size={12}/>Ajouter une ligne
            </button>
            <div style={{ marginTop:16, padding:'12px 16px', borderRadius:12, background:'var(--body-bg)', border:'1px solid var(--card-border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:13, fontWeight:600, color:'var(--text-secondary)' }}>Total HT</span>
              <span style={{ fontSize:20, fontWeight:800, color:'var(--color-primary)' }}>{total.toLocaleString()}€</span>
            </div>
          </div>
        )}

        {tab==='text' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {[{ l:'Introduction', k:'intro', p:'Madame, Monsieur,\n\nSuite à notre échange...' },{ l:'Conditions', k:'terms', p:'Paiement à 30 jours...' }].map(f=>(
              <div key={f.k}>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:4 }}>{f.l}</label>
                <textarea value={(form as any)[f.k]} onChange={e=>setForm(fm=>({ ...fm,[f.k]:e.target.value }))} rows={5} placeholder={f.p}
                  style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid var(--card-border)', background:'var(--body-bg)', color:'var(--text-primary)', fontSize:13, outline:'none', resize:'vertical', boxSizing:'border-box', lineHeight:1.6 }}/>
              </div>
            ))}
          </div>
        )}

        <div style={{ display:'flex', gap:10, marginTop:20 }}>
          <button onClick={onClose} style={{ flex:1, padding:'10px', borderRadius:10, border:'1px solid var(--card-border)', background:'transparent', color:'var(--text-secondary)', fontSize:13, cursor:'pointer' }}>Annuler</button>
          <button onClick={save} style={{ flex:2, padding:'10px', borderRadius:10, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            <CheckCircle size={14}/>{isNew?'Créer':'Enregistrer'} · {proposalTotal(form.lines).toLocaleString()}€
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewModal({ proposal, onClose }: { proposal:Proposal; onClose:()=>void }) {
  const total = proposalTotal(proposal.lines);
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:20, width:'100%', maxWidth:640, padding:32, boxShadow:'0 24px 80px rgba(0,0,0,.25)', maxHeight:'92vh', overflowY:'auto', color:'#111' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Proposition commerciale</div>
            <h1 style={{ fontSize:22, fontWeight:800, color:'#111', margin:0 }}>{proposal.title}</h1>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:11, color:'#6B7280' }}>GrowthOS</div>
            <div style={{ fontSize:11, color:'#6B7280', marginTop:2 }}>Valable jusqu\'au {new Date(proposal.expiresAt).toLocaleDateString('fr-FR',{ day:'numeric', month:'long', year:'numeric' })}</div>
            <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#6B7280', marginTop:8, display:'flex', alignItems:'center', gap:4, marginLeft:'auto' }}><X size={16}/></button>
          </div>
        </div>
        <div style={{ background:'#F9FAFB', borderRadius:12, padding:'14px 18px', marginBottom:20 }}>
          <div style={{ fontWeight:700, color:'#111', marginBottom:4 }}>À l'attention de</div>
          <div style={{ fontSize:14, color:'#374151' }}>{proposal.client}</div>
          <div style={{ fontSize:12, color:'#6B7280' }}>{proposal.company} · {proposal.email}</div>
        </div>
        {proposal.intro && <p style={{ fontSize:13, color:'#374151', lineHeight:1.8, whiteSpace:'pre-wrap', marginBottom:20 }}>{proposal.intro}</p>}
        <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:20 }}>
          <thead>
            <tr style={{ background:'#111', color:'#fff' }}>
              {['Description','Qté','PU HT','Total HT'].map(h=>(
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:12, fontWeight:700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {proposal.lines.map((l,i)=>(
              <tr key={l.id} style={{ background:i%2===0?'#F9FAFB':'#fff', borderBottom:'1px solid #E5E7EB' }}>
                <td style={{ padding:'10px 14px', fontSize:13, color:'#111' }}>{l.desc}</td>
                <td style={{ padding:'10px 14px', fontSize:13, color:'#6B7280', textAlign:'center' }}>{l.qty}</td>
                <td style={{ padding:'10px 14px', fontSize:13, color:'#6B7280', textAlign:'right' }}>{l.unit.toLocaleString()}€</td>
                <td style={{ padding:'10px 14px', fontSize:13, fontWeight:700, color:'#111', textAlign:'right' }}>{lineTotal(l).toLocaleString()}€</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background:'#111' }}>
              <td colSpan={3} style={{ padding:'12px 14px', fontSize:14, fontWeight:700, color:'#fff' }}>Total HT</td>
              <td style={{ padding:'12px 14px', fontSize:18, fontWeight:800, color:'#fff', textAlign:'right' }}>{total.toLocaleString()}€</td>
            </tr>
          </tfoot>
        </table>
        {proposal.terms && <div style={{ padding:'12px 16px', borderRadius:10, background:'#F3F4F6', fontSize:12, color:'#6B7280', lineHeight:1.7 }}>{proposal.terms}</div>}
      </div>
    </div>
  );
}

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>(MOCK_PROPOSALS);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy]   = useState<string>('createdAt');
  const [editing, setEditing] = useState<Proposal|null|'new'>('new' as any);
  const [preview, setPreview] = useState<Proposal|null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editorTarget, setEditorTarget] = useState<Proposal|null>(null);

  const deleteProposal = (id:string)=>{ setProposals(p=>p.filter(x=>x.id!==id)); toast.success('Proposition supprimée'); };
  const duplicateProposal = (p:Proposal)=>{ const d={ ...p, id:Date.now().toString(), title:`${p.title} (copie)`, status:'draft' as const, createdAt:new Date().toISOString().slice(0,10) }; setProposals(prev=>[d,...prev]); toast.success('Proposition dupliquée'); };
  const sendProposal = (id:string)=>{ setProposals(p=>p.map(x=>x.id===id?{...x,status:'sent'}:x)); toast.success('Proposition envoyée par email'); };

  const saveProposal = (p:Proposal)=>{
    setProposals(prev=>prev.find(x=>x.id===p.id)?prev.map(x=>x.id===p.id?p:x):[p,...prev]);
  };

  const filtered = proposals
    .filter(p=>statusFilter==='all'||p.status===statusFilter)
    .sort((a,b)=>sortBy==='amount'?b.amount-a.amount:new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());

  const totalPipeline = proposals.filter(p=>!['rejected','accepted'].includes(p.status)).reduce((s,p)=>s+p.amount,0);
  const totalWon      = proposals.filter(p=>p.status==='accepted').reduce((s,p)=>s+p.amount,0);
  const acceptRate    = proposals.length ? Math.round((proposals.filter(p=>p.status==='accepted').length/proposals.length)*100) : 0;

  return (
    <div style={{ minHeight:'100vh', padding:24, background:'var(--body-bg)' }}>
      {showEditor && <ProposalEditor proposal={editorTarget} onClose={()=>{ setShowEditor(false); setEditorTarget(null); }} onSave={saveProposal}/>}
      {preview && <PreviewModal proposal={preview} onClose={()=>setPreview(null)}/>}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'var(--text-primary)', margin:0 }}>Propositions commerciales</h1>
          <p style={{ fontSize:13, color:'var(--text-muted)', margin:'2px 0 0' }}>{proposals.length} proposition{proposals.length>1?'s':''}</p>
        </div>
        <button onClick={()=>{ setEditorTarget(null); setShowEditor(true); }} style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 16px', borderRadius:11, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
          <Plus size={14}/>Nouvelle proposition
        </button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:20 }}>
        {[
          { l:'Pipeline actif',   v:`${(totalPipeline/1000).toFixed(0)}k€`,             icon:<TrendingUp size={15}/>,  color:'#2563EB', bg:'#EFF6FF' },
          { l:'CA gagné',         v:`${(totalWon/1000).toFixed(0)}k€`,                  icon:<CheckCircle size={15}/>, color:'#059669', bg:'#ECFDF5' },
          { l:'Taux d\'acceptation', v:`${acceptRate}%`,                                 icon:<Star size={15}/>,        color:'#D97706', bg:'#FEF3C7' },
          { l:'En attente',       v:proposals.filter(p=>['sent','viewed'].includes(p.status)).length, icon:<Clock size={15}/>, color:'#7C3AED', bg:'#EDE9FE' },
          { l:'Brouillons',       v:proposals.filter(p=>p.status==='draft').length,      icon:<FileText size={15}/>,    color:'#6B7280', bg:'#F3F4F6' },
        ].map((k,i)=>(
          <div key={i} style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:13, padding:'13px 14px', display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:9, background:k.bg, color:k.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{k.icon}</div>
            <div>
              <div style={{ fontSize:18, fontWeight:800, color:'var(--text-primary)', lineHeight:1.1 }}>{k.v}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>{k.l}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
          <button key="all" onClick={()=>setStatusFilter('all')}
            style={{ padding:'5px 12px', borderRadius:8, border:'none', fontSize:12, fontWeight:500, cursor:'pointer', background:statusFilter==='all'?'var(--color-primary)':'var(--card-bg)', color:statusFilter==='all'?'#fff':'var(--text-muted)', outline:statusFilter==='all'?'none':'1px solid var(--card-border)' }}>Toutes ({proposals.length})</button>
          {Object.entries(STATUS_CFG).map(([s,cfg])=>(
            <button key={s} onClick={()=>setStatusFilter(s)}
              style={{ padding:'5px 12px', borderRadius:8, border:'none', fontSize:12, fontWeight:500, cursor:'pointer', background:statusFilter===s?cfg.c:'var(--card-bg)', color:statusFilter===s?'#fff':cfg.c, outline:statusFilter===s?'none':`1px solid ${cfg.c}40` }}>
              {cfg.l} ({proposals.filter(p=>p.status===s).length})
            </button>
          ))}
        </div>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ marginLeft:'auto', padding:'6px 10px', borderRadius:8, border:'1px solid var(--card-border)', background:'var(--card-bg)', color:'var(--text-secondary)', fontSize:12, outline:'none' }}>
          <option value="createdAt">Trier : Date</option>
          <option value="amount">Trier : Montant</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'var(--body-bg)' }}>
              {['Proposition','Client','Statut','Montant','Créée le','Expiration','Actions'].map(h=>(
                <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', color:'var(--text-muted)', whiteSpace:'nowrap', borderBottom:'1px solid var(--card-border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(p=>{
              const cfg = STATUS_CFG[p.status];
              const expired = new Date(p.expiresAt)<new Date() && !['accepted','rejected'].includes(p.status);
              return (
                <tr key={p.id} style={{ borderBottom:'1px solid var(--card-border)' }}>
                  <td style={{ padding:'12px 16px' }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.title}</div>
                  </td>
                  <td style={{ padding:'12px 16px' }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)' }}>{p.client}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:3 }}><Building2 size={9}/>{p.company}</div>
                  </td>
                  <td style={{ padding:'12px 16px' }}>
                    <span style={{ fontSize:11, padding:'2px 9px', borderRadius:9999, fontWeight:700, background:cfg.bg, color:cfg.c }}>{cfg.l}</span>
                    {expired && <div style={{ fontSize:10, color:'#DC2626', marginTop:2, display:'flex', alignItems:'center', gap:3 }}><AlertCircle size={9}/>Expirée</div>}
                  </td>
                  <td style={{ padding:'12px 16px', fontSize:14, fontWeight:800, color:'var(--color-primary)', whiteSpace:'nowrap' }}>{p.amount.toLocaleString()}€</td>
                  <td style={{ padding:'12px 16px', fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{new Date(p.createdAt).toLocaleDateString('fr-FR')}</td>
                  <td style={{ padding:'12px 16px', fontSize:12, color:expired?'#DC2626':'var(--text-muted)', whiteSpace:'nowrap' }}>{new Date(p.expiresAt).toLocaleDateString('fr-FR')}</td>
                  <td style={{ padding:'12px 16px' }}>
                    <div style={{ display:'flex', gap:5 }}>
                      <button onClick={()=>setPreview(p)} title="Aperçu" style={{ width:28, height:28, borderRadius:7, border:'1px solid var(--card-border)', background:'var(--body-bg)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)' }}><Eye size={13}/></button>
                      <button onClick={()=>{ setEditorTarget(p); setShowEditor(true); }} title="Modifier" style={{ width:28, height:28, borderRadius:7, border:'1px solid var(--card-border)', background:'var(--body-bg)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)' }}><Edit2 size={13}/></button>
                      {p.status==='draft' && <button onClick={()=>sendProposal(p.id)} title="Envoyer" style={{ width:28, height:28, borderRadius:7, border:'none', background:`color-mix(in srgb, var(--color-primary) 12%, transparent)`, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--color-primary)' }}><Send size={13}/></button>}
                      <button onClick={()=>duplicateProposal(p)} title="Dupliquer" style={{ width:28, height:28, borderRadius:7, border:'1px solid var(--card-border)', background:'var(--body-bg)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)' }}><Copy size={13}/></button>
                      <button onClick={()=>deleteProposal(p.id)} title="Supprimer" style={{ width:28, height:28, borderRadius:7, border:'none', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#EF4444' }}><Trash2 size={13}/></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length===0 && (
          <div style={{ textAlign:'center', padding:'48px 0', color:'var(--text-muted)' }}>
            <FileText size={32} style={{ margin:'0 auto 10px', display:'block', opacity:.3 }}/>
            <p style={{ fontSize:13 }}>Aucune proposition</p>
          </div>
        )}
      </div>
    </div>
  );
}
