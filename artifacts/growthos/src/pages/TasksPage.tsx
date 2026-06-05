import { useState, useEffect } from 'react';
import { Plus, CheckCircle2, Circle, Clock, Trash2, Edit2, X, Loader2, Calendar, Flag, Link2, CheckSquare } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

interface Task {
  id: string; title: string; description?: string; status: string;
  priority: string; dueDate?: string; completedAt?: string;
  entityType?: string; entityId?: string; createdAt: string;
}

const PRIORITY_CFG: Record<string, { label: string; color: string; bg: string }> = {
  high:   { label: 'Haute',   color: '#DC2626', bg: '#FEF2F2' },
  medium: { label: 'Moyenne', color: '#D97706', bg: '#FFFBEB' },
  low:    { label: 'Basse',   color: '#6B7280', bg: '#F3F4F6' },
};

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  todo:        { label: 'À faire',      color: '#6B7280' },
  in_progress: { label: 'En cours',     color: '#3B82F6' },
  done:        { label: 'Terminée',     color: '#10B981' },
  cancelled:   { label: 'Annulée',      color: '#EF4444' },
};

function TaskModal({ task, onClose, onSaved }: { task?: Task; onClose: () => void; onSaved: (t: Task) => void }) {
  const [form, setForm] = useState({
    title: task?.title ?? '',
    description: task?.description ?? '',
    priority: task?.priority ?? 'medium',
    status: task?.status ?? 'todo',
    dueDate: task?.dueDate ? task.dueDate.split('T')[0] : '',
    entityType: task?.entityType ?? '',
    entityId: task?.entityId ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title.trim()) { toast.error('Titre requis'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        dueDate: form.dueDate || null,
        entityType: form.entityType || null,
        entityId: form.entityId || null,
      };
      let saved: Task;
      if (task) {
        saved = await apiClient.patch(`/tasks/${task.id}`, payload) as Task;
      } else {
        saved = await apiClient.post('/tasks', payload) as Task;
      }
      toast.success(task ? 'Tâche modifiée' : 'Tâche créée');
      onSaved(saved);
      onClose();
    } catch { toast.error('Erreur'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{task ? 'Modifier la tâche' : 'Nouvelle tâche'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Titre *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="Description de la tâche…"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--card-border)', borderRadius: 10, fontSize: 13, background: 'var(--body-bg)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--card-border)', borderRadius: 10, fontSize: 13, background: 'var(--body-bg)', color: 'var(--text-primary)', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Priorité</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--card-border)', borderRadius: 10, fontSize: 13, background: 'var(--body-bg)', color: 'var(--text-primary)', outline: 'none' }}>
                <option value="high">🔴 Haute</option>
                <option value="medium">🟡 Moyenne</option>
                <option value="low">⚪ Basse</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Statut</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--card-border)', borderRadius: 10, fontSize: 13, background: 'var(--body-bg)', color: 'var(--text-primary)', outline: 'none' }}>
                <option value="todo">À faire</option>
                <option value="in_progress">En cours</option>
                <option value="done">Terminée</option>
                <option value="cancelled">Annulée</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Échéance</label>
            <input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--card-border)', borderRadius: 10, fontSize: 13, background: 'var(--body-bg)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '9px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
              Annuler
            </button>
            <button onClick={save} disabled={saving}
              style={{ flex: 2, padding: '9px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {task ? 'Mettre à jour' : 'Créer la tâche'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Task | undefined>();
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get('/tasks') as Task[];
      setTasks(Array.isArray(data) ? data : []);
    } catch { toast.error('Impossible de charger les tâches'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const complete = async (task: Task) => {
    try {
      const updated = await apiClient.post(`/tasks/${task.id}/complete`, {}) as Task;
      setTasks(ts => ts.map(t => t.id === task.id ? updated : t));
      toast.success('Tâche terminée ✓');
    } catch { toast.error('Erreur'); }
  };

  const remove = async (id: string) => {
    await apiClient.delete(`/tasks/${id}`).catch(() => {});
    setTasks(ts => ts.filter(t => t.id !== id));
    toast.success('Tâche supprimée');
  };

  const onSaved = (t: Task) => {
    setTasks(ts => {
      const idx = ts.findIndex(x => x.id === t.id);
      if (idx >= 0) { const n = [...ts]; n[idx] = t; return n; }
      return [t, ...ts];
    });
  };

  const filtered = tasks.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    return true;
  });

  const counts = {
    todo: tasks.filter(t => t.status === 'todo').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    done: tasks.filter(t => t.status === 'done').length,
    overdue: tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled' && t.dueDate && new Date(t.dueDate) < new Date()).length,
  };

  return (
    <div style={{ minHeight: '100vh', padding: '20px 24px', background: 'var(--body-bg)' }}>
      {showModal && <TaskModal onClose={() => setShowModal(false)} onSaved={onSaved} />}
      {editing && <TaskModal task={editing} onClose={() => setEditing(undefined)} onSaved={onSaved} />}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px' }}>Mes Tâches</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>{counts.todo} à faire · {counts.in_progress} en cours · {counts.done} terminées{counts.overdue > 0 ? ` · ${counts.overdue} en retard` : ''}</p>
        </div>
        <button onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 11, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          <Plus size={14} />Nouvelle tâche
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
        {[
          { l: 'À faire',    v: counts.todo,        c: '#6B7280', bg: '#F3F4F6' },
          { l: 'En cours',   v: counts.in_progress, c: '#3B82F6', bg: '#EFF6FF' },
          { l: 'Terminées',  v: counts.done,        c: '#10B981', bg: '#ECFDF5' },
          { l: 'En retard',  v: counts.overdue,     c: '#DC2626', bg: '#FEF2F2' },
        ].map((m, i) => (
          <div key={i} style={{ borderRadius: 14, border: '1px solid var(--card-border)', background: 'var(--card-bg)', padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: m.c }}>{m.v}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{m.l}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {['all', 'todo', 'in_progress', 'done', 'cancelled'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{ padding: '5px 11px', borderRadius: 9, border: `1px solid ${statusFilter === s ? 'transparent' : 'var(--card-border)'}`, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: statusFilter === s ? 'var(--color-primary)' : 'var(--card-bg)', color: statusFilter === s ? '#fff' : 'var(--text-muted)' }}>
              {s === 'all' ? 'Tous' : STATUS_CFG[s]?.label ?? s}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['all', 'high', 'medium', 'low'].map(p => (
            <button key={p} onClick={() => setPriorityFilter(p)}
              style={{ padding: '5px 11px', borderRadius: 9, border: `1px solid ${priorityFilter === p ? 'transparent' : 'var(--card-border)'}`, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: priorityFilter === p ? 'var(--color-primary)' : 'var(--card-bg)', color: priorityFilter === p ? '#fff' : 'var(--text-muted)' }}>
              {p === 'all' ? 'Toutes priorités' : PRIORITY_CFG[p]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Task list */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <CheckSquare size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Aucune tâche. Créez-en une pour commencer.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(task => {
            const prio = PRIORITY_CFG[task.priority];
            const stat = STATUS_CFG[task.status];
            const isOverdue = task.status !== 'done' && task.status !== 'cancelled' && task.dueDate && new Date(task.dueDate) < new Date();
            const isDone = task.status === 'done';
            const daysLeft = task.dueDate ? Math.ceil((new Date(task.dueDate).getTime() - Date.now()) / 86400000) : null;

            return (
              <div key={task.id}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${isOverdue ? '#FCA5A5' : 'var(--card-border)'}`, background: isDone ? 'var(--body-bg)' : 'var(--card-bg)', opacity: isDone ? 0.65 : 1, transition: 'all .15s' }}>

                {/* Complete button */}
                <button onClick={() => !isDone && complete(task)} title={isDone ? 'Terminée' : 'Marquer terminée'}
                  style={{ background: 'none', border: 'none', cursor: isDone ? 'default' : 'pointer', color: isDone ? '#10B981' : 'var(--text-muted)', flexShrink: 0, display: 'flex' }}>
                  {isDone ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                </button>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)', textDecoration: isDone ? 'line-through' : 'none' }}>{task.title}</span>
                    <span style={{ padding: '1px 8px', borderRadius: 9999, fontSize: 10, fontWeight: 700, background: prio.bg, color: prio.color }}>
                      <Flag size={8} style={{ display: 'inline', marginRight: 3 }} />{prio.label}
                    </span>
                    <span style={{ padding: '1px 8px', borderRadius: 9999, fontSize: 10, fontWeight: 700, background: `${stat.color}18`, color: stat.color }}>{stat.label}</span>
                  </div>
                  {task.description && (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.description}</p>
                  )}
                </div>

                {/* Due date */}
                {daysLeft !== null && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: isOverdue ? '#DC2626' : daysLeft <= 2 ? '#D97706' : 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Clock size={11} />
                    {isOverdue ? 'En retard' : daysLeft === 0 ? "Auj." : `J-${daysLeft}`}
                  </span>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => setEditing(task)} title="Modifier"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', borderRadius: 6 }}>
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => remove(task.id)} title="Supprimer"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 4, display: 'flex', borderRadius: 6 }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
