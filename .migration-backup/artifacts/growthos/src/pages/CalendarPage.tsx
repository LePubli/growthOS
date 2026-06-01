import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Clock, User, MapPin, Video, X, Calendar as CalIcon, List, Grid, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface CalEvent {
  id: string;
  title: string;
  type: 'call' | 'meeting' | 'demo' | 'task';
  day: number;
  hour: number;
  duration: number;
  contact: string;
  company: string;
  location?: string;
  notes?: string;
  color: string;
}

const TYPE_META = {
  call:    { label:'Appel',   color:'#059669', bg:'#ECFDF5', icon:'📞' },
  meeting: { label:'Réunion', color:'#2563EB', bg:'#EFF6FF', icon:'🤝' },
  demo:    { label:'Demo',    color:'#7C3AED', bg:'#EDE9FE', icon:'💻' },
  task:    { label:'Tâche',   color:'#D97706', bg:'#FEF3C7', icon:'✅' },
};

const TODAY   = new Date();
const YEAR_0  = TODAY.getFullYear();
const MONTH_0 = TODAY.getMonth();

function daysInMonth(y:number,m:number){ return new Date(y,m+1,0).getDate(); }
function firstDow(y:number,m:number){ return new Date(y,m,1).getDay(); }

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const DAYS_FR   = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
const DAYS_FULL = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
const HOURS     = Array.from({ length:13 },(_,i)=>i+7);

const BASE_EVENTS: CalEvent[] = [
  { id:'1', title:'Demo GrowthOS',         type:'demo',    day:TODAY.getDate(),   hour:10, duration:1,   contact:'Sophie Martin', company:'TechCorp',    location:'Visio',                     color:'#7C3AED' },
  { id:'2', title:'Suivi proposition',      type:'call',    day:TODAY.getDate(),   hour:14, duration:0.5, contact:'Paul Dupont',   company:'BigSales SAS', notes:'Relancer sur le tarif',       color:'#059669' },
  { id:'3', title:'Négociation contrat',    type:'meeting', day:TODAY.getDate()+1, hour:9,  duration:2,   contact:'Marie Dubois',  company:'AlphaTech',   location:'12 rue de Rivoli, Paris',  color:'#2563EB' },
  { id:'4', title:'Demo plateforme',        type:'demo',    day:TODAY.getDate()+2, hour:11, duration:1,   contact:'Emma Leroy',    company:'StartupX',    location:'Visio',                     color:'#7C3AED' },
  { id:'5', title:'Appel découverte',       type:'call',    day:TODAY.getDate()+3, hour:16, duration:0.5, contact:'Luc Moreau',    company:'GrowthCo',                                          color:'#059669' },
  { id:'6', title:'Préparer proposition',   type:'task',    day:TODAY.getDate()+1, hour:8,  duration:1,   contact:'',              company:'DataInc',     notes:'Rédiger offre personnalisée', color:'#D97706' },
  { id:'7', title:'Suivi deal Série B',     type:'call',    day:TODAY.getDate(),   hour:11, duration:0.5, contact:'Julien Marc',   company:'TechVision',                                        color:'#059669' },
  { id:'8', title:'Revue pipeline hebdo',   type:'meeting', day:TODAY.getDate()+4, hour:9,  duration:1,   contact:'Équipe sales',  company:'Interne',                                           color:'#2563EB' },
];

const EMPTY_FORM = { title:'', type:'call' as CalEvent['type'], day:TODAY.getDate().toString(), hour:'10', duration:'1', contact:'', company:'', location:'', notes:'' };

export default function CalendarPage() {
  const [year,  setYear]  = useState(YEAR_0);
  const [month, setMonth] = useState(MONTH_0);
  const [view,  setView]  = useState<'month'|'week'|'day'>('month');
  const [events, setEvents] = useState<CalEvent[]>(BASE_EVENTS);
  const [selectedDay, setSelectedDay] = useState<number|null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalEvent|null>(null);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [weekOffset, setWeekOffset] = useState(0);

  const prevMonth = ()=>{ if (month===0){ setMonth(11); setYear(y=>y-1); } else setMonth(m=>m-1); };
  const nextMonth = ()=>{ if (month===11){ setMonth(0); setYear(y=>y+1); } else setMonth(m=>m+1); };

  const eventsForDay = (d:number)=> events.filter(e=>e.day===d);
  const todayEvs = events.filter(e=>e.day===TODAY.getDate()).sort((a,b)=>a.hour-b.hour);

  const addEvent = ()=>{
    if (!addForm.title.trim()){ toast.error('Donnez un titre à l\'événement'); return; }
    const meta = TYPE_META[addForm.type];
    setEvents(ev=>[...ev,{
      id: Date.now().toString(), title:addForm.title||'Événement', type:addForm.type,
      day:parseInt(addForm.day)||TODAY.getDate(), hour:parseInt(addForm.hour)||10,
      duration:parseFloat(addForm.duration)||1,
      contact:addForm.contact, company:addForm.company, location:addForm.location, notes:addForm.notes,
      color:meta.color,
    }]);
    setShowAdd(false); setAddForm(EMPTY_FORM);
    toast.success('Événement créé');
  };

  const deleteEvent = (id:string)=>{
    setEvents(ev=>ev.filter(e=>e.id!==id));
    setSelectedEvent(null);
    toast.success('Événement supprimé');
  };

  // Week view helpers
  const getWeekStart = ()=>{
    const d = new Date(TODAY);
    d.setDate(d.getDate() - d.getDay() + weekOffset*7);
    return d;
  };
  const weekStart = getWeekStart();
  const weekDays  = Array.from({ length:7 },(_,i)=>{ const d=new Date(weekStart); d.setDate(d.getDate()+i); return d; });

  const eventsForDate = (date:Date)=> events.filter(e=>{
    const isCurrentMonth = month===MONTH_0&&year===YEAR_0;
    return e.day===date.getDate() && (date.getMonth()===MONTH_0||date.getMonth()===TODAY.getMonth());
  });

  const inputStyle = { width:'100%', padding:'8px 12px', borderRadius:9, border:'1px solid var(--card-border)', background:'var(--body-bg)', color:'var(--text-primary)', fontSize:13, outline:'none', boxSizing:'border-box' as const };

  return (
    <div style={{ minHeight:'100vh', background:'var(--body-bg)', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10, borderBottom:'1px solid var(--card-border)', background:'var(--card-bg)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ display:'flex', gap:3 }}>
            <button onClick={prevMonth} style={{ width:30, height:30, borderRadius:8, border:'1px solid var(--card-border)', background:'var(--body-bg)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><ChevronLeft size={14} style={{ color:'var(--text-muted)' }}/></button>
            <button onClick={nextMonth} style={{ width:30, height:30, borderRadius:8, border:'1px solid var(--card-border)', background:'var(--body-bg)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><ChevronRight size={14} style={{ color:'var(--text-muted)' }}/></button>
          </div>
          <h1 style={{ fontSize:19, fontWeight:800, color:'var(--text-primary)', margin:0 }}>{MONTHS_FR[month]} {year}</h1>
          <button onClick={()=>{ setMonth(MONTH_0); setYear(YEAR_0); setWeekOffset(0); }}
            style={{ fontSize:12, color:'var(--color-primary)', background:`var(--color-primary)15`, border:`1px solid var(--color-primary)30`, borderRadius:7, padding:'3px 10px', cursor:'pointer', fontWeight:600 }}>
            Aujourd'hui
          </button>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ display:'flex', gap:2, padding:3, borderRadius:10, background:'var(--body-bg)', border:'1px solid var(--card-border)' }}>
            {([['month','Mois'],['week','Semaine'],['day','Jour']] as const).map(([v,l])=>(
              <button key={v} onClick={()=>setView(v)}
                style={{ padding:'5px 11px', borderRadius:7, border:'none', fontSize:12, fontWeight:500, cursor:'pointer', background:view===v?'var(--color-primary)':'transparent', color:view===v?'#fff':'var(--text-muted)', transition:'all .15s' }}>
                {l}
              </button>
            ))}
          </div>
          <button onClick={()=>setShowAdd(true)} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:10, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            <Plus size={14}/>Nouveau
          </button>
        </div>
      </div>

      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        {/* ── MONTH VIEW ── */}
        {view==='month' && (
          <>
            <div style={{ flex:1, padding:12, overflowY:'auto' }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:4 }}>
                {DAYS_FR.map(d=>(
                  <div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--text-muted)', padding:'6px 0' }}>{d}</div>
                ))}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
                {Array.from({ length:firstDow(year,month) },(_,i)=>(
                  <div key={`e${i}`} style={{ minHeight:88, borderRadius:8, background:'var(--card-bg)', opacity:0.3, border:'1px solid var(--card-border)' }}/>
                ))}
                {Array.from({ length:daysInMonth(year,month) },(_,i)=>{
                  const day=i+1;
                  const isToday = day===TODAY.getDate()&&month===MONTH_0&&year===YEAR_0;
                  const dayEvs  = eventsForDay(day);
                  const isSel   = selectedDay===day;
                  return (
                    <div key={day} onClick={()=>setSelectedDay(isSel?null:day)}
                      style={{ minHeight:88, borderRadius:8, background:isSel?`color-mix(in srgb, var(--color-primary) 8%, var(--card-bg))`:'var(--card-bg)', border:`1px solid ${isSel?'var(--color-primary)':'var(--card-border)'}`, padding:6, cursor:'pointer', overflow:'hidden', transition:'all .1s' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                        <span style={{ fontSize:12, fontWeight:isToday?700:400, color:isToday?'#fff':'var(--text-primary)', width:22, height:22, borderRadius:'50%', background:isToday?'var(--color-primary)':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{day}</span>
                        {dayEvs.length>0 && <span style={{ fontSize:10, color:'var(--text-muted)' }}>{dayEvs.length}</span>}
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                        {dayEvs.slice(0,3).map(ev=>(
                          <div key={ev.id} onClick={e=>{ e.stopPropagation(); setSelectedEvent(ev); }}
                            style={{ fontSize:10, padding:'2px 5px', borderRadius:4, background:`${ev.color}18`, color:ev.color, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', cursor:'pointer' }}>
                            {TYPE_META[ev.type].icon} {ev.title}
                          </div>
                        ))}
                        {dayEvs.length>3 && <div style={{ fontSize:10, color:'var(--text-muted)', paddingLeft:4 }}>+{dayEvs.length-3}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Today sidebar */}
            <div style={{ width:250, borderLeft:'1px solid var(--card-border)', background:'var(--card-bg)', padding:'14px 12px', overflowY:'auto', flexShrink:0 }}>
              <h3 style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', margin:'0 0 2px' }}>Aujourd'hui</h3>
              <p style={{ fontSize:11, color:'var(--text-muted)', marginBottom:12 }}>{TODAY.toLocaleDateString('fr-FR',{ weekday:'long', day:'numeric', month:'long' })}</p>
              {todayEvs.length===0 ? (
                <div style={{ textAlign:'center', padding:'20px 0', color:'var(--text-muted)', fontSize:12 }}>
                  <CalIcon size={24} style={{ margin:'0 auto 6px', opacity:0.3, display:'block' }}/>Aucun événement
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                  {todayEvs.map(ev=>{
                    const meta=TYPE_META[ev.type];
                    return (
                      <div key={ev.id} onClick={()=>setSelectedEvent(ev)} style={{ padding:'9px 10px', borderRadius:10, border:`1px solid ${ev.color}40`, background:`${ev.color}0d`, cursor:'pointer' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:3 }}>
                          <span style={{ fontSize:13 }}>{meta.icon}</span>
                          <span style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.title}</span>
                        </div>
                        <div style={{ fontSize:10, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ display:'flex', alignItems:'center', gap:2 }}><Clock size={9}/>{ev.hour}h{ev.duration<1?'30':'00'} — {ev.duration}h</span>
                        </div>
                        {ev.contact && <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}><User size={9}/> {ev.contact}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Legend */}
              <div style={{ marginTop:20, paddingTop:14, borderTop:'1px solid var(--card-border)' }}>
                <h4 style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Types</h4>
                {Object.entries(TYPE_META).map(([k,v])=>(
                  <div key={k} style={{ display:'flex', alignItems:'center', gap:7, marginBottom:5 }}>
                    <div style={{ width:9, height:9, borderRadius:3, background:v.color, flexShrink:0 }}/>
                    <span style={{ fontSize:11, color:'var(--text-secondary)' }}>{v.icon} {v.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── WEEK VIEW ── */}
        {view==='week' && (
          <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
            {/* Week nav */}
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 16px', borderBottom:'1px solid var(--card-border)', background:'var(--card-bg)', flexShrink:0 }}>
              <button onClick={()=>setWeekOffset(o=>o-1)} style={{ width:28, height:28, borderRadius:7, border:'1px solid var(--card-border)', background:'var(--body-bg)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><ChevronLeft size={13} style={{ color:'var(--text-muted)' }}/></button>
              <span style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>
                {weekDays[0].toLocaleDateString('fr-FR',{ day:'numeric', month:'long' })} — {weekDays[6].toLocaleDateString('fr-FR',{ day:'numeric', month:'long', year:'numeric' })}
              </span>
              <button onClick={()=>setWeekOffset(o=>o+1)} style={{ width:28, height:28, borderRadius:7, border:'1px solid var(--card-border)', background:'var(--body-bg)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><ChevronRight size={13} style={{ color:'var(--text-muted)' }}/></button>
            </div>

            <div style={{ flex:1, overflowY:'auto' }}>
              <div style={{ display:'grid', gridTemplateColumns:'52px repeat(7,1fr)', minWidth:700 }}>
                {/* Day headers */}
                <div style={{ background:'var(--card-bg)', borderBottom:'1px solid var(--card-border)', position:'sticky', top:0, zIndex:10 }}/>
                {weekDays.map((d,i)=>{
                  const isToday = d.toDateString()===TODAY.toDateString();
                  return (
                    <div key={i} style={{ textAlign:'center', padding:'8px 4px', background:'var(--card-bg)', borderBottom:'1px solid var(--card-border)', borderLeft:'1px solid var(--card-border)', position:'sticky', top:0, zIndex:10 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase' }}>{DAYS_FR[d.getDay()]}</div>
                      <div style={{ fontSize:15, fontWeight:isToday?700:400, color:isToday?'#fff':'var(--text-primary)', width:26, height:26, borderRadius:'50%', background:isToday?'var(--color-primary)':'transparent', display:'flex', alignItems:'center', justifyContent:'center', margin:'3px auto 0' }}>{d.getDate()}</div>
                    </div>
                  );
                })}

                {/* Hour rows */}
                {HOURS.map(h=>(
                  <>
                    <div key={`h${h}`} style={{ fontSize:10, color:'var(--text-muted)', textAlign:'right', paddingRight:8, paddingTop:4, borderBottom:'1px solid var(--card-border)', minHeight:52, flexShrink:0 }}>{h}:00</div>
                    {weekDays.map((d,di)=>{
                      const dayEvs = events.filter(e=>e.day===d.getDate()&&e.hour===h);
                      const isToday = d.toDateString()===TODAY.toDateString();
                      return (
                        <div key={`c${h}-${di}`} onClick={()=>{ setAddForm(f=>({ ...f, day:d.getDate().toString(), hour:h.toString() })); setShowAdd(true); }}
                          style={{ borderLeft:'1px solid var(--card-border)', borderBottom:'1px solid var(--card-border)', minHeight:52, padding:'2px 3px', background:isToday?`color-mix(in srgb, var(--color-primary) 4%, var(--card-bg))`:'var(--card-bg)', cursor:'pointer', position:'relative' }}>
                          {dayEvs.map(ev=>(
                            <div key={ev.id} onClick={e=>{ e.stopPropagation(); setSelectedEvent(ev); }}
                              style={{ fontSize:10, padding:'3px 6px', borderRadius:5, background:`${ev.color}20`, borderLeft:`3px solid ${ev.color}`, color:ev.color, fontWeight:600, marginBottom:2, cursor:'pointer', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {TYPE_META[ev.type].icon} {ev.title}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── DAY VIEW ── */}
        {view==='day' && (
          <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 16px', borderBottom:'1px solid var(--card-border)', background:'var(--card-bg)', flexShrink:0 }}>
              <button onClick={()=>{ const d=new Date(TODAY); d.setDate(d.getDate()-1); setAddForm(f=>({ ...f,day:d.getDate().toString() })); }}
                style={{ width:28, height:28, borderRadius:7, border:'1px solid var(--card-border)', background:'var(--body-bg)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><ChevronLeft size={13}/></button>
              <span style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>
                {TODAY.toLocaleDateString('fr-FR',{ weekday:'long', day:'numeric', month:'long', year:'numeric' })}
              </span>
              <button style={{ width:28, height:28, borderRadius:7, border:'1px solid var(--card-border)', background:'var(--body-bg)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><ChevronRight size={13}/></button>
            </div>
            <div style={{ flex:1, overflowY:'auto', display:'grid', gridTemplateColumns:'52px 1fr', minWidth:400 }}>
              {HOURS.map(h=>{
                const dayEvs = events.filter(e=>e.day===TODAY.getDate()&&e.hour===h);
                return (
                  <>
                    <div key={`dh${h}`} style={{ fontSize:11, color:'var(--text-muted)', textAlign:'right', paddingRight:10, paddingTop:6, borderBottom:'1px solid var(--card-border)', minHeight:64 }}>{h}:00</div>
                    <div key={`dc${h}`} onClick={()=>{ setAddForm(f=>({ ...f,day:TODAY.getDate().toString(),hour:h.toString() })); setShowAdd(true); }}
                      style={{ borderLeft:'1px solid var(--card-border)', borderBottom:'1px solid var(--card-border)', minHeight:64, padding:'4px 8px', cursor:'pointer' }}>
                      {dayEvs.map(ev=>(
                        <div key={ev.id} onClick={e=>{ e.stopPropagation(); setSelectedEvent(ev); }}
                          style={{ padding:'6px 10px', borderRadius:8, background:`${ev.color}18`, borderLeft:`3px solid ${ev.color}`, marginBottom:4, cursor:'pointer' }}>
                          <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>{TYPE_META[ev.type].icon} {ev.title}</div>
                          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{ev.hour}h — {ev.duration}h · {ev.contact||ev.company}</div>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Event detail modal ── */}
      {selectedEvent && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={()=>setSelectedEvent(null)}>
          <div style={{ background:'var(--card-bg)', borderRadius:20, padding:24, width:'100%', maxWidth:400, boxShadow:'0 20px 60px rgba(0,0,0,.2)' }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                  <span style={{ fontSize:22 }}>{TYPE_META[selectedEvent.type].icon}</span>
                  <span style={{ fontSize:11, padding:'2px 9px', borderRadius:9999, background:`${selectedEvent.color}18`, color:selectedEvent.color, fontWeight:600 }}>{TYPE_META[selectedEvent.type].label}</span>
                </div>
                <h2 style={{ fontSize:17, fontWeight:700, color:'var(--text-primary)', margin:0 }}>{selectedEvent.title}</h2>
              </div>
              <button onClick={()=>setSelectedEvent(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4 }}><X size={18}/></button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:13, color:'var(--text-secondary)' }}>
                <Clock size={14} style={{ color:'var(--text-muted)', flexShrink:0 }}/>
                <span>Jour {selectedEvent.day} à {selectedEvent.hour}h{selectedEvent.duration<1?'30':'00'} — {selectedEvent.duration}h</span>
              </div>
              {selectedEvent.contact && (
                <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:13, color:'var(--text-secondary)' }}>
                  <User size={14} style={{ color:'var(--text-muted)', flexShrink:0 }}/>
                  <span>{selectedEvent.contact}{selectedEvent.company?` — ${selectedEvent.company}`:''}</span>
                </div>
              )}
              {selectedEvent.location && (
                <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:13, color:'var(--text-secondary)' }}>
                  {selectedEvent.location.toLowerCase().includes('visio')?<Video size={14} style={{ color:'var(--text-muted)', flexShrink:0 }}/>:<MapPin size={14} style={{ color:'var(--text-muted)', flexShrink:0 }}/>}
                  <span>{selectedEvent.location}</span>
                </div>
              )}
              {selectedEvent.notes && (
                <div style={{ padding:'10px 12px', borderRadius:10, background:'var(--body-bg)', border:'1px solid var(--card-border)', fontSize:13, color:'var(--text-secondary)', lineHeight:1.6 }}>{selectedEvent.notes}</div>
              )}
            </div>
            <div style={{ display:'flex', gap:8, marginTop:20 }}>
              <button onClick={()=>deleteEvent(selectedEvent.id)} style={{ display:'flex', alignItems:'center', gap:5, padding:'9px 14px', borderRadius:10, border:'1px solid #FCA5A5', background:'#FEF2F2', color:'#DC2626', fontSize:13, cursor:'pointer', fontWeight:500 }}>
                <Trash2 size={13}/>Supprimer
              </button>
              <button onClick={()=>setSelectedEvent(null)} style={{ flex:1, padding:'9px', borderRadius:10, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add event modal ── */}
      {showAdd && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={()=>setShowAdd(false)}>
          <div style={{ background:'var(--card-bg)', borderRadius:20, padding:24, width:'100%', maxWidth:440, boxShadow:'0 20px 60px rgba(0,0,0,.2)', maxHeight:'90vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
              <h2 style={{ fontSize:18, fontWeight:700, color:'var(--text-primary)', margin:0 }}>Nouvel événement</h2>
              <button onClick={()=>setShowAdd(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={18}/></button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {/* Type selector */}
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:6 }}>Type</label>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {Object.entries(TYPE_META).map(([k,v])=>(
                    <button key={k} onClick={()=>setAddForm(f=>({ ...f,type:k as CalEvent['type'] }))}
                      style={{ padding:'5px 12px', borderRadius:8, border:`1px solid ${addForm.type===k?v.color:'var(--card-border)'}`, background:addForm.type===k?`${v.color}18`:'transparent', color:addForm.type===k?v.color:'var(--text-muted)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                      {v.icon} {v.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Fields */}
              {[
                { label:'Titre *',    k:'title',    placeholder:'Ex: Demo TechCorp' },
                { label:'Contact',    k:'contact',  placeholder:'Sophie Martin' },
                { label:'Entreprise', k:'company',  placeholder:'TechCorp' },
                { label:'Lieu',       k:'location', placeholder:'Visio / Adresse' },
                { label:'Notes',      k:'notes',    placeholder:'Notes...' },
              ].map(f=>(
                <div key={f.k}>
                  <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:4 }}>{f.label}</label>
                  <input value={(addForm as any)[f.k]} onChange={e=>setAddForm(fm=>({ ...fm,[f.k]:e.target.value }))} placeholder={f.placeholder}
                    style={{ width:'100%', padding:'8px 12px', borderRadius:9, border:'1px solid var(--card-border)', background:'var(--body-bg)', color:'var(--text-primary)', fontSize:13, outline:'none', boxSizing:'border-box' }}/>
                </div>
              ))}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                {[
                  { label:'Jour', k:'day', placeholder:`${TODAY.getDate()}` },
                  { label:'Heure', k:'hour', placeholder:'10' },
                  { label:'Durée (h)', k:'duration', placeholder:'1' },
                ].map(f=>(
                  <div key={f.k}>
                    <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text-muted)', marginBottom:4 }}>{f.label}</label>
                    <input type="number" value={(addForm as any)[f.k]} onChange={e=>setAddForm(fm=>({ ...fm,[f.k]:e.target.value }))} placeholder={f.placeholder}
                      style={{ width:'100%', padding:'7px 10px', borderRadius:8, border:'1px solid var(--card-border)', background:'var(--body-bg)', color:'var(--text-primary)', fontSize:13, outline:'none', boxSizing:'border-box' }}/>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:18 }}>
              <button onClick={()=>setShowAdd(false)} style={{ flex:1, padding:'10px', borderRadius:10, border:'1px solid var(--card-border)', background:'transparent', color:'var(--text-secondary)', fontSize:13, cursor:'pointer' }}>Annuler</button>
              <button onClick={addEvent} style={{ flex:2, padding:'10px', borderRadius:10, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>Créer l'événement</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
