import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Plus, DollarSign, TrendingUp, Trophy, Loader2 } from 'lucide-react';
import apiClient from '@/lib/api-client';

const STAGES = [
  { id:'lead', label:'Lead', color:'#6B7280' },
  { id:'qualified', label:'Qualifié', color:'#3B82F6' },
  { id:'proposal', label:'Proposition', color:'#8B5CF6' },
  { id:'negotiation', label:'Négociation', color:'#F59E0B' },
  { id:'won', label:'Gagné', color:'#10B981' },
  { id:'lost', label:'Perdu', color:'#EF4444' },
];

const MOCK_DEALS = [
  {id:'1',title:'Contrat SaaS — TechCorp',company:'TechCorp',value:12500,stage:'qualified',probability:60,closeDate:'2026-06-15',prospect:'Sophie Martin'},
  {id:'2',title:'Abonnement Pro — StartupX',company:'StartupX',value:4800,stage:'proposal',probability:40,closeDate:'2026-06-30',prospect:'Emma Leroy'},
  {id:'3',title:'Formation équipe — BigSales',company:'BigSales SAS',value:8200,stage:'negotiation',probability:75,closeDate:'2026-06-20',prospect:'Paul Dupont'},
  {id:'4',title:'Intégration CRM — DataInc',company:'DataInc',value:3600,stage:'lead',probability:20,closeDate:'2026-07-15',prospect:'Camille Bernard'},
  {id:'5',title:'Renouvellement — GrowthCo',company:'GrowthCo',value:9600,stage:'won',probability:100,closeDate:'2026-05-30',prospect:'Luc Moreau'},
];

export default function PipelinePage() {
  const [, navigate] = useLocation();
  const [deals, setDeals] = useState(MOCK_DEALS);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'kanban'|'list'>('kanban');

  useEffect(()=>{
    const load = async () => {
      setLoading(true);
      try {
        const d: any = await apiClient.get('/pipeline');
        const l = Array.isArray(d) ? d : d.data || [];
        if (l.length > 0) setDeals(l);
      } catch {} finally { setLoading(false); }
    };
    load();
  },[]);

  const totalPipeline = deals.filter(d=>d.stage!=='won'&&d.stage!=='lost').reduce((s,d)=>s+d.value,0);
  const totalWon = deals.filter(d=>d.stage==='won').reduce((s,d)=>s+d.value,0);
  const weighted = deals.filter(d=>d.stage!=='won'&&d.stage!=='lost').reduce((s,d)=>s+(d.value*d.probability/100),0);

  return (
    <div className="min-h-screen p-6" style={{background:'var(--body-bg)'}}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>Pipeline Commercial</h1>
          <p className="text-sm" style={{color:'var(--text-muted)'}}>{deals.filter(d=>d.stage!=='won'&&d.stage!=='lost').length} deals actifs</p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1 p-1 rounded-xl" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
            {(['kanban','list'] as const).map(v=>(
              <button key={v} onClick={()=>setView(v)} className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={view===v?{background:'var(--color-primary)',color:'#fff'}:{color:'var(--text-muted)'}}>
                {v==='kanban'?'📋 Kanban':'📄 Liste'}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{background:'var(--color-primary)'}}>
            <Plus size={14}/>Nouveau deal
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          {l:'Pipeline total',v:`${(totalPipeline/1000).toFixed(0)}k€`,icon:<DollarSign size={18}/>,color:'text-blue-600 bg-blue-50'},
          {l:'CA Gagné',v:`${(totalWon/1000).toFixed(0)}k€`,icon:<Trophy size={18}/>,color:'text-green-600 bg-green-50'},
          {l:'Pipeline pondéré',v:`${(weighted/1000).toFixed(0)}k€`,icon:<TrendingUp size={18}/>,color:'text-purple-600 bg-purple-50'},
        ].map((m,i)=>(
          <div key={i} className="rounded-2xl border p-5 flex items-center gap-4" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${m.color}`}>{m.icon}</div>
            <div><div className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>{m.v}</div><div className="text-sm" style={{color:'var(--text-muted)'}}>{m.l}</div></div>
          </div>
        ))}
      </div>

      {view === 'kanban' ? (
        <div style={{display:'grid',gridTemplateColumns:`repeat(${STAGES.length},minmax(200px,1fr))`,gap:12,overflowX:'auto',paddingBottom:16}}>
          {STAGES.map(stage=>{
            const stageDeals = deals.filter(d=>d.stage===stage.id);
            const total = stageDeals.reduce((s,d)=>s+d.value,0);
            return (
              <div key={stage.id} style={{display:'flex',flexDirection:'column',gap:8}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',borderRadius:10,background:'var(--card-bg)',border:'1px solid var(--card-border)',marginBottom:4}}>
                  <span style={{fontSize:13,fontWeight:700,color:stage.color}}>{stage.label}</span>
                  <span style={{fontSize:12,color:'var(--text-muted)'}}>{stageDeals.length} · {(total/1000).toFixed(0)}k€</span>
                </div>
                {stageDeals.map(deal=>(
                  <div key={deal.id} onClick={()=>navigate(`/pipeline/${deal.id}`)}
                    style={{padding:12,borderRadius:12,background:'var(--card-bg)',border:'1px solid var(--card-border)',cursor:'pointer',transition:'all 0.15s'}}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.boxShadow='0 4px 12px rgba(0,0,0,.08)';(e.currentTarget as HTMLElement).style.borderColor=stage.color;}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.boxShadow='none';(e.currentTarget as HTMLElement).style.borderColor='var(--card-border)';}}>
                    <div style={{fontWeight:600,fontSize:13,color:'var(--text-primary)',marginBottom:4}}>{deal.title}</div>
                    <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:8}}>{deal.company}</div>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{fontWeight:700,fontSize:14,color:'var(--color-primary)'}}>{deal.value.toLocaleString()}€</span>
                      <span style={{fontSize:11,padding:'2px 8px',borderRadius:9999,background:'#F3F4F6',color:'#374151'}}>{deal.probability}%</span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {deals.map(deal=>{
            const stage = STAGES.find(s=>s.id===deal.stage)||STAGES[0];
            return (
              <div key={deal.id} onClick={()=>navigate(`/pipeline/${deal.id}`)}
                style={{display:'flex',alignItems:'center',gap:16,padding:'14px 16px',borderRadius:14,background:'var(--card-bg)',border:'1px solid var(--card-border)',cursor:'pointer',transition:'all 0.15s'}}
                onMouseEnter={e=>(e.currentTarget as HTMLElement).style.boxShadow='0 4px 12px rgba(0,0,0,.08)'}
                onMouseLeave={e=>(e.currentTarget as HTMLElement).style.boxShadow='none'}>
                <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14,color:'var(--text-primary)'}}>{deal.title}</div><div style={{fontSize:12,color:'var(--text-muted)'}}>{deal.company} · {deal.prospect}</div></div>
                <span style={{fontSize:12,fontWeight:600,padding:'3px 10px',borderRadius:9999,color:stage.color,background:`${stage.color}15`}}>{stage.label}</span>
                <span style={{fontWeight:700,fontSize:15,color:'var(--color-primary)'}}>{deal.value.toLocaleString()}€</span>
                <span style={{fontSize:12,color:'var(--text-muted)'}}>{deal.probability}%</span>
                <span style={{fontSize:12,color:'var(--text-muted)'}}>{deal.closeDate}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
