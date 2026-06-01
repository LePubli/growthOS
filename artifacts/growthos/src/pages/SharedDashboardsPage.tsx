import { useState } from 'react';
import { LayoutDashboard, Plus, Share2, Copy, Eye, Edit2, Trash2, X, Users, Lock, Globe, BarChart2, TrendingUp, Target, CheckCircle, Link as LinkIcon, Code, ExternalLink, Settings, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

type Visibility = 'private'|'team'|'public';
type WidgetType = 'prospects'|'pipeline'|'revenue'|'activity'|'conversion'|'signals';

interface Widget { id:string; type:WidgetType; label:string; }
interface Dashboard {
  id:string; name:string; description:string; visibility:Visibility; author:string;
  createdAt:string; views:number; widgets:Widget[]; shareToken:string; starred:boolean;
}

const WIDGET_META: Record<WidgetType,{ icon:any; color:string; bg:string; mockValue:string; mockLabel:string; chart?:string }> = {
  prospects:  { icon:<Users size={16}/>,      color:'#2563EB', bg:'#EFF6FF', mockValue:'248', mockLabel:'prospects actifs',  chart:'bar' },
  pipeline:   { icon:<BarChart2 size={16}/>,   color:'#7C3AED', bg:'#EDE9FE', mockValue:'142k€', mockLabel:'pipeline total', chart:'area' },
  revenue:    { icon:<TrendingUp size={16}/>,  color:'#059669', bg:'#ECFDF5', mockValue:'38k€', mockLabel:'CA ce mois',      chart:'line' },
  activity:   { icon:<CheckCircle size={16}/>, color:'#D97706', bg:'#FEF3C7', mockValue:'47',   mockLabel:'activités/semaine', chart:'bar' },
  conversion: { icon:<Target size={16}/>,      color:'#DC2626', bg:'#FEF2F2', mockValue:'18%',  mockLabel:'taux conversion'  },
  signals:    { icon:<Star size={16}/>,        color:'#0891B2', bg:'#ECFEFF', mockValue:'12',   mockLabel:'signaux chauds'   },
};

const AVAILABLE_WIDGETS: WidgetType[] = ['prospects','pipeline','revenue','activity','conversion','signals'];

const MOCK_DASHBOARDS: Dashboard[] = [
  { id:'d1', name:'Dashboard Commercial Q2', description:'Vue d\'ensemble des KPIs commerciaux pour le Q2 2026', visibility:'team', author:'Paul Dupont', createdAt:'2026-05-01', views:142, starred:true, shareToken:'tok_d1_abc123', widgets:[{ id:'w1',type:'revenue',label:'CA mensuel' },{ id:'w2',type:'pipeline',label:'Pipeline total' },{ id:'w3',type:'prospects',label:'Prospects actifs' },{ id:'w4',type:'conversion',label:'Taux de conversion' }] },
  { id:'d2', name:'Reporting Direction', description:'Tableau de bord pour la direction générale', visibility:'public', author:'Sophie Martin', createdAt:'2026-04-15', views:89, starred:false, shareToken:'tok_d2_def456', widgets:[{ id:'w5',type:'revenue',label:'Chiffre d\'affaires' },{ id:'w6',type:'activity',label:'Activité équipe' },{ id:'w7',type:'signals',label:'Signaux détectés' }] },
  { id:'d3', name:'Mon tableau perso', description:'Dashboard personnel — prospection quotidienne', visibility:'private', author:'Moi', createdAt:'2026-05-20', views:34, starred:true, shareToken:'tok_d3_ghi789', widgets:[{ id:'w8',type:'prospects',label:'Mes prospects' },{ id:'w9',type:'activity',label:'Mes activités' }] },
];

const VIS_CFG = {
  private: { icon:<Lock size={13}/>,   label:'Privé',   color:'#6B7280', bg:'#F3F4F6' },
  team:    { icon:<Users size={13}/>,  label:'Équipe',  color:'#2563EB', bg:'#EFF6FF' },
  public:  { icon:<Globe size={13}/>,  label:'Public',  color:'#059669', bg:'#ECFDF5' },
};

function CreateModal({ onClose, onSaved }: { onClose:()=>void; onSaved:(d:Dashboard)=>void }) {
  const [name, setName]         = useState('');
  const [desc, setDesc]         = useState('');
  const [vis, setVis]           = useState<Visibility>('team');
  const [widgets, setWidgets]   = useState<Widget[]>([]);

  const toggleWidget = (type:WidgetType)=>{
    if (widgets.find(w=>w.type===type)) setWidgets(w=>w.filter(x=>x.type!==type));
    else setWidgets(w=>[...w,{ id:Date.now().toString(), type, label:WIDGET_META[type].mockLabel }]);
  };

  const save = ()=>{
    if (!name.trim())          { toast.error('Donnez un nom au dashboard'); return; }
    if (widgets.length===0)    { toast.error('Ajoutez au moins un widget'); return; }
    const d: Dashboard = { id:Date.now().toString(), name, description:desc, visibility:vis, author:'Vous', createdAt:new Date().toISOString().slice(0,10), views:0, starred:false, shareToken:`tok_${Date.now()}`, widgets };
    onSaved(d); onClose(); toast.success('Dashboard créé');
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={onClose}>
      <div style={{ background:'var(--card-bg)', borderRadius:20, width:'100%', maxWidth:560, padding:26, boxShadow:'0 20px 60px rgba(0,0,0,.2)', maxHeight:'92vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h2 style={{ fontSize:18, fontWeight:700, color:'var(--text-primary)', margin:0 }}>Nouveau dashboard</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={18}/></button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:13 }}>
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:4 }}>Nom *</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ex: Dashboard Commercial Q3"
              style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1px solid var(--card-border)', background:'var(--body-bg)', color:'var(--text-primary)', fontSize:13, outline:'none', boxSizing:'border-box' }}/>
          </div>
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:4 }}>Description</label>
            <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={2} placeholder="Description courte..."
              style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1px solid var(--card-border)', background:'var(--body-bg)', color:'var(--text-primary)', fontSize:13, outline:'none', resize:'none', boxSizing:'border-box' }}/>
          </div>
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:7 }}>Visibilité</label>
            <div style={{ display:'flex', gap:7 }}>
              {Object.entries(VIS_CFG).map(([v,cfg])=>(
                <button key={v} onClick={()=>setVis(v as Visibility)}
                  style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px', borderRadius:10, border:`1px solid ${vis===v?cfg.color:'var(--card-border)'}`, background:vis===v?`${cfg.color}12`:'transparent', color:vis===v?cfg.color:'var(--text-muted)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                  {cfg.icon}{cfg.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:8 }}>Widgets ({widgets.length} sélectionné{widgets.length>1?'s':''})</label>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
              {AVAILABLE_WIDGETS.map(wt=>{
                const meta = WIDGET_META[wt];
                const selected = !!widgets.find(w=>w.type===wt);
                return (
                  <button key={wt} onClick={()=>toggleWidget(wt)}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:11, border:`1px solid ${selected?meta.color:'var(--card-border)'}`, background:selected?`${meta.color}10`:'var(--body-bg)', cursor:'pointer', textAlign:'left' }}>
                    <div style={{ width:28, height:28, borderRadius:8, background:meta.bg, color:meta.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{meta.icon}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:selected?meta.color:'var(--text-primary)', textTransform:'capitalize' }}>{wt}</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)' }}>{meta.mockLabel}</div>
                    </div>
                    {selected && <CheckCircle size={13} style={{ color:meta.color, flexShrink:0 }}/>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div style={{ display:'flex', gap:10, marginTop:20 }}>
          <button onClick={onClose} style={{ flex:1, padding:'10px', borderRadius:10, border:'1px solid var(--card-border)', background:'transparent', color:'var(--text-secondary)', fontSize:13, cursor:'pointer' }}>Annuler</button>
          <button onClick={save} style={{ flex:2, padding:'10px', borderRadius:10, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            <Plus size={14}/>Créer le dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

function ShareDrawer({ dashboard, onClose }: { dashboard:Dashboard; onClose:()=>void }) {
  const [copied, setCopied] = useState<string|null>(null);
  const shareUrl  = `https://app.growthos.fr/shared/${dashboard.shareToken}`;
  const embedCode = `<iframe src="${shareUrl}/embed" width="100%" height="600" frameborder="0"></iframe>`;

  const copy = (key:string, text:string)=>{ navigator.clipboard.writeText(text); setCopied(key); setTimeout(()=>setCopied(null),2000); toast.success('Copié !'); };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:500, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'var(--card-bg)', borderRadius:'20px 20px 0 0', width:'100%', maxWidth:600, padding:24, boxShadow:'0 -8px 40px rgba(0,0,0,.2)' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <h2 style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)', margin:0 }}>Partager « {dashboard.name} »</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={18}/></button>
        </div>

        {/* Visibility badge */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:18, padding:'8px 14px', borderRadius:10, background:'var(--body-bg)', border:'1px solid var(--card-border)' }}>
          {VIS_CFG[dashboard.visibility].icon}
          <span style={{ fontSize:13, fontWeight:600, color:VIS_CFG[dashboard.visibility].color }}>{VIS_CFG[dashboard.visibility].label}</span>
          <span style={{ fontSize:12, color:'var(--text-muted)', marginLeft:4 }}>
            {dashboard.visibility==='private'?'Visible uniquement par vous':dashboard.visibility==='team'?'Visible par toute l\'équipe':'Visible par n\'importe qui avec le lien'}
          </span>
          <span style={{ marginLeft:'auto', fontSize:12, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:4 }}><Eye size={11}/>{dashboard.views} vues</span>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {/* Share URL */}
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)', marginBottom:7, display:'flex', alignItems:'center', gap:5 }}><LinkIcon size={12}/>Lien de partage</div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <input readOnly value={shareUrl} style={{ flex:1, padding:'9px 12px', borderRadius:10, border:'1px solid var(--card-border)', background:'var(--body-bg)', color:'var(--color-primary)', fontSize:12, fontFamily:'monospace', outline:'none', overflow:'hidden', textOverflow:'ellipsis' }}/>
              <button onClick={()=>copy('url',shareUrl)} style={{ display:'flex', alignItems:'center', gap:5, padding:'9px 14px', borderRadius:10, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', flexShrink:0 }}>
                {copied==='url'?<CheckCircle size={13}/>:<Copy size={13}/>}{copied==='url'?'Copié !':'Copier'}
              </button>
              <a href={shareUrl} target="_blank" rel="noreferrer" style={{ display:'flex', alignItems:'center', padding:'9px', borderRadius:10, border:'1px solid var(--card-border)', background:'var(--body-bg)', color:'var(--text-muted)', cursor:'pointer' }}>
                <ExternalLink size={14}/>
              </a>
            </div>
          </div>

          {/* Embed code */}
          {dashboard.visibility!=='private' && (
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)', marginBottom:7, display:'flex', alignItems:'center', gap:5 }}><Code size={12}/>Code d'intégration (embed)</div>
              <div style={{ position:'relative' }}>
                <pre style={{ padding:'12px 14px', borderRadius:10, border:'1px solid var(--card-border)', background:'var(--body-bg)', fontSize:11, color:'var(--text-muted)', fontFamily:'monospace', margin:0, whiteSpace:'pre-wrap', wordBreak:'break-all', paddingRight:48 }}>{embedCode}</pre>
                <button onClick={()=>copy('embed',embedCode)} style={{ position:'absolute', top:8, right:8, width:28, height:28, borderRadius:7, border:'1px solid var(--card-border)', background:'var(--card-bg)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)' }}>
                  {copied==='embed'?<CheckCircle size={12} style={{ color:'#059669' }}/>:<Copy size={12}/>}
                </button>
              </div>
            </div>
          )}
        </div>
        <button onClick={onClose} style={{ width:'100%', marginTop:20, padding:'11px', borderRadius:12, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>Fermer</button>
      </div>
    </div>
  );
}

export default function SharedDashboardsPage() {
  const [dashboards, setDashboards] = useState<Dashboard[]>(MOCK_DASHBOARDS);
  const [showCreate, setShowCreate] = useState(false);
  const [shareTarget, setShareTarget] = useState<Dashboard|null>(null);
  const [expanded, setExpanded]     = useState<string|null>(null);
  const [visFilter, setVisFilter]   = useState<'all'|Visibility>('all');

  const deleteDashboard = (id:string)=>{ setDashboards(d=>d.filter(x=>x.id!==id)); toast.success('Dashboard supprimé'); };
  const toggleStar = (id:string)=>{ setDashboards(d=>d.map(x=>x.id===id?{...x,starred:!x.starred}:x)); };
  const addDashboard = (d:Dashboard)=>setDashboards(prev=>[d,...prev]);

  const filtered = dashboards.filter(d=>visFilter==='all'||d.visibility===visFilter);
  const totalViews = dashboards.reduce((s,d)=>s+d.views,0);
  const publicCount = dashboards.filter(d=>d.visibility==='public').length;
  const starredCount = dashboards.filter(d=>d.starred).length;

  return (
    <div style={{ minHeight:'100vh', padding:24, background:'var(--body-bg)' }}>
      {showCreate && <CreateModal onClose={()=>setShowCreate(false)} onSaved={addDashboard}/>}
      {shareTarget && <ShareDrawer dashboard={shareTarget} onClose={()=>setShareTarget(null)}/>}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'var(--text-primary)', margin:0 }}>Dashboards partagés</h1>
          <p style={{ fontSize:13, color:'var(--text-muted)', margin:'2px 0 0' }}>{dashboards.length} dashboard{dashboards.length>1?'s':''} · {totalViews} vues au total</p>
        </div>
        <button onClick={()=>setShowCreate(true)} style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 16px', borderRadius:11, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
          <Plus size={14}/>Nouveau dashboard
        </button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12, marginBottom:20 }}>
        {[
          { l:'Total dashboards', v:dashboards.length,  icon:<LayoutDashboard size={15}/>, color:'#2563EB', bg:'#EFF6FF' },
          { l:'Partagés public',  v:publicCount,         icon:<Globe size={15}/>,           color:'#059669', bg:'#ECFDF5' },
          { l:'Total vues',       v:totalViews,          icon:<Eye size={15}/>,             color:'#7C3AED', bg:'#EDE9FE' },
          { l:'En favoris',       v:starredCount,        icon:<Star size={15}/>,            color:'#D97706', bg:'#FEF3C7' },
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

      {/* Filter tabs */}
      <div style={{ display:'flex', gap:5, marginBottom:16, flexWrap:'wrap' }}>
        {(['all','private','team','public'] as const).map(v=>{
          const cfg = v==='all' ? null : VIS_CFG[v];
          return (
            <button key={v} onClick={()=>setVisFilter(v)}
              style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:9, border:'none', fontSize:12, fontWeight:500, cursor:'pointer', transition:'all .15s',
                background:visFilter===v?(cfg?.color||'var(--color-primary)'):'var(--card-bg)',
                color:visFilter===v?'#fff':'var(--text-muted)',
                outline:visFilter===v?'none':'1px solid var(--card-border)' }}>
              {cfg?.icon}
              {v==='all'?`Tous (${dashboards.length})`:cfg?.label+` (${dashboards.filter(d=>d.visibility===v).length})`}
            </button>
          );
        })}
      </div>

      {/* Dashboard cards */}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {filtered.length===0 && (
          <div style={{ textAlign:'center', padding:'48px 0', color:'var(--text-muted)' }}>
            <LayoutDashboard size={32} style={{ margin:'0 auto 10px', display:'block', opacity:.3 }}/>
            <p style={{ fontSize:13 }}>Aucun dashboard trouvé</p>
          </div>
        )}
        {filtered.map(d=>{
          const visCfg = VIS_CFG[d.visibility];
          const isExpanded = expanded===d.id;
          return (
            <div key={d.id} style={{ background:'var(--card-bg)', border:`1px solid ${d.starred?'var(--color-primary)':'var(--card-border)'}`, borderRadius:16, overflow:'hidden' }}>
              {/* Card header */}
              <div style={{ padding:'16px 18px', display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:40, height:40, borderRadius:12, background:`color-mix(in srgb, var(--color-primary) 12%, transparent)`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <LayoutDashboard size={20} style={{ color:'var(--color-primary)' }}/>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
                    <span style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>{d.name}</span>
                    <span style={{ fontSize:11, padding:'2px 8px', borderRadius:9999, background:visCfg.bg, color:visCfg.color, fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                      {visCfg.icon}{visCfg.label}
                    </span>
                    {d.starred && <Star size={13} style={{ color:'#D97706', fill:'#D97706' }}/>}
                  </div>
                  {d.description && <p style={{ fontSize:12, color:'var(--text-muted)', margin:'2px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.description}</p>}
                  <div style={{ display:'flex', gap:12, marginTop:3 }}>
                    <span style={{ fontSize:11, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:3 }}><Eye size={9}/>{d.views} vues</span>
                    <span style={{ fontSize:11, color:'var(--text-muted)' }}>{d.author}</span>
                    <span style={{ fontSize:11, color:'var(--text-muted)' }}>{new Date(d.createdAt).toLocaleDateString('fr-FR')}</span>
                    <span style={{ fontSize:11, color:'var(--text-muted)' }}>{d.widgets.length} widget{d.widgets.length>1?'s':''}</span>
                  </div>
                </div>
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <button onClick={()=>toggleStar(d.id)} style={{ width:30, height:30, borderRadius:8, border:'none', background:d.starred?'#FEF3C7':'var(--body-bg)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Star size={14} style={{ color:d.starred?'#F59E0B':'var(--text-muted)', fill:d.starred?'#F59E0B':'none' }}/>
                  </button>
                  <button onClick={()=>setShareTarget(d)} style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:9, border:'1px solid var(--card-border)', background:'var(--body-bg)', color:'var(--text-secondary)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                    <Share2 size={12}/>Partager
                  </button>
                  <button onClick={()=>deleteDashboard(d.id)} style={{ width:30, height:30, borderRadius:8, border:'none', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#EF4444' }}>
                    <Trash2 size={13}/>
                  </button>
                  <button onClick={()=>setExpanded(isExpanded?null:d.id)} style={{ width:30, height:30, borderRadius:8, border:'none', background:'var(--body-bg)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)' }}>
                    {isExpanded?<ChevronUp size={14}/>:<ChevronDown size={14}/>}
                  </button>
                </div>
              </div>

              {/* Expanded widget preview */}
              {isExpanded && (
                <div style={{ borderTop:'1px solid var(--card-border)', padding:'14px 18px', background:'var(--body-bg)' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:12 }}>Aperçu des widgets</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:10 }}>
                    {d.widgets.map(w=>{
                      const meta = WIDGET_META[w.type];
                      return (
                        <div key={w.id} style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:12, padding:'12px 14px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                            <div style={{ width:26, height:26, borderRadius:7, background:meta.bg, color:meta.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{meta.icon}</div>
                            <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{w.label}</span>
                          </div>
                          <div style={{ fontSize:22, fontWeight:800, color:meta.color }}>{meta.mockValue}</div>
                          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{meta.mockLabel}</div>
                          {/* Fake mini sparkline */}
                          {meta.chart && (
                            <div style={{ marginTop:8, display:'flex', alignItems:'flex-end', gap:2, height:24 }}>
                              {[3,5,4,7,6,8,9,7,10,8].map((v,i)=>(
                                <div key={i} style={{ flex:1, height:`${v*2.4}px`, background:`${meta.color}${i===9?'ff':'40'}`, borderRadius:'2px 2px 0 0' }}/>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display:'flex', gap:10, marginTop:12 }}>
                    <button onClick={()=>setShareTarget(d)} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px', borderRadius:9, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                      <LinkIcon size={12}/>Copier le lien de partage
                    </button>
                    {d.visibility!=='private' && (
                      <button onClick={()=>{ navigator.clipboard.writeText(`<iframe src="https://app.growthos.fr/shared/${d.shareToken}/embed" width="100%" height="600" frameborder="0"></iframe>`); toast.success('Code embed copié !'); }}
                        style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px', borderRadius:9, border:'1px solid var(--card-border)', background:'transparent', color:'var(--text-secondary)', fontSize:12, cursor:'pointer' }}>
                        <Code size={12}/>Code embed
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
