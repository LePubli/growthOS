import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Plus, X, Loader2, Instagram, Linkedin, Twitter, FileText, Mail } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';

interface Campaign { id: string; name: string; }
interface Post {
  id: string;
  platform: string;
  content_text: string;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
}

const PLATFORMS = [
  { value: 'LinkedIn', label: 'LinkedIn', color: '#0A66C2', bg: '#EFF6FF' },
  { value: 'X', label: 'X / Twitter', color: '#000000', bg: '#F9FAFB' },
  { value: 'Blog', label: 'Blog', color: '#7C3AED', bg: '#F5F3FF' },
  { value: 'Newsletter', label: 'Newsletter', color: '#D97706', bg: '#FFFBEB' },
  { value: 'Instagram', label: 'Instagram', color: '#E1306C', bg: '#FFF1F2' },
];

const TONES = [
  { value: 'professionnel', label: '👔 Professionnel' },
  { value: 'inspirant', label: '✨ Inspirant' },
  { value: 'éducatif', label: '📚 Éducatif' },
  { value: 'storytelling', label: '📖 Storytelling' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Brouillon', color: '#6B7280', bg: 'var(--body-bg)' },
  published: { label: 'Publié', color: '#059669', bg: '#F0FDF4' },
  failed: { label: 'Échec', color: '#DC2626', bg: '#FEF2F2' },
  scheduled: { label: 'Planifié', color: '#2563EB', bg: '#EFF6FF' },
};

const platformColor = (p: string) => PLATFORMS.find(pl => pl.value === p)?.color ?? '#6B7280';
const platformBg = (p: string) => PLATFORMS.find(pl => pl.value === p)?.bg ?? 'var(--body-bg)';

const MOCK_POSTS: Post[] = [
  { id: '1', platform: 'LinkedIn', content_text: '🚀 GrowthOS révolutionne la prospection B2B...', status: 'published', scheduled_at: null, published_at: new Date(Date.now() - 86400000).toISOString(), created_at: new Date().toISOString() },
  { id: '2', platform: 'Blog', content_text: 'Comment augmenter votre score de réputation en 30 jours...', status: 'scheduled', scheduled_at: new Date(Date.now() + 2 * 86400000).toISOString(), published_at: null, created_at: new Date().toISOString() },
  { id: '3', platform: 'X', content_text: '🔥 Notre dernier article sur le growth hacking est en ligne !', status: 'draft', scheduled_at: null, published_at: null, created_at: new Date().toISOString() },
  { id: '4', platform: 'Newsletter', content_text: 'Bonjour, ce mois-ci GrowthOS a franchi de nouvelles étapes...', status: 'scheduled', scheduled_at: new Date(Date.now() + 5 * 86400000).toISOString(), published_at: null, created_at: new Date().toISOString() },
  { id: '5', platform: 'Instagram', content_text: '✨ Découvrez nos dernières innovations...', status: 'draft', scheduled_at: null, published_at: null, created_at: new Date().toISOString() },
];

export default function SocialCalendarPage() {
  const qc = useQueryClient();
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [generatingContent, setGeneratingContent] = useState(false);
  const [form, setForm] = useState({ platform: 'LinkedIn', tone: 'professionnel', content: '', scheduledAt: '' });
  const [view, setView] = useState<'list' | 'calendar'>('list');

  const { data: campaigns = [] } = useQuery({
    queryKey: ['erep-campaigns'],
    queryFn: () => apiClient.get('/ereputation/campaigns') as Promise<Campaign[]>,
    onSuccess: (d) => { if (!selectedCampaign && d.length) setSelectedCampaign(d[0]!.id); },
  });

  const { data: posts = MOCK_POSTS } = useQuery({
    queryKey: ['erep-posts', selectedCampaign],
    queryFn: () => selectedCampaign
      ? apiClient.get(`/ereputation/campaigns/${selectedCampaign}/posts`) as Promise<Post[]>
      : Promise.resolve(MOCK_POSTS),
  });

  const createPost = useMutation({
    mutationFn: () => apiClient.post(`/ereputation/campaigns/${selectedCampaign}/posts`, {
      platform: form.platform,
      content: form.content,
      scheduledAt: form.scheduledAt || undefined,
    }),
    onSuccess: () => {
      toast.success('Post créé');
      qc.invalidateQueries({ queryKey: ['erep-posts', selectedCampaign] });
      setShowModal(false);
      setForm({ platform: 'LinkedIn', tone: 'professionnel', content: '', scheduledAt: '' });
    },
    onError: () => toast.error('Erreur lors de la création'),
  });

  const generateContent = async () => {
    if (!selectedCampaign) { toast.error('Sélectionnez une campagne'); return; }
    setGeneratingContent(true);
    try {
      const res = await apiClient.post(`/ereputation/campaigns/${selectedCampaign}/generate-content`, {
        platform: form.platform,
        tone: form.tone,
      }) as any;
      setForm(f => ({ ...f, content: res.content }));
      toast.success('Contenu généré par IA ✨');
    } catch { toast.error('Erreur de génération'); }
    finally { setGeneratingContent(false); }
  };

  const displayPosts = posts.length ? posts : MOCK_POSTS;

  const formatDate = (d: string | null) => d
    ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Calendrier Social</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Planification et gestion des publications</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={selectedCampaign} onChange={e => setSelectedCampaign(e.target.value)}
            className="px-3 py-2 border rounded-xl text-sm focus:outline-none"
            style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}>
            <option value="">Toutes</option>
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
            style={{ background: 'linear-gradient(135deg,#1E3A5F,#2563EB)' }}>
            <Plus size={14} />Nouveau post
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {PLATFORMS.slice(0, 4).map(pl => {
          const count = displayPosts.filter(p => p.platform === pl.value).length;
          return (
            <div key={pl.value} className="rounded-xl border p-4" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
              <div className="text-xs mb-1" style={{ color: pl.color, fontWeight: 600 }}>{pl.label}</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{count}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>publication{count > 1 ? 's' : ''}</div>
            </div>
          );
        })}
      </div>

      {/* Posts list */}
      <div className="space-y-3">
        {displayPosts.map(post => {
          const status = STATUS_CONFIG[post.status] ?? STATUS_CONFIG.draft!;
          return (
            <div key={post.id} className="rounded-2xl border p-4" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold"
                  style={{ background: platformBg(post.platform), color: platformColor(post.platform) }}>
                  {post.platform.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold" style={{ color: platformColor(post.platform) }}>{post.platform}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: status.bg, color: status.color }}>{status.label}</span>
                    <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
                      {post.scheduled_at ? `📅 ${formatDate(post.scheduled_at)}` : post.published_at ? `✅ ${formatDate(post.published_at)}` : 'Non planifié'}
                    </span>
                  </div>
                  <p className="text-sm line-clamp-2" style={{ color: 'var(--text-primary)' }}>{post.content_text}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* New Post Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl border shadow-2xl w-full max-w-lg mx-4 p-6" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Nouveau post</h2>
              <button onClick={() => setShowModal(false)} style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Plateforme</label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map(pl => (
                    <button key={pl.value} onClick={() => setForm(f => ({ ...f, platform: pl.value }))}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                      style={{
                        background: form.platform === pl.value ? pl.color : 'var(--body-bg)',
                        color: form.platform === pl.value ? '#fff' : 'var(--text-secondary)',
                        borderColor: form.platform === pl.value ? 'transparent' : 'var(--card-border)',
                      }}>
                      {pl.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Ton IA</label>
                <div className="flex flex-wrap gap-2">
                  {TONES.map(t => (
                    <button key={t.value} onClick={() => setForm(f => ({ ...f, tone: t.value }))}
                      className="px-3 py-1.5 rounded-lg text-xs border transition-all"
                      style={{
                        background: form.tone === t.value ? 'var(--color-primary)' : 'var(--body-bg)',
                        color: form.tone === t.value ? '#fff' : 'var(--text-secondary)',
                        borderColor: form.tone === t.value ? 'transparent' : 'var(--card-border)',
                      }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={generateContent} disabled={generatingContent}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium border"
                style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)', background: 'var(--body-bg)' }}>
                {generatingContent ? <Loader2 size={14} className="animate-spin" /> : '✨'}
                Générer le contenu avec l'IA
              </button>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Contenu</label>
                <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={6}
                  placeholder="Rédigez ou générez votre contenu..."
                  className="w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none resize-none"
                  style={{ background: 'var(--body-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Planifier le (optionnel)</label>
                <input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
                  className="w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none"
                  style={{ background: 'var(--body-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl border text-sm" style={{ borderColor: 'var(--card-border)', color: 'var(--text-muted)' }}>
                  Annuler
                </button>
                <button onClick={() => createPost.mutate()} disabled={!form.content || createPost.isPending}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#1E3A5F,#2563EB)' }}>
                  {createPost.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Publier / Planifier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
