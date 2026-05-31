import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Plus, DollarSign, TrendingUp, Trophy, Search, Filter, X } from 'lucide-react';
import apiClient from '@/lib/api-client';

const STAGES = [
  { id: 'lead',        label: 'Lead',        color: '#6B7280' },
  { id: 'qualified',   label: 'Qualifié',    color: '#3B82F6' },
  { id: 'proposal',    label: 'Proposition', color: '#8B5CF6' },
  { id: 'negotiation', label: 'Négociation', color: '#F59E0B' },
  { id: 'won',         label: 'Gagné',       color: '#10B981' },
  { id: 'lost',        label: 'Perdu',       color: '#EF4444' },
];

const MOCK_DEALS = [
  { id: '1', title: 'Contrat SaaS — TechCorp',       company: 'TechCorp',     value: 12500, stage: 'qualified',   probability: 60,  closeDate: '2026-06-15', prospect: 'Sophie Martin' },
  { id: '2', title: 'Abonnement Pro — StartupX',     company: 'StartupX',    value: 4800,  stage: 'proposal',    probability: 40,  closeDate: '2026-06-30', prospect: 'Emma Leroy' },
  { id: '3', title: 'Formation équipe — BigSales',   company: 'BigSales SAS', value: 8200,  stage: 'negotiation', probability: 75,  closeDate: '2026-06-20', prospect: 'Paul Dupont' },
  { id: '4', title: 'Intégration CRM — DataInc',     company: 'DataInc',     value: 3600,  stage: 'lead',        probability: 20,  closeDate: '2026-07-15', prospect: 'Camille Bernard' },
  { id: '5', title: 'Renouvellement — GrowthCo',     company: 'GrowthCo',    value: 9600,  stage: 'won',         probability: 100, closeDate: '2026-05-30', prospect: 'Luc Moreau' },
  { id: '6', title: 'Licence Enterprise — AlphaTech',company: 'AlphaTech',   value: 22000, stage: 'proposal',    probability: 55,  closeDate: '2026-07-01', prospect: 'Marie Dubois' },
  { id: '7', title: 'Audit SEO — WebAgency',         company: 'WebAgency',   value: 5500,  stage: 'lead',        probability: 30,  closeDate: '2026-07-20', prospect: 'Thomas Leclerc' },
];

interface Deal {
  id: string; title: string; company: string; value: number;
  stage: string; probability: number; closeDate: string; prospect: string;
}

function NewDealModal({ onClose, onSave }: { onClose: () => void; onSave: (d: Partial<Deal>) => void }) {
  const [form, setForm] = useState({ title: '', company: '', value: '', stage: 'lead', probability: '20', closeDate: '', prospect: '' });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const save = () => {
    if (!form.title || !form.company) return;
    onSave({ ...form, value: Number(form.value) || 0, probability: Number(form.probability) || 20, id: Date.now().toString() });
    onClose();
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Nouveau deal</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>
        {[
          { label: 'Titre du deal *', k: 'title', placeholder: 'Ex: Contrat SaaS — Acme' },
          { label: 'Entreprise *', k: 'company', placeholder: 'Acme SAS' },
          { label: 'Prospect', k: 'prospect', placeholder: 'Jean Dupont' },
          { label: 'Valeur (€)', k: 'value', placeholder: '10000' },
          { label: 'Probabilité (%)', k: 'probability', placeholder: '50' },
          { label: 'Date de closing', k: 'closeDate', placeholder: 'AAAA-MM-JJ' },
        ].map(f => (
          <div key={f.k} style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>{f.label}</label>
            <input value={(form as any)[f.k]} onChange={e => set(f.k, e.target.value)} placeholder={f.placeholder}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--card-border)', borderRadius: 10, fontSize: 14, background: 'var(--body-bg)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        ))}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Étape</label>
          <select value={form.stage} onChange={e => set('stage', e.target.value)}
            style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--card-border)', borderRadius: 10, fontSize: 14, background: 'var(--body-bg)', color: 'var(--text-primary)', outline: 'none' }}>
            {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer' }}>Annuler</button>
          <button onClick={save} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Créer le deal</button>
        </div>
      </div>
    </div>
  );
}

function KanbanCard({ deal, stage, onDragStart, onClick }: { deal: Deal; stage: typeof STAGES[0]; onDragStart: (e: React.DragEvent, id: string) => void; onClick: () => void }) {
  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, deal.id)}
      onClick={onClick}
      style={{ padding: 12, borderRadius: 12, background: 'var(--card-bg)', border: '1px solid var(--card-border)', cursor: 'grab', transition: 'all 0.15s', userSelect: 'none' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,.1)'; (e.currentTarget as HTMLElement).style.borderColor = stage.color; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--card-border)'; }}
    >
      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 3, lineHeight: 1.3 }}>{deal.title}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>{deal.company}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-primary)' }}>{deal.value.toLocaleString()}€</span>
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 9999, background: `${stage.color}18`, color: stage.color, fontWeight: 600 }}>{deal.probability}%</span>
      </div>
      {deal.closeDate && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>📅 {deal.closeDate}</div>
      )}
    </div>
  );
}

export default function PipelinePage() {
  const [, navigate] = useLocation();
  const [deals, setDeals] = useState<Deal[]>(MOCK_DEALS);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const draggingId = useRef<string | null>(null);

  useEffect(() => {
    apiClient.get('/pipeline').then((d: any) => {
      const l = Array.isArray(d) ? d : d?.data || [];
      if (l.length > 0) setDeals(l);
    }).catch(() => {});
  }, []);

  const filtered = deals.filter(d => {
    const q = search.toLowerCase();
    return !q || `${d.title} ${d.company} ${d.prospect}`.toLowerCase().includes(q);
  });

  const totalPipeline = deals.filter(d => d.stage !== 'won' && d.stage !== 'lost').reduce((s, d) => s + d.value, 0);
  const totalWon = deals.filter(d => d.stage === 'won').reduce((s, d) => s + d.value, 0);
  const weighted = deals.filter(d => d.stage !== 'won' && d.stage !== 'lost').reduce((s, d) => s + (d.value * d.probability / 100), 0);

  const onDragStart = (e: React.DragEvent, id: string) => { draggingId.current = id; e.dataTransfer.effectAllowed = 'move'; };
  const onDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    const id = draggingId.current;
    if (!id) return;
    setDeals(ds => ds.map(d => d.id === id ? { ...d, stage: stageId } : d));
    apiClient.patch(`/pipeline/${id}`, { stage: stageId }).catch(() => {});
    draggingId.current = null;
    setDragOver(null);
  };

  const addDeal = (d: Partial<Deal>) => setDeals(ds => [...ds, d as Deal]);

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: 'var(--body-bg)' }}>
      {showModal && <NewDealModal onClose={() => setShowModal(false)} onSave={addDeal} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Pipeline Commercial</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{deals.filter(d => d.stage !== 'won' && d.stage !== 'lost').length} deals actifs</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
            {(['kanban', 'list'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={view === v ? { background: 'var(--color-primary)', color: '#fff' } : { color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                {v === 'kanban' ? '📋 Kanban' : '📄 Liste'}
              </button>
            ))}
          </div>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'var(--color-primary)', border: 'none', cursor: 'pointer' }}>
            <Plus size={14} />Nouveau deal
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { l: 'Pipeline total', v: `${(totalPipeline / 1000).toFixed(0)}k€`, icon: <DollarSign size={18} />, color: 'text-blue-600 bg-blue-50' },
          { l: 'CA Gagné', v: `${(totalWon / 1000).toFixed(0)}k€`, icon: <Trophy size={18} />, color: 'text-green-600 bg-green-50' },
          { l: 'Pondéré', v: `${(weighted / 1000).toFixed(0)}k€`, icon: <TrendingUp size={18} />, color: 'text-purple-600 bg-purple-50' },
        ].map((m, i) => (
          <div key={i} className="rounded-2xl border p-3 sm:p-5 flex items-center gap-3" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${m.color}`}>{m.icon}</div>
            <div>
              <div className="text-lg sm:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{m.v}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.l}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un deal, entreprise..." style={{ width: '100%', paddingLeft: 36, paddingRight: 12, paddingTop: 9, paddingBottom: 9, borderRadius: 12, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {/* KANBAN */}
      {view === 'kanban' ? (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16 }}>
          {STAGES.map(stage => {
            const stageDeals = filtered.filter(d => d.stage === stage.id);
            const total = stageDeals.reduce((s, d) => s + d.value, 0);
            const isOver = dragOver === stage.id;
            return (
              <div key={stage.id} style={{ minWidth: 200, flex: '0 0 200px', display: 'flex', flexDirection: 'column', gap: 8 }}
                onDragOver={e => { e.preventDefault(); setDragOver(stage.id); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => onDrop(e, stage.id)}>
                {/* Column header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 10, background: isOver ? `${stage.color}18` : 'var(--card-bg)', border: `1px solid ${isOver ? stage.color : 'var(--card-border)'}`, transition: 'all 0.15s', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: stage.color }}>{stage.label}</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{stageDeals.length} · {(total / 1000).toFixed(0)}k€</span>
                </div>
                {/* Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 80 }}>
                  {stageDeals.map(deal => (
                    <KanbanCard key={deal.id} deal={deal} stage={stage} onDragStart={onDragStart} onClick={() => navigate(`/pipeline/${deal.id}`)} />
                  ))}
                  {isOver && <div style={{ height: 60, borderRadius: 12, border: `2px dashed ${stage.color}`, opacity: 0.5 }} />}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: 12, padding: '8px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            <span>Deal</span><span>Étape</span><span>Valeur</span><span>Proba</span><span>Closing</span>
          </div>
          {filtered.map(deal => {
            const stage = STAGES.find(s => s.id === deal.stage) || STAGES[0];
            return (
              <div key={deal.id} onClick={() => navigate(`/pipeline/${deal.id}`)}
                style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: 12, alignItems: 'center', padding: '14px 16px', borderRadius: 14, background: 'var(--card-bg)', border: '1px solid var(--card-border)', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,.08)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{deal.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{deal.company} · {deal.prospect}</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 9999, color: stage.color, background: `${stage.color}18`, whiteSpace: 'nowrap' }}>{stage.label}</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>{deal.value.toLocaleString()}€</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{deal.probability}%</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{deal.closeDate}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
