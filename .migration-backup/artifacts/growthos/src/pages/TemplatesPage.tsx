import { useState, useEffect } from 'react';
import { Plus, FileText, Loader2, Trash2, X, Copy, CheckCircle, Edit2, Save, Search, BarChart2, Star, TrendingUp, Send, ChevronDown } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

const CATEGORIES = [
  { value:'all',       label:'Tous',        color:'#6B7280' },
  { value:'outreach',  label:'Prospection', color:'#7C3AED' },
  { value:'followup',  label:'Relance',     color:'#2563EB' },
  { value:'closing',   label:'Closing',     color:'#059669' },
  { value:'nurturing', label:'Nurturing',   color:'#D97706' },
  { value:'other',     label:'Autre',       color:'#6B7280' },
];
const CAT_COLORS: Record<string,string> = {
  outreach:'#7C3AED', followup:'#2563EB', closing:'#059669', nurturing:'#D97706', other:'#6B7280',
};

const DEFAULT_TEMPLATES = [
  {
    name:'Email de prospection froid', subject:'{{first_name}}, question sur {{company}}', category:'outreach', usedCount:34, openRate:42, replyRate:8,
    body:`Bonjour {{first_name}},\n\nJ'ai vu que vous travaillez chez {{company}} en tant que {{job_title}}.\n\nNous aidons des entreprises comme la vôtre à accélérer leur croissance commerciale grâce à l'IA.\n\nSeriez-vous disponible pour un rapide échange de 15 min cette semaine ?\n\nCordialement,\n{{sender_name}}`,
    variables:['first_name','company','job_title','sender_name'],
  },
  {
    name:'Relance J+3', subject:'Re: {{first_name}}, question sur {{company}}', category:'followup', usedCount:22, openRate:58, replyRate:12,
    body:`Bonjour {{first_name}},\n\nJe me permets de revenir vers vous suite à mon email de la semaine dernière.\n\nJe comprends que vous êtes certainement très occupé(e). Je reste disponible si vous souhaitez en discuter.\n\nCordialement,\n{{sender_name}}`,
    variables:['first_name','company','sender_name'],
  },
  {
    name:'Email de closing', subject:'{{first_name}} — proposition finale + offre limitée', category:'closing', usedCount:18, openRate:71, replyRate:31,
    body:`Bonjour {{first_name}},\n\nJe voulais vous envoyer notre proposition finale pour {{company}}.\n\nNous vous offrons [remise/avantage] valable jusqu'au [date].\n\nQu'en pensez-vous ?\n\nCordialement,\n{{sender_name}}`,
    variables:['first_name','company','sender_name'],
  },
  {
    name:'Nurturing mensuel', subject:'{{first_name}}, une ressource pour vous', category:'nurturing', usedCount:9, openRate:38, replyRate:4,
    body:`Bonjour {{first_name}},\n\nJe pense à vous ce mois-ci et voulais partager [ressource/insight] utile pour {{company}}.\n\nN'hésitez pas si vous avez des questions.\n\nCordialement,\n{{sender_name}}`,
    variables:['first_name','company','sender_name'],
  },
];

type SortKey = 'name'|'usedCount'|'openRate'|'replyRate';

function TemplateModal({ template, onClose, onSaved }: { template?:any; onClose:()=>void; onSaved:()=>void }) {
  const isEdit = !!template;
  const [form, setForm] = useState({ name:template?.name||'', subject:template?.subject||'', body:template?.body||'', category:template?.category||'outreach' });
  const [loading, setLoading] = useState(false);
  const variables = ['{{first_name}}','{{last_name}}','{{company}}','{{job_title}}','{{sender_name}}'];

  const save = async ()=>{
    if (!form.name||!form.subject||!form.body) { toast.error('Remplissez tous les champs'); return; }
    setLoading(true);
    try {
      const vars = (form.body+' '+form.subject).match(/\{\{(\w+)\}\}/g)?.map(v=>v.slice(2,-2))||[];
      if (isEdit) await apiClient.patch(`/templates/${template.id}`,{ ...form, variables:vars });
      else await apiClient.post('/templates',{ ...form, variables:vars });
      toast.success(isEdit?'Template mis à jour':'Template créé');
      onSaved(); onClose();
    } catch { toast.error('Erreur lors de la sauvegarde'); }
    finally { setLoading(false); }
  };

  const insertVar = (v:string)=>{ (document.activeElement as any)?.setRangeText?.(v); };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={onClose}>
      <div style={{ background:'var(--card-bg)', borderRadius:20, width:'100%', maxWidth:620, padding:24, boxShadow:'0 20px 60px rgba(0,0,0,.2)', maxHeight:'90vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h2 style={{ fontSize:18, fontWeight:700, color:'var(--text-primary)', margin:0 }}>{isEdit?'Modifier le template':'Nouveau template'}</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={18}/></button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:5 }}>Nom *</label>
              <input value={form.name} onChange={e=>setForm(f=>({ ...f,name:e.target.value }))} placeholder="Ex: Prospection LinkedIn"
                style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1px solid var(--card-border)', background:'var(--body-bg)', color:'var(--text-primary)', fontSize:13, outline:'none', boxSizing:'border-box' }}/>
            </div>
            <div>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:5 }}>Catégorie</label>
              <select value={form.category} onChange={e=>setForm(f=>({ ...f,category:e.target.value }))}
                style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1px solid var(--card-border)', background:'var(--body-bg)', color:'var(--text-primary)', fontSize:13, outline:'none' }}>
                {CATEGORIES.filter(c=>c.value!=='all').map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:5 }}>Objet *</label>
            <input value={form.subject} onChange={e=>setForm(f=>({ ...f,subject:e.target.value }))} placeholder="Objet avec {{variables}}"
              style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1px solid var(--card-border)', background:'var(--body-bg)', color:'var(--text-primary)', fontSize:13, outline:'none', boxSizing:'border-box' }}/>
          </div>
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
              <label style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)' }}>Corps *</label>
              <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                {variables.map(v=>(
                  <button key={v} onClick={()=>setForm(f=>({ ...f,body:f.body+v }))}
                    style={{ fontSize:10, padding:'2px 7px', borderRadius:6, background:'var(--body-bg)', color:'var(--color-primary)', border:'1px solid var(--card-border)', cursor:'pointer' }}>{v}</button>
                ))}
              </div>
            </div>
            <textarea value={form.body} onChange={e=>setForm(f=>({ ...f,body:e.target.value }))} rows={10}
              style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid var(--card-border)', background:'var(--body-bg)', color:'var(--text-primary)', fontSize:13, outline:'none', resize:'vertical', fontFamily:'monospace', boxSizing:'border-box' }}/>
          </div>
        </div>
        <div style={{ display:'flex', gap:10, marginTop:20 }}>
          <button onClick={onClose} style={{ flex:1, padding:'10px', borderRadius:10, border:'1px solid var(--card-border)', background:'transparent', color:'var(--text-secondary)', fontSize:13, cursor:'pointer' }}>Annuler</button>
          <button onClick={save} disabled={loading} style={{ flex:2, padding:'10px', borderRadius:10, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, opacity:loading?0.7:1 }}>
            {loading?<Loader2 size={14} style={{ animation:'spin 1s linear infinite' }}/>:<Save size={14}/>}
            {isEdit?'Enregistrer':'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [category, setCategory]   = useState('all');
  const [search, setSearch]       = useState('');
  const [sortBy, setSortBy]       = useState<SortKey>('usedCount');
  const [showCreate, setShowCreate] = useState(false);
  const [editTemplate, setEditTemplate] = useState<any>(null);
  const [preview, setPreview]     = useState<any>(null);
  const [copied, setCopied]       = useState<string|null>(null);
  const [showSort, setShowSort]   = useState(false);

  const fetchTemplates = async ()=>{
    setLoading(true);
    try {
      const params:any = {};
      if (category!=='all') params.category = category;
      const data = await apiClient.get('/templates',{ params }) as any[];
      setTemplates(Array.isArray(data)&&data.length>0 ? data : DEFAULT_TEMPLATES.map((t,i)=>({ ...t, id:`mock-${i}` })));
    } catch { setTemplates(DEFAULT_TEMPLATES.map((t,i)=>({ ...t, id:`mock-${i}` }))); }
    finally { setLoading(false); }
  };

  useEffect(()=>{ fetchTemplates(); },[category]);

  const seedDefaults = async ()=>{
    for (const t of DEFAULT_TEMPLATES) {
      try { await apiClient.post('/templates',t); } catch {}
    }
    fetchTemplates();
  };

  const deleteTemplate = async (id:string)=>{
    if (!confirm('Supprimer ce template ?')) return;
    setTemplates(t=>t.filter(x=>x.id!==id));
    toast.success('Template supprimé');
    await apiClient.delete(`/templates/${id}`).catch(()=>{});
  };

  const duplicateTemplate = async (t:any)=>{
    const copy = { ...t, id:undefined, name:`${t.name} (copie)` };
    try {
      const created:any = await apiClient.post('/templates', copy);
      setTemplates(prev=>[...prev,{ ...copy, id:created.id||`mock-${Date.now()}` }]);
    } catch { setTemplates(prev=>[...prev,{ ...copy, id:`mock-${Date.now()}` }]); }
    toast.success('Template dupliqué');
  };

  const copySubject = (id:string, subject:string)=>{
    navigator.clipboard.writeText(subject);
    setCopied(id); setTimeout(()=>setCopied(null),2000);
    toast.success('Objet copié');
  };

  const filtered = templates
    .filter(t=>(category==='all'||t.category===category) && (!search||t.name.toLowerCase().includes(search.toLowerCase())||t.subject?.toLowerCase().includes(search.toLowerCase())))
    .sort((a,b)=>{
      if (sortBy==='name') return a.name.localeCompare(b.name);
      return (b[sortBy]||0)-(a[sortBy]||0);
    });

  const SORT_LABELS: Record<SortKey,string> = { name:'Nom (A-Z)', usedCount:'Plus utilisés', openRate:'Taux ouverture', replyRate:'Taux réponse' };

  return (
    <div style={{ minHeight:'100vh', padding:24, background:'var(--body-bg)' }}>
      {showCreate && <TemplateModal onClose={()=>setShowCreate(false)} onSaved={fetchTemplates}/>}
      {editTemplate && <TemplateModal template={editTemplate} onClose={()=>setEditTemplate(null)} onSaved={fetchTemplates}/>}

      {preview && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={()=>setPreview(null)}>
          <div style={{ background:'var(--card-bg)', borderRadius:20, width:'100%', maxWidth:620, padding:24, boxShadow:'0 20px 60px rgba(0,0,0,.2)' }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div>
                <h2 style={{ fontSize:17, fontWeight:700, color:'var(--text-primary)', margin:0 }}>{preview.name}</h2>
                <span style={{ fontSize:11, padding:'2px 9px', borderRadius:9999, background:`${CAT_COLORS[preview.category]||'#6B7280'}15`, color:CAT_COLORS[preview.category]||'#6B7280', fontWeight:600, display:'inline-block', marginTop:4 }}>
                  {CATEGORIES.find(c=>c.value===preview.category)?.label||preview.category}
                </span>
              </div>
              <button onClick={()=>setPreview(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={18}/></button>
            </div>
            {/* Stats */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:14 }}>
              {[
                { l:'Utilisé', v:`${preview.usedCount||0}×`, color:'var(--color-primary)' },
                { l:'Taux ouverture', v:`${preview.openRate||0}%`, color:'#059669' },
                { l:'Taux réponse', v:`${preview.replyRate||0}%`, color:'#7C3AED' },
              ].map(s=>(
                <div key={s.l} style={{ textAlign:'center', padding:'10px', borderRadius:10, background:'var(--body-bg)', border:'1px solid var(--card-border)' }}>
                  <div style={{ fontSize:18, fontWeight:800, color:s.color }}>{s.v}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)' }}>{s.l}</div>
                </div>
              ))}
            </div>
            <div style={{ padding:'8px 12px', borderRadius:10, background:'var(--body-bg)', border:'1px solid var(--card-border)', marginBottom:10 }}>
              <span style={{ fontSize:11, color:'var(--text-muted)' }}>Objet : </span>
              <span style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{preview.subject}</span>
            </div>
            <div style={{ padding:'12px 14px', borderRadius:10, background:'var(--body-bg)', border:'1px solid var(--card-border)', fontSize:13, color:'var(--text-secondary)', whiteSpace:'pre-wrap', fontFamily:'monospace', lineHeight:1.6, maxHeight:280, overflowY:'auto' }}>{preview.body}</div>
            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              <button onClick={()=>setPreview(null)} style={{ flex:1, padding:'10px', borderRadius:10, border:'1px solid var(--card-border)', background:'transparent', color:'var(--text-secondary)', fontSize:13, cursor:'pointer' }}>Fermer</button>
              <button onClick={()=>{ setEditTemplate(preview); setPreview(null); }} style={{ flex:2, padding:'10px', borderRadius:10, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                <Edit2 size={13}/>Modifier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'var(--text-primary)', margin:0 }}>Templates Email</h1>
          <p style={{ fontSize:13, color:'var(--text-muted)', margin:'2px 0 0' }}>{filtered.length} template{filtered.length!==1?'s':''}</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {templates.length===0&&!loading && (
            <button onClick={seedDefaults} style={{ padding:'8px 14px', borderRadius:10, border:'1px solid var(--card-border)', background:'var(--card-bg)', color:'var(--text-secondary)', fontSize:13, cursor:'pointer' }}>
              Charger des exemples
            </button>
          )}
          <button onClick={()=>setShowCreate(true)} style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 16px', borderRadius:11, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            <Plus size={14}/>Nouveau template
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:10, marginBottom:18 }}>
        {[
          { l:'Total',          v:templates.length,                                               icon:<FileText size={14}/>,  color:'#6B7280', bg:'#F3F4F6' },
          { l:'Total envois',   v:templates.reduce((s,t)=>s+(t.usedCount||0),0),                 icon:<Send size={14}/>,       color:'#2563EB', bg:'#EFF6FF' },
          { l:'Ouverture moy.', v:`${templates.length?Math.round(templates.reduce((s,t)=>s+(t.openRate||0),0)/templates.length):0}%`, icon:<BarChart2 size={14}/>, color:'#059669', bg:'#ECFDF5' },
          { l:'Réponse moy.',   v:`${templates.length?Math.round(templates.reduce((s,t)=>s+(t.replyRate||0),0)/templates.length):0}%`, icon:<TrendingUp size={14}/>, color:'#7C3AED', bg:'#EDE9FE' },
        ].map((k,i)=>(
          <div key={i} style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:12, padding:'11px 14px', display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:30, height:30, borderRadius:8, background:k.bg, color:k.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{k.icon}</div>
            <div>
              <div style={{ fontSize:18, fontWeight:800, color:'var(--text-primary)' }}>{k.v}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>{k.l}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters row */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ position:'relative', flex:1, minWidth:200 }}>
          <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un template..."
            style={{ width:'100%', padding:'8px 12px 8px 34px', borderRadius:10, border:'1px solid var(--card-border)', background:'var(--card-bg)', color:'var(--text-primary)', fontSize:13, outline:'none', boxSizing:'border-box' }}/>
        </div>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
          {CATEGORIES.map(c=>(
            <button key={c.value} onClick={()=>setCategory(c.value)}
              style={{ padding:'6px 12px', borderRadius:10, border:'none', fontSize:12, fontWeight:600, cursor:'pointer', transition:'all .15s',
                background:category===c.value?'var(--color-primary)':'var(--card-bg)',
                color:category===c.value?'#fff':'var(--text-muted)',
                outline:category===c.value?'none':`1px solid var(--card-border)` }}>
              {c.label}
            </button>
          ))}
        </div>
        {/* Sort dropdown */}
        <div style={{ position:'relative' }}>
          <button onClick={()=>setShowSort(s=>!s)} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 12px', borderRadius:10, border:'1px solid var(--card-border)', background:'var(--card-bg)', color:'var(--text-secondary)', fontSize:12, cursor:'pointer', whiteSpace:'nowrap' }}>
            Trier : {SORT_LABELS[sortBy]}<ChevronDown size={12}/>
          </button>
          {showSort && (
            <div style={{ position:'absolute', right:0, top:'calc(100% + 4px)', background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:12, padding:6, zIndex:100, minWidth:180, boxShadow:'0 8px 24px rgba(0,0,0,.12)' }}>
              {(Object.entries(SORT_LABELS) as [SortKey,string][]).map(([k,l])=>(
                <button key={k} onClick={()=>{ setSortBy(k); setShowSort(false); }}
                  style={{ display:'block', width:'100%', textAlign:'left', padding:'7px 12px', borderRadius:8, border:'none', background:sortBy===k?`color-mix(in srgb, var(--color-primary) 8%, transparent)`:'transparent', color:sortBy===k?'var(--color-primary)':'var(--text-secondary)', fontSize:12, fontWeight:sortBy===k?700:400, cursor:'pointer' }}>
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:'60px 0' }}>
          <Loader2 size={28} style={{ color:'var(--color-primary)', animation:'spin 1s linear infinite' }}/>
        </div>
      ) : filtered.length===0 ? (
        <div style={{ textAlign:'center', padding:'60px 0' }}>
          <FileText size={40} style={{ margin:'0 auto 12px', color:'var(--card-border)', display:'block' }}/>
          <p style={{ fontSize:14, color:'var(--text-muted)', marginBottom:16 }}>
            {search?`Aucun résultat pour "${search}"`:'Aucun template. Créez le vôtre ou chargez des exemples.'}
          </p>
          <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
            {!search && <button onClick={seedDefaults} style={{ padding:'8px 16px', borderRadius:10, border:'1px solid var(--card-border)', background:'var(--card-bg)', color:'var(--text-secondary)', fontSize:13, cursor:'pointer' }}>Charger des exemples</button>}
            <button onClick={()=>setShowCreate(true)} style={{ padding:'8px 16px', borderRadius:10, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, cursor:'pointer' }}>Créer un template</button>
          </div>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:14 }}>
          {filtered.map(t=>{
            const color = CAT_COLORS[t.category]||'#6B7280';
            const catLabel = CATEGORIES.find(c=>c.value===t.category)?.label||t.category;
            const isBest = t.openRate>50 || t.replyRate>15;
            return (
              <div key={t.id} style={{ background:'var(--card-bg)', border:`1px solid ${isBest?color+'40':'var(--card-border)'}`, borderRadius:16, padding:18, display:'flex', flexDirection:'column', gap:10, transition:'all .15s' }}>
                {/* Card header */}
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4, flexWrap:'wrap' }}>
                      <span style={{ fontSize:11, fontWeight:600, padding:'2px 9px', borderRadius:9999, background:`${color}15`, color }}>{catLabel}</span>
                      {isBest && <span style={{ fontSize:10, display:'flex', alignItems:'center', gap:3, color:'#F59E0B', fontWeight:700 }}><Star size={10}/>Top performer</span>}
                    </div>
                    <h3 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.name}</h3>
                  </div>
                  <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                    <button onClick={()=>copySubject(t.id, t.subject)} style={{ width:28, height:28, borderRadius:8, border:'none', background:'var(--body-bg)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)' }}>
                      {copied===t.id?<CheckCircle size={13} style={{ color:'#059669' }}/>:<Copy size={13}/>}
                    </button>
                    <button onClick={()=>duplicateTemplate(t)} style={{ width:28, height:28, borderRadius:8, border:'none', background:'var(--body-bg)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)' }}>
                      <Plus size={13}/>
                    </button>
                    <button onClick={()=>setEditTemplate(t)} style={{ width:28, height:28, borderRadius:8, border:'none', background:'var(--body-bg)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)' }}>
                      <Edit2 size={13}/>
                    </button>
                    <button onClick={()=>deleteTemplate(t.id)} style={{ width:28, height:28, borderRadius:8, border:'none', background:'var(--body-bg)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#EF4444' }}>
                      <Trash2 size={13}/>
                    </button>
                  </div>
                </div>

                {/* Subject line */}
                <div style={{ fontSize:12, padding:'7px 10px', borderRadius:9, background:'var(--body-bg)', border:'1px solid var(--card-border)', color:'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  📌 {t.subject}
                </div>

                {/* Body preview */}
                <p style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'monospace', whiteSpace:'pre-line', lineHeight:1.5, margin:0, display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                  {t.body?.slice(0,160)}{(t.body?.length||0)>160?'…':''}
                </p>

                {/* Variables */}
                {t.variables?.length>0 && (
                  <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                    {t.variables.slice(0,5).map((v:string)=>(
                      <span key={v} style={{ fontSize:10, padding:'2px 7px', borderRadius:6, background:`${color}10`, color, fontWeight:600 }}>{`{{${v}}}`}</span>
                    ))}
                    {t.variables.length>5 && <span style={{ fontSize:10, color:'var(--text-muted)' }}>+{t.variables.length-5}</span>}
                  </div>
                )}

                {/* Stats */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, paddingTop:8, borderTop:'1px solid var(--card-border)' }}>
                  {[
                    { l:'Utilisé', v:`${t.usedCount||0}×` },
                    { l:'Ouverture', v:`${t.openRate||0}%`, color:t.openRate>=50?'#059669':'var(--text-muted)' },
                    { l:'Réponse', v:`${t.replyRate||0}%`, color:t.replyRate>=10?'#7C3AED':'var(--text-muted)' },
                  ].map(s=>(
                    <div key={s.l} style={{ textAlign:'center' }}>
                      <div style={{ fontSize:14, fontWeight:800, color:(s as any).color||'var(--color-primary)' }}>{s.v}</div>
                      <div style={{ fontSize:10, color:'var(--text-muted)' }}>{s.l}</div>
                    </div>
                  ))}
                </div>

                <button onClick={()=>setPreview(t)} style={{ border:'none', background:'transparent', color:'var(--color-primary)', fontSize:12, fontWeight:600, cursor:'pointer', padding:0, textAlign:'left' }}>
                  Aperçu complet →
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
