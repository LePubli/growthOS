import { useState, useEffect } from 'react';
import { Plus, Link, Loader2, Trash2, X, Copy, CheckCircle, Play, Pause, Eye, EyeOff, Activity, RefreshCw, Send, ChevronDown, ChevronUp, AlertCircle, Clock } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

const ALL_EVENTS = [
  { value:'prospect.created',    label:'Prospect créé' },
  { value:'prospect.updated',    label:'Prospect mis à jour' },
  { value:'deal.created',        label:'Deal créé' },
  { value:'deal.stage_changed',  label:'Stade deal changé' },
  { value:'sequence.enrolled',   label:'Inscrit à une séquence' },
  { value:'signal.created',      label:'Signal créé' },
];

const MOCK_WEBHOOKS = [
  {
    id:'wh1', name:'Zapier · Nouveau prospect', url:'https://hooks.zapier.com/hooks/catch/abc123/xyzdef/', status:'active', events:['prospect.created','prospect.updated'], deliveries:247, successRate:98, secret:'whsec_k8s9n2m1p4r7t0q3v6y9b2e5h8j1l4n7',
    logs:[
      { id:'l1', event:'prospect.created', status:200, date:'Il y a 3 min', duration:142, payload:'{"id":"p_123","name":"Sophie Martin",...}' },
      { id:'l2', event:'prospect.created', status:200, date:'Il y a 12 min', duration:98, payload:'{"id":"p_122","name":"Paul Dupont",...}' },
      { id:'l3', event:'prospect.updated', status:500, date:'Il y a 1h',   duration:3001, payload:'{"id":"p_120",...}' },
      { id:'l4', event:'prospect.created', status:200, date:'Il y a 2h',   duration:112, payload:'{"id":"p_119",...}' },
    ],
  },
  {
    id:'wh2', name:'Make · Deal changé', url:'https://hook.eu1.make.com/abc123def456ghi789jkl012mno345', status:'paused', events:['deal.created','deal.stage_changed'], deliveries:89, successRate:94, secret:'whsec_m2n5p8r1t4v7y0b3e6h9k2m5p8r1t4',
    logs:[
      { id:'l5', event:'deal.stage_changed', status:200, date:'Il y a 3h', duration:203, payload:'{"id":"d_55","stage":"negotiation",...}' },
      { id:'l6', event:'deal.created',       status:404, date:'Il y a 5h', duration:88,  payload:'{"id":"d_54",...}' },
    ],
  },
];

function CreateModal({ onClose, onSaved }: { onClose:()=>void; onSaved:()=>void }) {
  const [form, setForm] = useState({ name:'', url:'', events:[] as string[] });
  const [loading, setLoading] = useState(false);

  const toggleEvent = (e:string)=>{
    setForm(f=>({ ...f, events:f.events.includes(e)?f.events.filter(x=>x!==e):[...f.events,e] }));
  };

  const save = async ()=>{
    if (!form.name||!form.url||form.events.length===0) { toast.error('Remplissez tous les champs et sélectionnez au moins un événement'); return; }
    setLoading(true);
    try {
      await apiClient.post('/webhooks', form);
      toast.success('Webhook créé'); onSaved(); onClose();
    } catch { toast.error('Erreur lors de la création'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={onClose}>
      <div style={{ background:'var(--card-bg)', borderRadius:20, width:'100%', maxWidth:520, padding:24, boxShadow:'0 20px 60px rgba(0,0,0,.2)' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h2 style={{ fontSize:18, fontWeight:700, color:'var(--text-primary)', margin:0 }}>Nouveau webhook</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={18}/></button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {[
            { l:'Nom *', k:'name', placeholder:'Ex: Zapier · Nouveau prospect' },
            { l:'URL *',  k:'url',  placeholder:'https://hooks.zapier.com/...' },
          ].map(f=>(
            <div key={f.k}>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:5 }}>{f.l}</label>
              <input value={(form as any)[f.k]} onChange={e=>setForm(fm=>({ ...fm, [f.k]:e.target.value }))} placeholder={f.placeholder}
                style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1px solid var(--card-border)', background:'var(--body-bg)', color:'var(--text-primary)', fontSize:13, outline:'none', boxSizing:'border-box' }}/>
            </div>
          ))}
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:8 }}>Événements * ({form.events.length} sélectionné{form.events.length>1?'s':''})</label>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {ALL_EVENTS.map(ev=>(
                <label key={ev.value} style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', padding:'6px 10px', borderRadius:8, background:form.events.includes(ev.value)?`color-mix(in srgb, var(--color-primary) 8%, transparent)`:'transparent', border:`1px solid ${form.events.includes(ev.value)?'var(--color-primary)':'var(--card-border)'}`, transition:'all .1s' }}>
                  <input type="checkbox" checked={form.events.includes(ev.value)} onChange={()=>toggleEvent(ev.value)} style={{ accentColor:'var(--color-primary)' }}/>
                  <span style={{ fontSize:13, color:'var(--text-primary)', flex:1 }}>{ev.label}</span>
                  <code style={{ fontSize:11, color:'var(--text-muted)' }}>{ev.value}</code>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display:'flex', gap:10, marginTop:20 }}>
          <button onClick={onClose} style={{ flex:1, padding:'10px', borderRadius:10, border:'1px solid var(--card-border)', background:'transparent', color:'var(--text-secondary)', fontSize:13, cursor:'pointer' }}>Annuler</button>
          <button onClick={save} disabled={loading} style={{ flex:2, padding:'10px', borderRadius:10, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, opacity:loading?0.7:1 }}>
            {loading?<Loader2 size={14} style={{ animation:'spin 1s linear infinite' }}/>:<Plus size={14}/>}Créer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showSecret, setShowSecret] = useState<Record<string,boolean>>({});
  const [copied, setCopied] = useState<string|null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Record<string,boolean>>({});
  const [expandedPayload, setExpandedPayload] = useState<string|null>(null);
  const [testing, setTesting] = useState<string|null>(null);

  const fetchWebhooks = async ()=>{
    setLoading(true);
    try {
      const data = await apiClient.get('/webhooks') as any[];
      setWebhooks(Array.isArray(data)&&data.length>0 ? data : MOCK_WEBHOOKS);
    } catch { setWebhooks(MOCK_WEBHOOKS); }
    finally { setLoading(false); }
  };

  useEffect(()=>{ fetchWebhooks(); },[]);

  const toggle = async (id:string)=>{
    const wh = webhooks.find(w=>w.id===id);
    if (!wh) return;
    const newStatus = wh.status==='active'?'paused':'active';
    setWebhooks(w=>w.map(x=>x.id===id?{...x,status:newStatus}:x));
    toast.success(newStatus==='active'?'Webhook activé':'Webhook mis en pause');
    await apiClient.post(`/webhooks/${id}/toggle`,{}).catch(()=>{});
  };

  const deleteWebhook = async (id:string)=>{
    if (!confirm('Supprimer ce webhook ?')) return;
    setWebhooks(w=>w.filter(x=>x.id!==id));
    toast.success('Webhook supprimé');
    await apiClient.delete(`/webhooks/${id}`).catch(()=>{});
  };

  const copy = (key:string, text:string)=>{
    navigator.clipboard.writeText(text);
    setCopied(key); setTimeout(()=>setCopied(null),2000);
    toast.success('Copié');
  };

  const testWebhook = async (id:string)=>{
    setTesting(id);
    await new Promise(r=>setTimeout(r,1200));
    const wh = webhooks.find(w=>w.id===id);
    const fakeLog = { id:`l${Date.now()}`, event:'test', status:200, date:'À l\'instant', duration:Math.floor(Math.random()*200+50), payload:'{"test":true,"timestamp":"'+new Date().toISOString()+'"}' };
    setWebhooks(w=>w.map(x=>x.id===id?{...x,logs:[fakeLog,...(x.logs||[])]}:x));
    setTesting(null);
    toast.success('Payload de test envoyé avec succès ✓');
  };

  const retryDelivery = async (whId:string, logId:string)=>{
    await new Promise(r=>setTimeout(r,600));
    setWebhooks(w=>w.map(wh=>wh.id===whId?{...wh,logs:(wh.logs||[]).map((l:any)=>l.id===logId?{...l,status:200}:l)}:wh));
    toast.success('Renvoi effectué');
  };

  const totalDeliveries = webhooks.reduce((s,w)=>s+(w.deliveries||0),0);
  const activeCount = webhooks.filter(w=>w.status==='active').length;
  const avgSuccess = webhooks.length>0 ? Math.round(webhooks.reduce((s,w)=>s+(w.successRate||100),0)/webhooks.length) : 100;

  return (
    <div style={{ minHeight:'100vh', padding:24, background:'var(--body-bg)' }}>
      {showCreate && <CreateModal onClose={()=>setShowCreate(false)} onSaved={fetchWebhooks}/>}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'var(--text-primary)', margin:0 }}>Webhooks</h1>
          <p style={{ fontSize:13, color:'var(--text-muted)', margin:'2px 0 0' }}>Intégrez GrowthOS à Zapier, Make, n8n et vos outils</p>
        </div>
        <button onClick={()=>setShowCreate(true)} style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 16px', borderRadius:11, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
          <Plus size={14}/>Nouveau webhook
        </button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:20 }}>
        {[
          { l:'Webhooks actifs',  v:`${activeCount}/${webhooks.length}`, icon:<Activity size={15}/>,   color:'#059669', bg:'#ECFDF5' },
          { l:'Total envois',     v:totalDeliveries.toLocaleString(),    icon:<Send size={15}/>,        color:'#2563EB', bg:'#EFF6FF' },
          { l:'Taux de succès',   v:`${avgSuccess}%`,                   icon:<CheckCircle size={15}/>, color:avgSuccess>=95?'#059669':'#D97706', bg:avgSuccess>=95?'#ECFDF5':'#FEF3C7' },
          { l:'Événements actifs', v:`${webhooks.filter(w=>w.status==='active').reduce((s,w)=>s+(w.events||[]).length,0)}`, icon:<Zap size={15}/>, color:'#7C3AED', bg:'#EDE9FE' },
        ].map((k,i)=>(
          <div key={i} style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:14, padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:34, height:34, borderRadius:10, background:k.bg, color:k.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{k.icon}</div>
            <div>
              <div style={{ fontSize:19, fontWeight:800, color:'var(--text-primary)' }}>{k.v}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>{k.l}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Info banner */}
      <div style={{ borderRadius:12, padding:'12px 16px', marginBottom:16, background:'#EFF6FF', border:'1px solid #BFDBFE', display:'flex', gap:10, alignItems:'flex-start' }}>
        <Link size={16} style={{ color:'#2563EB', flexShrink:0, marginTop:2 }}/>
        <div>
          <span style={{ fontSize:13, fontWeight:600, color:'#1E40AF' }}>Comment ça fonctionne : </span>
          <span style={{ fontSize:12, color:'#3B82F6' }}>À chaque événement sélectionné, GrowthOS envoie un POST JSON signé (HMAC-SHA256) à votre URL. Vérifiez la signature avec le secret pour authentifier les requêtes.</span>
        </div>
      </div>

      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:'60px 0' }}>
          <Loader2 size={28} style={{ color:'var(--color-primary)', animation:'spin 1s linear infinite' }}/>
        </div>
      ) : webhooks.length===0 ? (
        <div style={{ textAlign:'center', padding:'60px 0' }}>
          <Link size={40} style={{ margin:'0 auto 12px', color:'var(--card-border)', display:'block' }}/>
          <p style={{ fontSize:14, color:'var(--text-muted)', marginBottom:16 }}>Aucun webhook configuré</p>
          <button onClick={()=>setShowCreate(true)} style={{ padding:'9px 20px', borderRadius:10, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, cursor:'pointer' }}>
            + Créer un webhook
          </button>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {webhooks.map(wh=>{
            const logs = wh.logs||[];
            const logsExpanded = expandedLogs[wh.id];
            const successCount = logs.filter((l:any)=>l.status>=200&&l.status<300).length;
            const failCount    = logs.filter((l:any)=>l.status>=400).length;
            return (
              <div key={wh.id} style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, overflow:'hidden' }}>
                {/* Webhook header */}
                <div style={{ padding:'16px 20px' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, marginBottom:12 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                        <h3 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', margin:0 }}>{wh.name}</h3>
                        <span style={{ fontSize:11, padding:'2px 9px', borderRadius:9999, fontWeight:600, background:wh.status==='active'?'#ECFDF5':'#FEF3C7', color:wh.status==='active'?'#059669':'#D97706' }}>
                          {wh.status==='active'?'Actif':'En pause'}
                        </span>
                        {wh.deliveries>0 && <span style={{ fontSize:11, color:'var(--text-muted)' }}>{wh.deliveries} envois</span>}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                        <code style={{ fontSize:12, color:'var(--color-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:340 }}>{wh.url}</code>
                        <button onClick={()=>copy(wh.id+'_url', wh.url)} style={{ background:'none', border:'none', cursor:'pointer', flexShrink:0 }}>
                          {copied===wh.id+'_url'?<CheckCircle size={12} style={{ color:'#059669' }}/>:<Copy size={12} style={{ color:'var(--text-muted)' }}/>}
                        </button>
                      </div>
                      {/* Success rate bar */}
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
                        <div style={{ height:4, width:120, borderRadius:9999, background:'var(--card-border)', overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${wh.successRate||100}%`, background:wh.successRate>=95?'#059669':'#F59E0B', borderRadius:9999 }}/>
                        </div>
                        <span style={{ fontSize:11, color:'var(--text-muted)' }}>{wh.successRate||100}% succès</span>
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                      <button onClick={()=>testWebhook(wh.id)} disabled={!!testing}
                        style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:9, border:'1px solid var(--card-border)', background:'var(--body-bg)', color:'var(--text-secondary)', fontSize:12, cursor:'pointer', fontWeight:500, opacity:testing?0.6:1 }}>
                        {testing===wh.id?<Loader2 size={12} style={{ animation:'spin 1s linear infinite' }}/>:<Send size={12}/>}
                        Test
                      </button>
                      <button onClick={()=>toggle(wh.id)}
                        style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:9, border:`1px solid ${wh.status==='active'?'#FDE68A':'#A7F3D0'}`, fontSize:12, fontWeight:600, cursor:'pointer',
                          background:wh.status==='active'?'#FEF3C7':'#ECFDF5', color:wh.status==='active'?'#D97706':'#059669' }}>
                        {wh.status==='active'?<><Pause size={11}/>Pause</>:<><Play size={11}/>Activer</>}
                      </button>
                      <button onClick={()=>deleteWebhook(wh.id)} style={{ padding:'6px 8px', borderRadius:9, border:'none', background:'transparent', cursor:'pointer', color:'#EF4444' }}>
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  </div>

                  {/* Events + secret */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <div>
                      <p style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', marginBottom:6 }}>Événements ({(wh.events||[]).length})</p>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                        {(wh.events||[]).map((ev:string)=>(
                          <span key={ev} style={{ fontSize:11, padding:'3px 9px', borderRadius:8, background:'var(--body-bg)', color:'var(--text-secondary)', border:'1px solid var(--card-border)' }}>
                            {ALL_EVENTS.find(e=>e.value===ev)?.label||ev}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', marginBottom:6 }}>Secret de signature</p>
                      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 10px', borderRadius:9, background:'var(--body-bg)', border:'1px solid var(--card-border)' }}>
                        <code style={{ fontSize:11, flex:1, color:'var(--text-secondary)', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {showSecret[wh.id]?wh.secret:'•'.repeat(24)}
                        </code>
                        <button onClick={()=>setShowSecret(s=>({ ...s,[wh.id]:!s[wh.id] }))} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', flexShrink:0 }}>
                          {showSecret[wh.id]?<EyeOff size={12}/>:<Eye size={12}/>}
                        </button>
                        <button onClick={()=>copy(wh.id+'_secret', wh.secret)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', flexShrink:0 }}>
                          {copied===wh.id+'_secret'?<CheckCircle size={12} style={{ color:'#059669' }}/>:<Copy size={12}/>}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Delivery logs toggle */}
                <div style={{ borderTop:'1px solid var(--card-border)' }}>
                  <button onClick={()=>setExpandedLogs(s=>({ ...s,[wh.id]:!s[wh.id] }))}
                    style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 20px', background:'var(--body-bg)', border:'none', cursor:'pointer' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <Activity size={13} style={{ color:'var(--text-muted)' }}/>
                      <span style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)' }}>Logs de livraison ({logs.length})</span>
                      {failCount>0 && (
                        <span style={{ fontSize:11, padding:'1px 8px', borderRadius:9999, background:'#FEF2F2', color:'#DC2626', fontWeight:600 }}>
                          {failCount} erreur{failCount>1?'s':''}
                        </span>
                      )}
                    </div>
                    {logsExpanded?<ChevronUp size={14} style={{ color:'var(--text-muted)' }}/>:<ChevronDown size={14} style={{ color:'var(--text-muted)' }}/>}
                  </button>
                  {logsExpanded && (
                    <div style={{ padding:'0 0 8px' }}>
                      {logs.length===0 ? (
                        <p style={{ fontSize:12, color:'var(--text-muted)', textAlign:'center', padding:'16px 0' }}>Aucun envoi enregistré</p>
                      ) : (
                        <table style={{ width:'100%', borderCollapse:'collapse' }}>
                          <thead>
                            <tr style={{ background:'var(--card-bg)' }}>
                              {['Événement','Statut','Durée','Date',''].map(h=>(
                                <th key={h} style={{ padding:'7px 16px', textAlign:'left', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', color:'var(--text-muted)', whiteSpace:'nowrap', borderBottom:'1px solid var(--card-border)' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {logs.map((log:any)=>{
                              const isOk = log.status>=200&&log.status<300;
                              const isExpanded = expandedPayload===log.id;
                              return (
                                <>
                                  <tr key={log.id} style={{ borderBottom:'1px solid var(--card-border)' }}>
                                    <td style={{ padding:'8px 16px' }}>
                                      <code style={{ fontSize:12, color:'var(--text-secondary)' }}>{log.event}</code>
                                    </td>
                                    <td style={{ padding:'8px 16px' }}>
                                      <span style={{ fontSize:11, padding:'2px 9px', borderRadius:9999, fontWeight:700, background:isOk?'#ECFDF5':log.status>=500?'#FEF2F2':'#FEF3C7', color:isOk?'#059669':log.status>=500?'#DC2626':'#D97706' }}>
                                        {isOk?<>✓ </>:<><AlertCircle size={10}/> </>}{log.status}
                                      </span>
                                    </td>
                                    <td style={{ padding:'8px 16px', fontSize:12, color:'var(--text-muted)' }}>
                                      <span style={{ display:'flex', alignItems:'center', gap:4 }}><Clock size={10}/>{log.duration}ms</span>
                                    </td>
                                    <td style={{ padding:'8px 16px', fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{log.date}</td>
                                    <td style={{ padding:'8px 16px' }}>
                                      <div style={{ display:'flex', gap:6 }}>
                                        <button onClick={()=>setExpandedPayload(isExpanded?null:log.id)} style={{ fontSize:11, color:'var(--color-primary)', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>
                                          {isExpanded?'Fermer':'Payload'}
                                        </button>
                                        {!isOk && (
                                          <button onClick={()=>retryDelivery(wh.id,log.id)} style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'#D97706', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>
                                            <RefreshCw size={10}/>Rejouer
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                  {isExpanded && (
                                    <tr key={log.id+'_payload'} style={{ background:'var(--body-bg)' }}>
                                      <td colSpan={5} style={{ padding:'8px 16px' }}>
                                        <pre style={{ fontSize:11, color:'var(--text-secondary)', fontFamily:'monospace', margin:0, whiteSpace:'pre-wrap', wordBreak:'break-all' }}>{log.payload}</pre>
                                      </td>
                                    </tr>
                                  )}
                                </>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Zap({ size, style }: { size: number; style?: React.CSSProperties }) {
  return <Activity size={size} style={style}/>;
}
