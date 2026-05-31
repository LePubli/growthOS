import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Clock, User, MapPin, Video, X, Calendar as CalIcon } from 'lucide-react';

interface Event {
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
  call:    { label: 'Appel',   color: '#059669', bg: '#ECFDF5', icon: '📞' },
  meeting: { label: 'Réunion', color: '#2563EB', bg: '#EFF6FF', icon: '🤝' },
  demo:    { label: 'Demo',    color: '#7C3AED', bg: '#EDE9FE', icon: '💻' },
  task:    { label: 'Tâche',   color: '#D97706', bg: '#FEF3C7', icon: '✅' },
};

const TODAY = new Date();
const YEAR = TODAY.getFullYear();
const MONTH = TODAY.getMonth();

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const MOCK_EVENTS: Event[] = [
  { id: '1', title: 'Demo GrowthOS', type: 'demo', day: TODAY.getDate(), hour: 10, duration: 1, contact: 'Sophie Martin', company: 'TechCorp', location: 'Visio', color: '#7C3AED' },
  { id: '2', title: 'Suivi proposition', type: 'call', day: TODAY.getDate(), hour: 14, duration: 0.5, contact: 'Paul Dupont', company: 'BigSales SAS', notes: 'Relancer sur le tarif', color: '#059669' },
  { id: '3', title: 'Négociation contrat', type: 'meeting', day: TODAY.getDate() + 1, hour: 9, duration: 2, contact: 'Marie Dubois', company: 'AlphaTech', location: '12 rue de Rivoli, Paris', color: '#2563EB' },
  { id: '4', title: 'Demo plateforme', type: 'demo', day: TODAY.getDate() + 2, hour: 11, duration: 1, contact: 'Emma Leroy', company: 'StartupX', location: 'Visio', color: '#7C3AED' },
  { id: '5', title: 'Appel découverte', type: 'call', day: TODAY.getDate() + 3, hour: 16, duration: 0.5, contact: 'Luc Moreau', company: 'GrowthCo', color: '#059669' },
  { id: '6', title: 'Préparer proposition', type: 'task', day: TODAY.getDate() + 1, hour: 8, duration: 1, contact: '', company: 'DataInc', notes: 'Rédiger offre personnalisée', color: '#D97706' },
];

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const DAYS_FR = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 7);

export default function CalendarPage() {
  const [currentYear, setCurrentYear] = useState(YEAR);
  const [currentMonth, setCurrentMonth] = useState(MONTH);
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [events, setEvents] = useState<Event[]>(MOCK_EVENTS);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [addForm, setAddForm] = useState({ title: '', type: 'call' as Event['type'], day: TODAY.getDate().toString(), hour: '10', duration: '1', contact: '', company: '', location: '', notes: '' });

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const prevMonth = () => { if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); } else setCurrentMonth(m => m - 1); };
  const nextMonth = () => { if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); } else setCurrentMonth(m => m + 1); };

  const eventsForDay = (d: number) => events.filter(e => e.day === d);
  const todayEvents = events.filter(e => e.day === TODAY.getDate() && e.hour !== undefined).sort((a, b) => a.hour - b.hour);

  const addEvent = () => {
    const meta = TYPE_META[addForm.type];
    const newEv: Event = {
      id: Date.now().toString(),
      title: addForm.title || 'Événement sans titre',
      type: addForm.type,
      day: parseInt(addForm.day) || TODAY.getDate(),
      hour: parseInt(addForm.hour) || 10,
      duration: parseFloat(addForm.duration) || 1,
      contact: addForm.contact,
      company: addForm.company,
      location: addForm.location,
      notes: addForm.notes,
      color: meta.color,
    };
    setEvents(ev => [...ev, newEv]);
    setShowAddModal(false);
    setAddForm({ title: '', type: 'call', day: TODAY.getDate().toString(), hour: '10', duration: '1', contact: '', company: '', location: '', notes: '' });
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--body-bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid var(--card-border)', background: 'var(--card-bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={prevMonth} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}><ChevronLeft size={14} /></button>
            <button onClick={nextMonth} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}><ChevronRight size={14} /></button>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{MONTHS_FR[currentMonth]} {currentYear}</h1>
          <button onClick={() => { setCurrentMonth(MONTH); setCurrentYear(YEAR); }} style={{ fontSize: 12, color: 'var(--color-primary)', background: `var(--color-primary)15`, border: '1px solid var(--color-primary)30', borderRadius: 7, padding: '3px 10px', cursor: 'pointer', fontWeight: 600 }}>Aujourd'hui</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 2, padding: '3px', borderRadius: 10, background: 'var(--body-bg)', border: '1px solid var(--card-border)' }}>
            {(['month', 'week', 'day'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{ padding: '5px 12px', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer', background: view === v ? 'var(--color-primary)' : 'transparent', color: view === v ? '#fff' : 'var(--text-muted)' }}>
                {v === 'month' ? 'Mois' : v === 'week' ? 'Semaine' : 'Jour'}
              </button>
            ))}
          </div>
          <button onClick={() => setShowAddModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={14} />Nouveau
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Calendar grid */}
        <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {DAYS_FR.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', padding: '6px 0' }}>{d}</div>
            ))}
          </div>
          {/* Day cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {/* Empty cells for first day */}
            {Array.from({ length: firstDay }, (_, i) => (
              <div key={`e${i}`} style={{ minHeight: 90, borderRadius: 8, background: 'var(--card-bg)', opacity: 0.3, border: '1px solid var(--card-border)' }} />
            ))}
            {/* Day cells */}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const isToday = day === TODAY.getDate() && currentMonth === MONTH && currentYear === YEAR;
              const dayEvs = eventsForDay(day);
              const isSelected = selectedDay === day;
              return (
                <div key={day} onClick={() => setSelectedDay(isSelected ? null : day)}
                  style={{ minHeight: 90, borderRadius: 8, background: isSelected ? `color-mix(in srgb, var(--color-primary) 8%, var(--card-bg))` : 'var(--card-bg)', border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--card-border)'}`, padding: '6px', cursor: 'pointer', transition: 'all 0.1s', overflow: 'hidden' }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--body-bg)'; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--card-bg)'; }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 400, color: isToday ? '#fff' : 'var(--text-primary)', width: 24, height: 24, borderRadius: '50%', background: isToday ? 'var(--color-primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{day}</span>
                    {dayEvs.length > 0 && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{dayEvs.length}</span>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {dayEvs.slice(0, 3).map(ev => (
                      <div key={ev.id} onClick={e => { e.stopPropagation(); setSelectedEvent(ev); }}
                        style={{ fontSize: 11, padding: '2px 6px', borderRadius: 5, background: `${ev.color}18`, color: ev.color, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}>
                        {TYPE_META[ev.type].icon} {ev.title}
                      </div>
                    ))}
                    {dayEvs.length > 3 && <div style={{ fontSize: 10, color: 'var(--text-muted)', paddingLeft: 4 }}>+{dayEvs.length - 3} autres</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right sidebar — today's schedule */}
        <div style={{ width: 260, borderLeft: '1px solid var(--card-border)', background: 'var(--card-bg)', padding: '16px 14px', overflowY: 'auto', flexShrink: 0 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Aujourd'hui</h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>{TODAY.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          {todayEvents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              <CalIcon size={28} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
              Aucun événement aujourd'hui
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {todayEvents.map(ev => {
                const meta = TYPE_META[ev.type];
                return (
                  <div key={ev.id} onClick={() => setSelectedEvent(ev)}
                    style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${ev.color}40`, background: `${ev.color}0d`, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 14 }}>{meta.icon}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>{ev.title}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={10} />{ev.hour}h{ev.duration < 1 ? '30' : '00'}</span>
                      {ev.contact && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><User size={10} />{ev.contact}</span>}
                    </div>
                    {ev.location && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={10} />{ev.location}</div>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--card-border)' }}>
            <h4 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Types</h4>
            {Object.entries(TYPE_META).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: v.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v.icon} {v.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Event detail modal */}
      {selectedEvent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setSelectedEvent(null)}>
          <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 22 }}>{TYPE_META[selectedEvent.type].icon}</span>
                  <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 9999, background: `${selectedEvent.color}18`, color: selectedEvent.color, fontWeight: 600 }}>{TYPE_META[selectedEvent.type].label}</span>
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{selectedEvent.title}</h2>
              </div>
              <button onClick={() => setSelectedEvent(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
                <Clock size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span>Jour {selectedEvent.day} à {selectedEvent.hour}h — {selectedEvent.duration}h</span>
              </div>
              {selectedEvent.contact && <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-secondary)' }}><User size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /><span>{selectedEvent.contact} — {selectedEvent.company}</span></div>}
              {selectedEvent.location && <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-secondary)' }}><MapPin size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /><span>{selectedEvent.location}</span></div>}
              {selectedEvent.notes && <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--body-bg)', border: '1px solid var(--card-border)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{selectedEvent.notes}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button onClick={() => { setEvents(ev => ev.filter(e => e.id !== selectedEvent.id)); setSelectedEvent(null); }}
                style={{ flex: 1, padding: '9px', borderRadius: 10, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>Supprimer</button>
              <button onClick={() => setSelectedEvent(null)}
                style={{ flex: 2, padding: '9px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* Add event modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setShowAddModal(false)}>
          <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Nouvel événement</h2>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>Type</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Object.entries(TYPE_META).map(([k, v]) => (
                    <button key={k} onClick={() => setAddForm(f => ({ ...f, type: k as Event['type'] }))}
                      style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${addForm.type === k ? v.color : 'var(--card-border)'}`, background: addForm.type === k ? `${v.color}18` : 'transparent', color: addForm.type === k ? v.color : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {v.icon} {v.label}
                    </button>
                  ))}
                </div>
              </div>
              {[
                { label: 'Titre *', k: 'title', placeholder: 'Ex: Demo TechCorp' },
                { label: 'Contact', k: 'contact', placeholder: 'Sophie Martin' },
                { label: 'Entreprise', k: 'company', placeholder: 'TechCorp' },
                { label: 'Lieu', k: 'location', placeholder: 'Visio / Adresse' },
                { label: 'Notes', k: 'notes', placeholder: 'Notes...' },
              ].map(f => (
                <div key={f.k}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>{f.label}</label>
                  <input value={(addForm as any)[f.k]} onChange={e => setAddForm(fm => ({ ...fm, [f.k]: e.target.value }))} placeholder={f.placeholder}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Jour', k: 'day', placeholder: `${TODAY.getDate()}` },
                  { label: 'Heure', k: 'hour', placeholder: '10' },
                  { label: 'Durée (h)', k: 'duration', placeholder: '1' },
                ].map(f => (
                  <div key={f.k}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>{f.label}</label>
                    <input type="number" value={(addForm as any)[f.k]} onChange={e => setAddForm(fm => ({ ...fm, [f.k]: e.target.value }))} placeholder={f.placeholder}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowAddModal(false)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>Annuler</button>
              <button onClick={addEvent} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Créer l'événement</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
