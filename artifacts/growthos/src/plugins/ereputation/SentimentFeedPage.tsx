import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ThumbsUp, ThumbsDown, Minus, Loader2, Sparkles, Globe, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';

interface Campaign { id: string; name: string; }
interface SentimentLog {
  id: string;
  text: string;
  sentiment: 'pos' | 'neg' | 'neu';
  score: number;
  source_url: string | null;
  detected_at: string;
}

const SENTIMENT_CONFIG = {
  pos: { label: 'Positif', icon: <ThumbsUp size={12} />, bg: '#F0FDF4', border: '#86EFAC', text: '#059669' },
  neg: { label: 'Négatif', icon: <ThumbsDown size={12} />, bg: '#FEF2F2', border: '#FCA5A5', text: '#DC2626' },
  neu: { label: 'Neutre', icon: <Minus size={12} />, bg: 'var(--body-bg)', border: 'var(--card-border)', text: 'var(--text-muted)' },
};

const MOCK_LOGS: SentimentLog[] = [
  { id: '1', text: 'Excellent service de prospection B2B, je recommande vivement GrowthOS à tous nos partenaires !', sentiment: 'pos', score: 0.92, source_url: 'https://trustpilot.com', detected_at: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: '2', text: 'Problème récurrent avec le support client, les délais de réponse sont inacceptables.', sentiment: 'neg', score: -0.75, source_url: 'https://google.com/reviews', detected_at: new Date(Date.now() - 5 * 3600000).toISOString() },
  { id: '3', text: 'GrowthOS est un outil correct pour la prospection, sans plus.', sentiment: 'neu', score: 0.05, source_url: null, detected_at: new Date(Date.now() - 8 * 3600000).toISOString() },
  { id: '4', text: 'Arnaque ! Les promesses ne sont pas tenues, je déconseille fortement.', sentiment: 'neg', score: -0.90, source_url: 'https://avis-verifies.com', detected_at: new Date(Date.now() - 12 * 3600000).toISOString() },
  { id: '5', text: 'Très professionnel, livraison dans les délais et qualité au rendez-vous. Bravo à l\'équipe !', sentiment: 'pos', score: 0.85, source_url: 'https://linkedin.com', detected_at: new Date(Date.now() - 18 * 3600000).toISOString() },
];

export default function SentimentFeedPage() {
  const qc = useQueryClient();
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [filter, setFilter] = useState<'all' | 'pos' | 'neg' | 'neu'>('all');
  const [aiResponse, setAiResponse] = useState<Record<string, string>>({});
  const [loadingAI, setLoadingAI] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newText, setNewText] = useState('');
  const [newUrl, setNewUrl] = useState('');

  const { data: campaigns = [] } = useQuery({
    queryKey: ['erep-campaigns'],
    queryFn: () => apiClient.get('/ereputation/campaigns') as Promise<Campaign[]>,
    onSuccess: (d) => { if (!selectedCampaign && d.length) setSelectedCampaign(d[0]!.id); },
  });

  const { data: logs = MOCK_LOGS, isLoading } = useQuery({
    queryKey: ['erep-sentiment', selectedCampaign],
    queryFn: () => selectedCampaign
      ? apiClient.get(`/ereputation/campaigns/${selectedCampaign}/sentiment`) as Promise<SentimentLog[]>
      : Promise.resolve(MOCK_LOGS),
  });

  const addMut = useMutation({
    mutationFn: () => apiClient.post(`/ereputation/campaigns/${selectedCampaign}/sentiment`, { text: newText, sourceUrl: newUrl || undefined }),
    onSuccess: () => {
      toast.success('Mention ajoutée et analysée');
      qc.invalidateQueries({ queryKey: ['erep-sentiment', selectedCampaign] });
      setShowAdd(false); setNewText(''); setNewUrl('');
    },
  });

  const generateAIResponse = async (log: SentimentLog) => {
    setLoadingAI(log.id);
    try {
      const res = await apiClient.post(`/ereputation/campaigns/${selectedCampaign}/sentiment/${log.id}/ai-response`, { text: log.text }) as any;
      setAiResponse(prev => ({ ...prev, [log.id]: res.response }));
    } catch { toast.error('Erreur IA'); }
    finally { setLoadingAI(null); }
  };

  const displayLogs = (logs.length ? logs : MOCK_LOGS).filter(l => filter === 'all' || l.sentiment === filter);

  const elapsed = (dateStr: string) => {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`;
    if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
    return `il y a ${Math.floor(diff / 86400)}j`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Fil des Mentions</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Analyse de sentiment en temps réel</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={selectedCampaign} onChange={e => setSelectedCampaign(e.target.value)}
            className="px-3 py-2 border rounded-xl text-sm focus:outline-none"
            style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}>
            <option value="">Toutes</option>
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-white"
            style={{ background: 'linear-gradient(135deg,#1E3A5F,#2563EB)' }}>
            <Plus size={13} />Ajouter
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'pos', 'neg', 'neu'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-xl text-xs font-medium border transition-all"
            style={{
              background: filter === f ? 'var(--color-primary)' : 'var(--body-bg)',
              color: filter === f ? '#fff' : 'var(--text-muted)',
              borderColor: filter === f ? 'transparent' : 'var(--card-border)',
            }}>
            {f === 'all' ? 'Tout' : f === 'pos' ? '✅ Positif' : f === 'neg' ? '🔴 Négatif' : '⚪ Neutre'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-primary)' }} /></div>
      ) : (
        <div className="space-y-3">
          {displayLogs.map(log => {
            const cfg = SENTIMENT_CONFIG[log.sentiment as keyof typeof SENTIMENT_CONFIG] ?? SENTIMENT_CONFIG.neu;
            return (
              <div key={log.id} className="rounded-2xl border p-4" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}`, color: cfg.text }}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}>
                        {cfg.label}
                      </span>
                      {log.source_url && (
                        <a href={log.source_url} target="_blank" rel="noreferrer"
                          className="flex items-center gap-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                          <Globe size={10} />{new URL(log.source_url).hostname}
                        </a>
                      )}
                      <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>{elapsed(log.detected_at)}</span>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{log.text}</p>

                    {log.sentiment === 'neg' && (
                      <div className="mt-3">
                        {aiResponse[log.id] ? (
                          <div className="p-3 rounded-xl text-sm" style={{ background: '#F0FDF4', border: '1px solid #86EFAC', color: '#059669' }}>
                            <div className="text-xs font-semibold mb-1">💬 Réponse IA suggérée :</div>
                            {aiResponse[log.id]}
                          </div>
                        ) : (
                          <button onClick={() => generateAIResponse(log)} disabled={loadingAI === log.id}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
                            style={{ background: '#EFF6FF', color: '#2563EB' }}>
                            {loadingAI === log.id ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                            Générer réponse IA
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add mention modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl border shadow-2xl w-full max-w-md mx-4 p-6" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Ajouter une mention</h2>
              <button onClick={() => setShowAdd(false)} style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <textarea value={newText} onChange={e => setNewText(e.target.value)} rows={3}
                placeholder="Texte de la mention..."
                className="w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none resize-none"
                style={{ background: 'var(--body-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
              <input value={newUrl} onChange={e => setNewUrl(e.target.value)}
                placeholder="URL source (optionnel)"
                className="w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none"
                style={{ background: 'var(--body-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
              <button onClick={() => addMut.mutate()} disabled={!newText || !selectedCampaign || addMut.isPending}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-white flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#1E3A5F,#2563EB)' }}>
                {addMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Analyser et ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
