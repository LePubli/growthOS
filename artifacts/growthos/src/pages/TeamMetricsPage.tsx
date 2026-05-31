import { useState } from 'react';
import { Trophy, TrendingUp, TrendingDown, Target, Users, Mail, Phone, DollarSign, Award, Activity, ChevronUp, ChevronDown, MessageSquare, Star, Flame } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, Radar, Legend } from 'recharts';

const TEAM = [
  { id:'1', name:'Sophie Martin', avatar:'SM', role:'Account Executive', quota:50000, achieved:47200, deals:8, calls:34, emails:127, prospects:42, trend:12, prevAchieved:42100, coaching:'Très bonne progression sur le closing. Travailler la phase de découverte pour raccourcir le cycle.', strengths:['Closing','Relation client','Demo'], areas:['Découverte','Négociation'] },
  { id:'2', name:'Paul Dupont',   avatar:'PD', role:'Sales Manager',     quota:80000, achieved:71400, deals:12, calls:48, emails:198, prospects:67, trend:8,  prevAchieved:66100, coaching:'Solide sur le management. Améliorer la délégation des deals simples à l\'équipe.', strengths:['Pipeline','Stratégie','Coaching'], areas:['Délégation','Reporting'] },
  { id:'3', name:'Alice Moreau',  avatar:'AM', role:'SDR',               quota:30000, achieved:31500, deals:5,  calls:62, emails:241, prospects:89, trend:23, prevAchieved:25600, coaching:'Excellent taux de prospection. Monter en compétence sur la qualification BANT.', strengths:['Volume','Prospection','Énergie'], areas:['Qualification','Closing'] },
  { id:'4', name:'Marc Bernard',  avatar:'MB', role:'Account Executive', quota:50000, achieved:38900, deals:6,  calls:27, emails:96,  prospects:31, trend:-3, prevAchieved:40100, coaching:'En dessous de l\'objectif ce mois. Revoir le volume d\'activité et la stratégie de compte.', strengths:['Technique','Écoute','Patience'], areas:['Volume','Closing','Suivi'] },
  { id:'5', name:'Lucie Petit',   avatar:'LP', role:'SDR',               quota:30000, achieved:22100, deals:3,  calls:41, emails:173, prospects:58, trend:5,  prevAchieved:21000, coaching:'Bonne progression sur les emails. Augmenter le volume d\'appels pour atteindre le quota.', strengths:['Écriture','Persévérance'], areas:['Appels','Qualification','Urgence'] },
];

const MONTHLY = [
  { name:'Jan', Sophie:8200,  Paul:12400, Alice:5100, Marc:7800, Lucie:3200 },
  { name:'Fév', Sophie:9100,  Paul:11800, Alice:6200, Marc:6900, Lucie:4100 },
  { name:'Mar', Sophie:10400, Paul:14200, Alice:7800, Marc:8200, Lucie:5300 },
  { name:'Avr', Sophie:11200, Paul:13600, Alice:6900, Marc:7100, Lucie:4800 },
  { name:'Mai', Sophie:12300, Paul:15400, Alice:9100, Marc:9200, Lucie:5600 },
  { name:'Jun', Sophie:8700,  Paul:11800, Alice:7900, Marc:7100, Lucie:4300 },
];

const RADAR_DATA = [
  { metric:'Volume',     Sophie:88, Paul:72, Alice:95, Marc:54, Lucie:68 },
  { metric:'Closing',    Sophie:94, Paul:89, Alice:52, Marc:78, Lucie:44 },
  { metric:'Qualifying', Sophie:76, Paul:82, Alice:61, Marc:70, Lucie:58 },
  { metric:'Emails',     Sophie:82, Paul:78, Alice:98, Marc:64, Lucie:85 },
  { metric:'Deals',      Sophie:85, Paul:93, Alice:60, Marc:72, Lucie:48 },
];

const COLORS = ['#3B82F6','#7C3AED','#059669','#F59E0B','#EF4444'];
const MEDALS = ['🥇','🥈','🥉','4.','5.'];

type Metric = 'achieved'|'deals'|'calls'|'emails';
type Tab = 'leaderboard'|'charts'|'coaching';

export default function TeamMetricsPage() {
  const [metric, setMetric]   = useState<Metric>('achieved');
  const [period, setPeriod]   = useState('month');
  const [tab, setTab]         = useState<Tab>('leaderboard');
  const [coaching, setCoaching] = useState<string|null>(null);

  const totalRevenue  = TEAM.reduce((s,m)=>s+m.achieved,0);
  const totalQuota    = TEAM.reduce((s,m)=>s+m.quota,0);
  const totalPrev     = TEAM.reduce((s,m)=>s+m.prevAchieved,0);
  const attainment    = Math.round((totalRevenue/totalQuota)*100);
  const revGrowth     = Math.round(((totalRevenue-totalPrev)/totalPrev)*100);
  const sorted        = [...TEAM].sort((a,b)=>b[metric]-a[metric]);

  const coachingMember = TEAM.find(m=>m.id===coaching)||null;

  return (
    <div style={{ minHeight:'100vh', padding:24, background:'var(--body-bg)' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'var(--text-primary)', margin:0 }}>Métriques équipe</h1>
          <p style={{ fontSize:13, color:'var(--text-muted)', margin:'2px 0 0' }}>{TEAM.length} commerciaux · Performance commerciale</p>
        </div>
        <div style={{ display:'flex', gap:6, padding:4, borderRadius:12, background:'var(--card-bg)', border:'1px solid var(--card-border)' }}>
          {(['week','month','quarter'] as const).map(p=>(
            <button key={p} onClick={()=>setPeriod(p)}
              style={{ padding:'6px 14px', borderRadius:8, border:'none', fontSize:13, fontWeight:500, cursor:'pointer', background:period===p?'var(--color-primary)':'transparent', color:period===p?'#fff':'var(--text-muted)' }}>
              {p==='week'?'Sem.':p==='month'?'Mois':'Trim.'}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12, marginBottom:20 }}>
        {[
          { l:'CA Total', v:`${(totalRevenue/1000).toFixed(0)}k€`, sub:`${revGrowth>0?'+':''}${revGrowth}% vs mois préc.`, icon:<DollarSign size={16}/>, color:'#059669', bg:'#ECFDF5', up:revGrowth>0 },
          { l:'Quota atteint', v:`${attainment}%`, sub:`${(totalRevenue/1000).toFixed(0)}k / ${(totalQuota/1000).toFixed(0)}k€`, icon:<Target size={16}/>, color:attainment>=80?'#059669':'#D97706', bg:attainment>=80?'#ECFDF5':'#FEF3C7', up:attainment>=80 },
          { l:'Deals signés', v:TEAM.reduce((s,m)=>s+m.deals,0), sub:'ce mois', icon:<Trophy size={16}/>, color:'#2563EB', bg:'#EFF6FF', up:true },
          { l:'Appels passés', v:TEAM.reduce((s,m)=>s+m.calls,0), sub:'équipe totale', icon:<Phone size={16}/>, color:'#7C3AED', bg:'#EDE9FE', up:true },
          { l:'Emails envoyés', v:TEAM.reduce((s,m)=>s+m.emails,0), sub:'ce mois', icon:<Mail size={16}/>, color:'#D97706', bg:'#FEF3C7', up:true },
          { l:'Prospects actifs', v:TEAM.reduce((s,m)=>s+m.prospects,0), sub:'en pipe', icon:<Users size={16}/>, color:'#0891B2', bg:'#ECFEFF', up:true },
        ].map((k,i)=>(
          <div key={i} style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:14, padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:k.bg, color:k.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{k.icon}</div>
            <div>
              <div style={{ fontSize:20, fontWeight:800, color:'var(--text-primary)', lineHeight:1.1 }}>{k.v}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:1 }}>{k.l}</div>
              <div style={{ fontSize:10, color:k.up?'#059669':'#DC2626', fontWeight:600, display:'flex', alignItems:'center', gap:2, marginTop:1 }}>
                {k.up?<TrendingUp size={9}/>:<TrendingDown size={9}/>}{k.sub}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, padding:4, borderRadius:12, background:'var(--card-bg)', border:'1px solid var(--card-border)', marginBottom:16, width:'fit-content' }}>
        {([['leaderboard','🏆 Leaderboard'],['charts','📊 Graphiques'],['coaching','🎯 Coaching']] as [Tab,string][]).map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{ padding:'7px 16px', borderRadius:9, border:'none', fontSize:13, fontWeight:600, cursor:'pointer', background:tab===t?'var(--color-primary)':'transparent', color:tab===t?'#fff':'var(--text-muted)', transition:'all .15s' }}>
            {l}
          </button>
        ))}
      </div>

      {/* Tab: Leaderboard */}
      {tab==='leaderboard' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, padding:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h2 style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)', margin:0 }}>🏆 Classement</h2>
              <select value={metric} onChange={e=>setMetric(e.target.value as Metric)}
                style={{ padding:'5px 10px', borderRadius:8, border:'1px solid var(--card-border)', background:'var(--body-bg)', color:'var(--text-primary)', fontSize:12, outline:'none' }}>
                <option value="achieved">CA réalisé</option>
                <option value="deals">Deals</option>
                <option value="calls">Appels</option>
                <option value="emails">Emails</option>
              </select>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {sorted.map((member,i)=>{
                const pct = metric==='achieved'
                  ? Math.min(100,(member.achieved/member.quota)*100)
                  : Math.min(100,(member[metric]/Math.max(...TEAM.map(m=>m[metric])))*100);
                const isFirst = i===0;
                return (
                  <div key={member.id} style={{ padding:'12px 14px', borderRadius:12, background:isFirst?`color-mix(in srgb, var(--color-primary) 8%, transparent)`:'var(--body-bg)', border:`1px solid ${isFirst?'var(--color-primary)':'transparent'}` }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:7 }}>
                      <span style={{ fontSize:16, minWidth:22, textAlign:'center' }}>{MEDALS[i]}</span>
                      <div style={{ width:30, height:30, borderRadius:'50%', background:COLORS[i], color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0 }}>{member.avatar}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>{member.name}</div>
                        <div style={{ fontSize:10, color:'var(--text-muted)' }}>{member.role}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:14, fontWeight:700, color:isFirst?'var(--color-primary)':'var(--text-primary)' }}>
                          {metric==='achieved'?`${member.achieved.toLocaleString()}€`:member[metric]}
                        </div>
                        <div style={{ fontSize:10, color:member.trend>0?'#059669':'#DC2626', fontWeight:600, display:'flex', alignItems:'center', justifyContent:'flex-end', gap:2 }}>
                          {member.trend>0?<ChevronUp size={10}/>:<ChevronDown size={10}/>}{member.trend>0?'+':''}{member.trend}%
                        </div>
                      </div>
                    </div>
                    <div style={{ height:5, borderRadius:9999, background:'var(--card-border)', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:COLORS[i], borderRadius:9999, transition:'width .5s ease' }}/>
                    </div>
                    {metric==='achieved' && <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:3, textAlign:'right' }}>{pct.toFixed(0)}% du quota</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quota progress */}
          <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, padding:20 }}>
            <h2 style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)', margin:'0 0 16px' }}>Progression vers l'objectif</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {TEAM.map((m,i)=>{
                const pct = Math.round((m.achieved/m.quota)*100);
                const growth = Math.round(((m.achieved-m.prevAchieved)/m.prevAchieved)*100);
                return (
                  <div key={m.id}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:24, height:24, borderRadius:'50%', background:COLORS[i], color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0 }}>{m.avatar}</div>
                        <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)' }}>{m.name}</span>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:10, color:growth>=0?'#059669':'#DC2626', fontWeight:600 }}>{growth>=0?'+':''}{growth}%</span>
                        <span style={{ fontSize:12, fontWeight:700, color:pct>=100?'#059669':pct>=75?'#D97706':'#EF4444' }}>{pct}%</span>
                      </div>
                    </div>
                    <div style={{ height:8, borderRadius:9999, background:'var(--card-border)', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${Math.min(100,pct)}%`, borderRadius:9999, transition:'width .5s', background:pct>=100?'#059669':pct>=75?COLORS[i]:'#EF4444' }}/>
                    </div>
                    <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2, display:'flex', justifyContent:'space-between' }}>
                      <span>{m.achieved.toLocaleString()}€ réalisé</span>
                      <span>Objectif : {m.quota.toLocaleString()}€</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Team health */}
            <div style={{ marginTop:20, padding:14, borderRadius:12, background:'var(--body-bg)', border:'1px solid var(--card-border)' }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                <Flame size={14} color="#F59E0B"/> Santé de l'équipe
              </div>
              {[
                { l:'Dépassent leur quota', v:`${TEAM.filter(m=>m.achieved>=m.quota).length}/${TEAM.length}`, color:'#059669' },
                { l:'CA moyen / commercial', v:`${Math.round(totalRevenue/TEAM.length/1000)}k€`, color:'var(--color-primary)' },
                { l:'Taux d\'atteinte moyen', v:`${Math.round(TEAM.reduce((s,m)=>s+(m.achieved/m.quota),0)/TEAM.length*100)}%`, color:'#7C3AED' },
              ].map(s=>(
                <div key={s.l} style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:11, color:'var(--text-muted)' }}>{s.l}</span>
                  <span style={{ fontSize:11, fontWeight:700, color:s.color }}>{s.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Charts */}
      {tab==='charts' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, padding:20 }}>
            <h2 style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)', margin:'0 0 16px' }}>CA par commercial (6 mois)</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={MONTHLY} barSize={8}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)"/>
                <XAxis dataKey="name" tick={{ fontSize:11, fill:'var(--text-muted)' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize:11, fill:'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
                <Tooltip contentStyle={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:10, fontSize:12 }} formatter={(v:any)=>[`${v.toLocaleString()}€`]}/>
                <Legend iconSize={10} wrapperStyle={{ fontSize:11 }}/>
                {TEAM.map((m,i)=>(
                  <Bar key={m.id} dataKey={m.name.split(' ')[0]} fill={COLORS[i]} radius={[3,3,0,0]}/>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, padding:20 }}>
            <h2 style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)', margin:'0 0 16px' }}>Radar performance</h2>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={RADAR_DATA}>
                <PolarGrid stroke="var(--card-border)"/>
                <PolarAngleAxis dataKey="metric" tick={{ fontSize:11, fill:'var(--text-muted)' }}/>
                {TEAM.slice(0,3).map((m,i)=>(
                  <Radar key={m.id} name={m.name.split(' ')[0]} dataKey={m.name.split(' ')[0]} stroke={COLORS[i]} fill={COLORS[i]} fillOpacity={0.1}/>
                ))}
                <Legend iconSize={10} wrapperStyle={{ fontSize:11 }}/>
                <Tooltip contentStyle={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:10, fontSize:12 }}/>
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Activity table */}
          <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, padding:20, gridColumn:'1/-1' }}>
            <h2 style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)', margin:'0 0 14px' }}>Activité détaillée</h2>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'var(--body-bg)' }}>
                    {['Commercial','Rôle','CA réalisé','Quota','Atteint','vs préc.','Deals','Appels','Emails','Prospects'].map(h=>(
                      <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', color:'var(--text-muted)', whiteSpace:'nowrap', borderBottom:'1px solid var(--card-border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TEAM.map((m,i)=>{
                    const att = Math.round((m.achieved/m.quota)*100);
                    const gr  = Math.round(((m.achieved-m.prevAchieved)/m.prevAchieved)*100);
                    return (
                      <tr key={m.id} style={{ borderBottom:'1px solid var(--card-border)' }}>
                        <td style={{ padding:'10px 12px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <div style={{ width:26, height:26, borderRadius:'50%', background:COLORS[i], color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0 }}>{m.avatar}</div>
                            <span style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', whiteSpace:'nowrap' }}>{m.name}</span>
                          </div>
                        </td>
                        <td style={{ padding:'10px 12px', fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{m.role}</td>
                        <td style={{ padding:'10px 12px', fontSize:13, fontWeight:700, color:'var(--color-primary)', whiteSpace:'nowrap' }}>{m.achieved.toLocaleString()}€</td>
                        <td style={{ padding:'10px 12px', fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{m.quota.toLocaleString()}€</td>
                        <td style={{ padding:'10px 12px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                            <div style={{ height:5, width:50, borderRadius:9999, background:'var(--card-border)', overflow:'hidden', flexShrink:0 }}>
                              <div style={{ height:'100%', width:`${Math.min(100,att)}%`, background:att>=100?'#059669':att>=75?'#F59E0B':'#EF4444' }}/>
                            </div>
                            <span style={{ fontSize:11, fontWeight:700, color:att>=100?'#059669':att>=75?'#D97706':'#DC2626' }}>{att}%</span>
                          </div>
                        </td>
                        <td style={{ padding:'10px 12px', fontSize:12, fontWeight:600, color:gr>=0?'#059669':'#DC2626', whiteSpace:'nowrap' }}>
                          <span style={{ display:'flex', alignItems:'center', gap:2 }}>{gr>=0?<ChevronUp size={12}/>:<ChevronDown size={12}/>}{Math.abs(gr)}%</span>
                        </td>
                        <td style={{ padding:'10px 12px', fontSize:13, fontWeight:600, color:'var(--text-primary)', textAlign:'center' }}>{m.deals}</td>
                        <td style={{ padding:'10px 12px', fontSize:13, color:'var(--text-secondary)', textAlign:'center' }}>{m.calls}</td>
                        <td style={{ padding:'10px 12px', fontSize:13, color:'var(--text-secondary)', textAlign:'center' }}>{m.emails}</td>
                        <td style={{ padding:'10px 12px', fontSize:13, color:'var(--text-secondary)', textAlign:'center' }}>{m.prospects}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Coaching */}
      {tab==='coaching' && (
        <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:16 }}>
          {/* Member list */}
          <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, padding:16 }}>
            <h2 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', margin:'0 0 12px' }}>Sélectionner un commercial</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {TEAM.map((m,i)=>{
                const att = Math.round((m.achieved/m.quota)*100);
                return (
                  <button key={m.id} onClick={()=>setCoaching(m.id)}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:12, border:`1px solid ${coaching===m.id?'var(--color-primary)':'var(--card-border)'}`, background:coaching===m.id?`color-mix(in srgb, var(--color-primary) 8%, transparent)`:'var(--body-bg)', cursor:'pointer', textAlign:'left' }}>
                    <div style={{ width:32, height:32, borderRadius:'50%', background:COLORS[i], color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0 }}>{m.avatar}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{m.name}</div>
                      <div style={{ fontSize:10, color:'var(--text-muted)' }}>{m.role}</div>
                    </div>
                    <span style={{ fontSize:11, fontWeight:700, color:att>=100?'#059669':att>=75?'#D97706':'#DC2626', flexShrink:0 }}>{att}%</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Coaching detail */}
          {coachingMember ? (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, padding:20 }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
                  <div style={{ width:48, height:48, borderRadius:'50%', background:COLORS[TEAM.findIndex(m=>m.id===coachingMember.id)], color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:800, flexShrink:0 }}>{coachingMember.avatar}</div>
                  <div>
                    <div style={{ fontSize:18, fontWeight:800, color:'var(--text-primary)' }}>{coachingMember.name}</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)' }}>{coachingMember.role}</div>
                  </div>
                  <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:11, padding:'4px 12px', borderRadius:9999, background:'#EDE9FE', color:'#7C3AED', fontWeight:600 }}>{MEDALS[TEAM.findIndex(m=>m.id===coachingMember.id)]} classement</span>
                  </div>
                </div>
                <div style={{ padding:14, borderRadius:12, background:'var(--body-bg)', border:'1px solid var(--card-border)', fontSize:13, color:'var(--text-secondary)', lineHeight:1.6 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                    <MessageSquare size={14} color="var(--color-primary)"/>
                    <span style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)' }}>Note du manager</span>
                  </div>
                  {coachingMember.coaching}
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, padding:16 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#059669', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                    <Star size={13}/> Points forts
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {coachingMember.strengths.map((s,i)=>(
                      <div key={i} style={{ fontSize:12, padding:'5px 10px', borderRadius:8, background:'#ECFDF5', color:'#059669', fontWeight:500 }}>✓ {s}</div>
                    ))}
                  </div>
                </div>
                <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, padding:16 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#D97706', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                    <Activity size={13}/> Axes d'amélioration
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {coachingMember.areas.map((a,i)=>(
                      <div key={i} style={{ fontSize:12, padding:'5px 10px', borderRadius:8, background:'#FEF3C7', color:'#D97706', fontWeight:500 }}>→ {a}</div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, padding:16 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', marginBottom:12 }}>KPIs personnels</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
                  {[
                    { l:'CA réalisé', v:`${(coachingMember.achieved/1000).toFixed(0)}k€`, sub:`/ ${(coachingMember.quota/1000).toFixed(0)}k€ objectif` },
                    { l:'Deals', v:coachingMember.deals, sub:'signés ce mois' },
                    { l:'Appels', v:coachingMember.calls, sub:'passés' },
                    { l:'Emails', v:coachingMember.emails, sub:'envoyés' },
                  ].map((k,i)=>(
                    <div key={i} style={{ textAlign:'center', padding:'10px', borderRadius:10, background:'var(--body-bg)', border:'1px solid var(--card-border)' }}>
                      <div style={{ fontSize:20, fontWeight:800, color:'var(--color-primary)' }}>{k.v}</div>
                      <div style={{ fontSize:11, fontWeight:600, color:'var(--text-primary)', marginTop:2 }}>{k.l}</div>
                      <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:1 }}>{k.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, padding:40, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:10 }}>
              <Award size={36} style={{ color:'var(--card-border)' }}/>
              <p style={{ fontSize:13, color:'var(--text-muted)', textAlign:'center' }}>Sélectionnez un commercial<br/>pour voir son profil coaching</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
