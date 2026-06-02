import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Brain, Search, Plus, Trash2, X, FileText, User, Building2, Mail, Zap, Clock, Loader2, AlertCircle, BookOpen } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

/* ─── Types ───────────────────────────────────────────────────── */
interface MemoryDocument {
  id: string;
  sourceType: string;
  sourceId: string;
  content: string;
  tenantId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  score?: number;
}

interface SearchResponse {
  results: MemoryDocument[];
  total: number;
  query: string;
}

interface StatsResponse {
  total: number;
  bySourceType: Record<string, number>;
}

/* ─── Source type config ───────────────────────────────────────── */
const SOURCE_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string; bg: string }> = {
  prospect:  { icon: <User size={11} />,      label: 'Prospect',  color: '#2563EB', bg: '#EFF6FF' },
  account:   { icon: <Building2 size={11} />, label: 'Compte',    color: '#7C3AED', bg: '#F5F3FF' },
  deal:      { icon: <Zap size={11} />,       label: 'Deal',      color: '#059669', bg: '#ECFDF5' },
  email:     { icon: <Mail size={11} />,      label: 'Email',     color: '#D97706', bg: '#FFFBEB' },
  note:      { icon: <FileText size={11} />,  label: 'Note',      color: '#6B7280', bg: '#F3F4F6' },
  activity:  { icon: <Clock size={11} />,     label: 'Activité',  color: '#0891B2', bg: '#ECFEFF' },
};

function getSource(type: string) {
  return SOURCE_CONFIG[type] ?? { icon: <BookOpen size={11} />, label: type, color: '#6B7280', bg: '#F3F4F6' };
}

/* ─── Source badge ─────────────────────────────────────────────── */
function SourceBadge({ type }: { type: string }) {
  const cfg = getSource(type);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 8px', borderRadius: 9999, background: cfg.bg, color: cfg.color, fontWeight: 600, border: `1px solid ${cfg.color}22` }}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

/* ─── Index document modal ─────────────────────────────────────── */
function IndexModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ sourceType: 'note', sourceId: '', content: '' });

  const indexMutation = useMutation({
    mutationFn: (data: typeof form) => apiClient.post('/memory/index', data),
    onSuccess: () => {
      toast.success('Document indexé dans la mémoire');
      qc.invalidateQueries({ queryKey: ['memory'] });
      onClose();
    },
    onError: () => toast.error("Échec de l'indexation"),
  });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'relative', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: 28, width: 520, maxWidth: '95vw', boxShadow: '0 24px 64px rgba(0,0,0,.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#6D28D9,#4F46E5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Brain size={18} color="#fff" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>Indexer un document</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Type de source</label>
            <select value={form.sourceType} onChange={e => setForm(f => ({ ...f, sourceType: e.target.value }))}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 13 }}>
              {Object.entries(SOURCE_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
              <option value="note">Note</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Identifiant source</label>
            <input value={form.sourceId} onChange={e => setForm(f => ({ ...f, sourceId: e.target.value }))}
              placeholder="ex: prospect-123, deal-456…"
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Contenu à mémoriser</label>
            <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              rows={5} placeholder="Coller ici le texte à indexer…"
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
            <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>Annuler</button>
            <button
              disabled={!form.sourceId.trim() || !form.content.trim() || indexMutation.isPending}
              onClick={() => indexMutation.mutate(form)}
              style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#6D28D9,#4F46E5)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: (!form.sourceId.trim() || !form.content.trim()) ? 0.5 : 1 }}>
              {indexMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Brain size={13} />}
              Indexer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Result card ──────────────────────────────────────────────── */
function ResultCard({ doc, query, onDelete }: { doc: MemoryDocument; query: string; onDelete: (id: string) => void }) {
  const snippet = doc.content.length > 220 ? doc.content.slice(0, 220) + '…' : doc.content;

  const highlight = (text: string) => {
    if (!query.trim()) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ background: '#FEF08A', color: 'inherit', borderRadius: 2, padding: '0 2px' }}>{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '14px 16px', transition: 'border-color 0.15s' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <SourceBadge type={doc.sourceType} />
          <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{doc.sourceId}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={10} />{fmt(doc.updatedAt || doc.createdAt)}
          </span>
          <button onClick={() => onDelete(doc.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', opacity: 0.6 }}
            title="Supprimer">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
        {highlight(snippet)}
      </p>
    </div>
  );
}

/* ─── Main page ────────────────────────────────────────────────── */
export default function MemoryPage() {
  const [query, setQuery] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [showModal, setShowModal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQueryChange = (v: string) => {
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQ(v), 300);
  };

  const { data, isLoading, isError } = useQuery<SearchResponse>({
    queryKey: ['memory', 'search', debouncedQ],
    queryFn: () => apiClient.get('/memory/search', { q: debouncedQ, limit: 30 }),
    placeholderData: (prev) => prev,
  });

  const { data: stats } = useQuery<StatsResponse>({
    queryKey: ['memory', 'stats'],
    queryFn: () => apiClient.get('/memory/stats'),
    refetchInterval: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/memory/${id}`),
    onSuccess: () => {
      toast.success('Document supprimé');
      qc.invalidateQueries({ queryKey: ['memory'] });
    },
    onError: () => toast.error('Échec de la suppression'),
  });

  const results = data?.results ?? [];
  const hasQuery = debouncedQ.trim().length > 0;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 860, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#6D28D9,#4F46E5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 14px rgba(109,40,217,.3)' }}>
            <Brain size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>Growth Memory</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '2px 0 0' }}>Second Brain — indexation et recherche sémantique</p>
          </div>
        </div>
        <button onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6D28D9,#4F46E5)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(109,40,217,.25)' }}>
          <Plus size={14} /> Indexer
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10, marginBottom: 20 }}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '12px 16px' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#6D28D9' }}>{stats.total}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Documents</div>
          </div>
          {Object.entries(stats.bySourceType).map(([type, count]) => {
            const cfg = getSource(type);
            return (
              <div key={type} style={{ background: cfg.bg, border: `1px solid ${cfg.color}22`, borderRadius: 12, padding: '12px 16px' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: cfg.color }}>{count}</div>
                <div style={{ fontSize: 12, color: cfg.color, opacity: 0.8, marginTop: 2 }}>{cfg.label}s</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Search bar */}
      <div style={{ position: 'relative', marginBottom: 20 }}>
        <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input
          ref={inputRef}
          value={query}
          onChange={e => handleQueryChange(e.target.value)}
          placeholder="Rechercher dans la mémoire… (⌘K pour focus)"
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '13px 40px 13px 42px',
            borderRadius: 12, border: '2px solid var(--card-border)',
            background: 'var(--card-bg)', color: 'var(--text-primary)',
            fontSize: 14, fontFamily: 'inherit',
            outline: 'none', transition: 'border-color 0.15s',
          }}
          onFocus={e => (e.target.style.borderColor = '#6D28D9')}
          onBlur={e => (e.target.style.borderColor = 'var(--card-border)')}
        />
        {query && (
          <button onClick={() => { setQuery(''); setDebouncedQ(''); inputRef.current?.focus(); }}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* Results label */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
          {isLoading ? 'Recherche…' : hasQuery ? `${results.length} résultat${results.length !== 1 ? 's' : ''} pour « ${debouncedQ} »` : `${results.length} document${results.length !== 1 ? 's' : ''} récent${results.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '60px 0', color: 'var(--text-muted)' }}>
          <Loader2 size={20} className="animate-spin" />
          <span style={{ fontSize: 14 }}>Recherche dans la mémoire…</span>
        </div>
      )}

      {/* Error */}
      {isError && !isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '60px 0' }}>
          <AlertCircle size={32} color="#DC2626" />
          <p style={{ fontSize: 14, color: '#DC2626', fontWeight: 600, margin: 0 }}>Mémoire inaccessible</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Vérifiez que le plugin Growth Memory est actif.</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && results.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: 'linear-gradient(135deg,#EDE9FE,#DDD6FE)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Brain size={30} color="#6D28D9" />
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>
            {hasQuery ? 'Aucun résultat' : 'Mémoire vide'}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 20px' }}>
            {hasQuery ? `Aucun document ne correspond à « ${debouncedQ} »` : 'Indexez vos premiers documents pour commencer'}
          </p>
          {!hasQuery && (
            <button onClick={() => setShowModal(true)}
              style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6D28D9,#4F46E5)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={13} />Indexer un premier document</span>
            </button>
          )}
        </div>
      )}

      {/* Results */}
      {!isLoading && !isError && results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {results.map(doc => (
            <ResultCard key={doc.id} doc={doc} query={debouncedQ} onDelete={id => deleteMutation.mutate(id)} />
          ))}
        </div>
      )}

      {/* Index modal */}
      {showModal && <IndexModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
