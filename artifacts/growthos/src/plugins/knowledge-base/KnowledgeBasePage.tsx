import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, ShieldAlert, Mic, ClipboardList, HelpCircle, Search, Plus, X, Loader2, Tag, Brain, ChevronRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';
import { ArticleCard, Article } from './ArticleCard';

/* ─── Types ───────────────────────────────────────────────── */
type Category = 'all' | 'playbook' | 'objection' | 'script' | 'procedure' | 'faq';

const CATEGORIES: { id: Category; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'all',       label: 'Tout',        icon: <BookOpen size={14} />,      color: '#4F46E5' },
  { id: 'playbook',  label: 'Playbooks',   icon: <BookOpen size={14} />,      color: '#6D28D9' },
  { id: 'objection', label: 'Objections',  icon: <ShieldAlert size={14} />,   color: '#DC2626' },
  { id: 'script',    label: 'Scripts',     icon: <Mic size={14} />,           color: '#2563EB' },
  { id: 'procedure', label: 'Procédures',  icon: <ClipboardList size={14} />, color: '#16A34A' },
  { id: 'faq',       label: 'FAQ',         icon: <HelpCircle size={14} />,    color: '#C2410C' },
];

/* ─── New Article Modal ───────────────────────────────────── */
function NewArticleModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: '', content: '', category: 'playbook' as Article['category'], tagInput: '', tags: [] as string[] });

  const mutation = useMutation({
    mutationFn: (data: Omit<typeof form, 'tagInput'>) =>
      apiClient.post('/knowledge', { title: data.title, content: data.content, category: data.category, tags: data.tags }),
    onSuccess: () => {
      toast.success('Article créé et indexé dans Growth Memory ✓');
      qc.invalidateQueries({ queryKey: ['knowledge-articles'] });
      qc.invalidateQueries({ queryKey: ['knowledge-stats'] });
      onClose();
    },
    onError: () => toast.error('Erreur lors de la création'),
  });

  const addTag = () => {
    const t = form.tagInput.trim().toLowerCase();
    if (t && !form.tags.includes(t)) setForm(f => ({ ...f, tags: [...f.tags, t], tagInput: '' }));
  };
  const removeTag = (t: string) => setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 640, background: 'var(--card-bg)', borderRadius: 20, border: '1px solid var(--card-border)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#4F46E5,#7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={15} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Nouvel article</h2>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>Sera automatiquement indexé dans Growth Memory</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'var(--body-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} color="var(--text-muted)" />
          </button>
        </div>

        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>TITRE *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Ex: Gérer l'objection 'Trop cher'"
              style={{ width: '100%', padding: '9px 13px', borderRadius: 10, border: '1.5px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>CATÉGORIE *</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                <button key={cat.id} onClick={() => setForm(f => ({ ...f, category: cat.id as Article['category'] }))}
                  style={{ padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700, border: `1.5px solid ${form.category === cat.id ? cat.color : 'var(--card-border)'}`, background: form.category === cat.id ? cat.color + '18' : 'var(--body-bg)', color: form.category === cat.id ? cat.color : 'var(--text-muted)', cursor: 'pointer' }}>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>CONTENU *</label>
            <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="Rédigez le contenu de l'article. Soyez précis — ce contenu sera utilisé par l'AI SDR et le Deal Coach."
              rows={8}
              style={{ width: '100%', padding: '10px 13px', borderRadius: 10, border: '1.5px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' }} />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>TAGS</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={form.tagInput} onChange={e => setForm(f => ({ ...f, tagInput: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="Ajouter un tag + Entrée"
                style={{ flex: 1, padding: '8px 13px', borderRadius: 10, border: '1.5px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }} />
              <button onClick={addTag} style={{ padding: '8px 14px', borderRadius: 10, background: 'var(--body-bg)', border: '1.5px solid var(--card-border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }}>+ Ajouter</button>
            </div>
            {form.tags.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {form.tags.map(t => (
                  <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#EEF2FF', color: '#4338CA', fontWeight: 600 }}>
                    {t}<button onClick={() => removeTag(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4338CA', padding: 0, lineHeight: 1 }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: '1.5px solid var(--card-border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
            <button onClick={() => mutation.mutate({ title: form.title, content: form.content, category: form.category, tags: form.tags })}
              disabled={!form.title || !form.content || mutation.isPending}
              style={{ padding: '9px 22px', borderRadius: 10, background: '#4F46E5', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, opacity: !form.title || !form.content ? 0.6 : 1 }}>
              {mutation.isPending ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />Création…</> : <><BookOpen size={13} />Créer et indexer</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Article Detail Panel ────────────────────────────────── */
function ArticleDetail({ article, onClose, onDelete }: { article: Article; onClose: () => void; onDelete: (id: string) => void }) {
  const categoryColors: Record<string, string> = { playbook: '#6D28D9', objection: '#DC2626', script: '#2563EB', procedure: '#16A34A', faq: '#C2410C' };
  const color = categoryColors[article.category] ?? '#4F46E5';

  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: 20, height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.4, flex: 1 }}>{article.title}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onDelete(article.id)} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: '#FEF2F2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trash2 size={13} color="#DC2626" />
          </button>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'var(--body-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={13} color="var(--text-muted)" />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: color + '18', color }}>{article.category}</span>
        {article.tags.map(t => (
          <span key={t} style={{ padding: '3px 9px', borderRadius: 20, fontSize: 10, background: 'var(--body-bg)', color: 'var(--text-muted)', border: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Tag size={8} />{t}
          </span>
        ))}
      </div>

      <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.8, whiteSpace: 'pre-wrap', flex: 1 }}>
        {article.content}
      </div>

      <div style={{ padding: '10px 14px', borderRadius: 10, background: '#EEF2FF', border: '1px solid #C7D2FE', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Brain size={13} color="#4338CA" />
        <span style={{ fontSize: 11, color: '#4338CA', fontWeight: 600 }}>Indexé dans Growth Memory — disponible pour l'AI SDR et le Deal Coach</span>
      </div>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────── */
export default function KnowledgeBasePage() {
  const qc = useQueryClient();
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);

  const listQuery = useQuery<{ articles: Article[]; total: number }>({
    queryKey: ['knowledge-articles', activeCategory, searchMode ? '' : undefined],
    queryFn: () => {
      const params = new URLSearchParams();
      if (activeCategory !== 'all') params.set('category', activeCategory);
      return apiClient.get(`/knowledge?${params}`);
    },
    enabled: !searchMode,
  });

  const searchQuery_ = useQuery<Article[]>({
    queryKey: ['knowledge-search', searchQuery],
    queryFn: () => apiClient.get(`/knowledge/search?q=${encodeURIComponent(searchQuery)}`),
    enabled: searchMode && searchQuery.length >= 2,
  });

  const statsQuery = useQuery<Record<string, number>>({
    queryKey: ['knowledge-stats'],
    queryFn: () => apiClient.get('/knowledge/stats'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/knowledge/${id}`),
    onSuccess: () => {
      toast.success('Article supprimé');
      qc.invalidateQueries({ queryKey: ['knowledge-articles'] });
      qc.invalidateQueries({ queryKey: ['knowledge-stats'] });
      setSelectedArticle(null);
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  });

  const articles = searchMode
    ? (searchQuery_.data ?? [])
    : (listQuery.data?.articles ?? []);

  const isLoading = searchMode ? searchQuery_.isLoading : listQuery.isLoading;

  return (
    <div style={{ padding: '28px 28px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg,#4F46E5,#7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Base de Connaissances</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Playbooks · Objections · Scripts · Procédures — indexés dans Growth Memory</p>
          </div>
        </div>
        <button onClick={() => setShowNewModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, background: '#4F46E5', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
          <Plus size={15} />Nouvel article
        </button>
      </div>

      {/* Search bar */}
      <div style={{ marginBottom: 20, position: 'relative' }}>
        <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setSearchMode(e.target.value.length >= 2); }}
          placeholder="Recherche sémantique — ex: 'Comment gérer l'objection sur le prix ?'"
          style={{ width: '100%', padding: '12px 14px 12px 42px', borderRadius: 14, border: '1.5px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
        />
        {searchMode && (
          <button onClick={() => { setSearchQuery(''); setSearchMode(false); }}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={14} color="var(--text-muted)" />
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedArticle ? '260px 1fr 1fr' : '260px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--card-border)' }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', margin: 0, letterSpacing: '0.06em' }}>CATÉGORIES</p>
            </div>
            {CATEGORIES.map(cat => {
              const count = cat.id === 'all'
                ? Object.values(statsQuery.data ?? {}).reduce((a, b) => a + b, 0)
                : (statsQuery.data?.[cat.id] ?? 0);
              return (
                <button key={cat.id}
                  onClick={() => { setActiveCategory(cat.id); setSearchMode(false); setSearchQuery(''); setSelectedArticle(null); }}
                  style={{ width: '100%', padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 10, background: activeCategory === cat.id ? cat.color + '12' : 'transparent', border: 'none', cursor: 'pointer', borderLeft: activeCategory === cat.id ? `3px solid ${cat.color}` : '3px solid transparent', textAlign: 'left' }}>
                  <span style={{ color: cat.color }}>{cat.icon}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: activeCategory === cat.id ? 700 : 500, color: 'var(--text-primary)' }}>{cat.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>{count}</span>
                </button>
              );
            })}
          </div>

          <div style={{ padding: '12px 14px', background: 'linear-gradient(135deg,#EEF2FF,#F5F3FF)', border: '1px solid #C7D2FE', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Brain size={12} color="#4338CA" />
              <span style={{ fontSize: 11, fontWeight: 800, color: '#4338CA' }}>Growth Memory</span>
            </div>
            <p style={{ fontSize: 11, color: '#4338CA', margin: 0, lineHeight: 1.5 }}>
              Chaque article est automatiquement vectorisé et disponible pour l'AI SDR et le Deal Coach.
            </p>
          </div>
        </div>

        {/* Article list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {searchMode && (
            <div style={{ padding: '8px 12px', background: '#EEF2FF', borderRadius: 10, fontSize: 12, color: '#4338CA', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Search size={12} />
              {searchQuery_.isLoading ? 'Recherche...' : `${articles.length} résultat(s) pour "${searchQuery}"`}
            </div>
          )}
          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
              <Loader2 size={20} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : articles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14 }}>
              <BookOpen size={32} color="var(--text-muted)" style={{ margin: '0 auto 12px', display: 'block' }} />
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>Aucun article</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px' }}>
                {searchMode ? 'Aucun résultat pour cette recherche.' : 'Créez votre premier article pour cette catégorie.'}
              </p>
              {!searchMode && (
                <button onClick={() => setShowNewModal(true)}
                  style={{ padding: '8px 18px', borderRadius: 10, background: '#4F46E5', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                  <Plus size={12} /> Créer un article
                </button>
              )}
            </div>
          ) : (
            articles.map(a => (
              <ArticleCard key={a.id} article={a} selected={selectedArticle?.id === a.id} onClick={setSelectedArticle} />
            ))
          )}
        </div>

        {/* Detail panel */}
        {selectedArticle && (
          <ArticleDetail
            article={selectedArticle}
            onClose={() => setSelectedArticle(null)}
            onDelete={(id) => deleteMutation.mutate(id)}
          />
        )}
      </div>

      {showNewModal && <NewArticleModal onClose={() => setShowNewModal(false)} />}
    </div>
  );
}
