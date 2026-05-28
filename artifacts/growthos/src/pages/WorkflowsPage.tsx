import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Plus, Play, Pause, ChevronRight, Zap, Clock, CheckCircle } from 'lucide-react';

const MOCK_WORKFLOWS = [
  { id:'1', name:'Nouveau prospect → Email bienvenue', trigger:'prospect_created', actions:['send_email','add_sequence'], status:'active', executions:127, lastRun:'il y a 5 min' },
  { id:'2', name:'Score > 80 → Notification équipe', trigger:'score_threshold', actions:['notify_slack','add_tag'], status:'active', executions:43, lastRun:'il y a 1h' },
  { id:'3', name:'Email ouvert × 3 → Passage qualifié', trigger:'email_opened', actions:['update_status','webhook'], status:'paused', executions:0, lastRun:'—' },
  { id:'4', name:'Deal gagné → CRM Sync', trigger:'deal_stage', actions:['webhook','send_email'], status:'active', executions:18, lastRun:'il y a 2j' },
];

const TRIGGER_ICONS: Record<string,string> = {
  prospect_created:'👤', email_opened:'📧', score_threshold:'🎯', deal_stage:'📊', schedule:'⏰',
};

export default function WorkflowsPage() {
  const [, navigate] = useLocation();
  const [workflows, setWorkflows] = useState(MOCK_WORKFLOWS);
  const API = (import.meta.env.VITE_API_URL as string) || '';

  useEffect(()=>{
    fetch(`${API}/api/v1/workflows`,{headers:{Authorization:`Bearer ${localStorage.getItem('access_token')||''}`}})
      .then(r=>r.ok?r.json():null).then(d=>{if(d){const l=Array.isArray(d)?d:d.data||[];if(l.length>0)setWorkflows(l);}}).catch(()=>{});
  },[]);

  const toggle = async (id:string, e:React.MouseEvent) => {
    e.stopPropagation();
    setWorkflows(ws=>ws.map(w=>w.id===id?{...w,status:w.status==='active'?'paused':'active'}:w));
  };

  const active = workflows.filter(w=>w.status==='active').length;
  const totalExec = workflows.reduce((s,w)=>s+w.executions,0);

  return (
    <div className="min-h-screen p-6" style={{background:'var(--body-bg)'}}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>Workflows</h1>
          <p className="text-sm" style={{color:'var(--text-muted)'}}>{active} actifs · {totalExec} exécutions</p>
        </div>
        <button onClick={()=>navigate('/workflows/new')} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{background:'var(--color-primary)'}}>
          <Plus size={14}/>Nouveau workflow
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          {l:'Actifs',v:active,icon:<Zap size={18}/>,color:'text-teal-600 bg-teal-50'},
          {l:'Exécutions totales',v:totalExec,icon:<CheckCircle size={18}/>,color:'text-green-600 bg-green-50'},
          {l:'En pause',v:workflows.length-active,icon:<Clock size={18}/>,color:'text-amber-600 bg-amber-50'},
        ].map((m,i)=>(
          <div key={i} className="rounded-2xl border p-5 flex items-center gap-4" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${m.color}`}>{m.icon}</div>
            <div><div className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>{m.v}</div><div className="text-sm" style={{color:'var(--text-muted)'}}>{m.l}</div></div>
          </div>
        ))}
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        {workflows.map(wf=>(
          <div key={wf.id} onClick={()=>navigate(`/workflows/${wf.id}`)}
            style={{borderRadius:16,border:'1px solid var(--card-border)',background:'var(--card-bg)',padding:16,cursor:'pointer',transition:'all 0.15s'}}
            onMouseEnter={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--color-primary)'}
            onMouseLeave={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--card-border)'}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:40,height:40,borderRadius:10,background:'var(--body-bg)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>
                {TRIGGER_ICONS[wf.trigger]||'⚡'}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
                  <h3 style={{fontWeight:600,fontSize:14,color:'var(--text-primary)',margin:0}}>{wf.name}</h3>
                  <span style={{fontSize:11,padding:'2px 8px',borderRadius:9999,background:wf.status==='active'?'#ECFDF5':'#F3F4F6',color:wf.status==='active'?'#059669':'#6B7280'}}>{wf.status}</span>
                </div>
                <div style={{display:'flex',gap:16,fontSize:12,color:'var(--text-muted)'}}>
                  <span>🎯 {wf.trigger}</span>
                  <span>⚡ {wf.actions.length} action{wf.actions.length>1?'s':''}</span>
                  <span>✅ {wf.executions} exécutions</span>
                  <span>🕐 {wf.lastRun}</span>
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                <button onClick={e=>toggle(wf.id,e)}
                  style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:10,border:'none',fontSize:12,fontWeight:500,cursor:'pointer',background:wf.status==='active'?'#FFFBEB':'#ECFDF5',color:wf.status==='active'?'#D97706':'#059669'}}>
                  {wf.status==='active'?<><Pause size={12}/>Pause</>:<><Play size={12}/>Activer</>}
                </button>
                <ChevronRight size={16} style={{color:'var(--text-muted)'}}/>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
