import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { ArrowLeft, Loader2, Zap, Building2, Star, CheckCircle, ExternalLink, Mail, Plus } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  funding: { icon: '💰', color: '#059669', bg: '#ECFDF5', label: 'Levée de fonds' },
  hiring: { icon: '👥', color: '#2563EB', bg: '#EFF6FF', label: 'Recrutement' },
  news: { icon: '📰', color: '#D97706', bg: '#FEF3C7', label: 'Actualité' },
  technology: { icon: '🔧', color: '#7C3AED', bg: '#EDE9FE', label: 'Technologie' },
  expansion: { icon: '🌍', color: '#0891B2', bg: '#ECFEFF', label: 'Expansion' },
};

const RECOMMENDED_ACTIONS = [
  { icon: '✉️', label: 'Envoyer un email de prospection contextualisé', type: 'email' },
  { icon: '📞', label: 'Appeler dans les 24h (signal chaud)', type: 'call' },
  { icon: '💼', label: 'Créer un deal associé à ce signal', type: 'deal' },
  { icon: '📋', label: 'Ajouter à une séquence ciblée', type: 'sequence' },
];

export default function SignalDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [, navigate] = useLocation();
  const [signal, setSignal] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/signals')
      .then((data: any) => {
        const list = Array.isArray(data) ? data : data.data || [];
        const found = list.find((s: any) => s.id === id);
        if (!found) { toast.error('Signal introuvable'); navigate('/signals'); return; }
        setSignal(found);
        if (!found.isRead) {
          apiClient.post(`/signals/${id}/read`, {}).catch(() => { });
        }
      })
      .catch(() => { toast.error('Erreur'); navigate('/signals'); })
      .finally(() => setLoading(false));
  }, [id]);

  const toggleStar = async () => {
    const updated: any = await apiClient.patch(`/signals/${id}`, { isStarred: !signal.isStarred });
    setSignal((s: any) => ({ ...s, isStarred: !s.isStarred }));
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--body-bg)' }}>
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-primary)' }} />
    </div>
  );
  if (!signal) return null;

  const typeInfo = TYPE_CONFIG[signal.type] || { icon: '⚡', color: '#6B7280', bg: '#F3F4F6', label: signal.type };

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--body-bg)' }}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/signals')} className="p-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft size={20} style={{ color: 'var(--text-muted)' }} />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{ background: typeInfo.bg }}>
            {typeInfo.icon}
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{signal.title}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Building2 size={13} style={{ color: 'var(--text-muted)' }} />
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{signal.company}</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: typeInfo.bg, color: typeInfo.color }}>
                {typeInfo.label}
              </span>
            </div>
          </div>
        </div>
        <button onClick={toggleStar} className={`p-2 rounded-xl ${signal.isStarred ? 'bg-amber-50' : 'hover:bg-gray-100'}`}>
          <Star size={18} className={signal.isStarred ? 'fill-amber-400 text-amber-400' : 'text-gray-400'} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-4">
          {/* Signal content */}
          <div className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <h2 className="font-semibold mb-3 text-sm" style={{ color: 'var(--text-muted)' }}>DÉTAILS DU SIGNAL</h2>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: typeInfo.bg }}>
                <span className="text-xl">{typeInfo.icon}</span>
              </div>
              <div>
                <div className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{signal.title}</div>
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{signal.company}</div>
              </div>
            </div>
            {signal.description ? (
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{signal.description}</p>
            ) : (
              <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>Aucune description disponible pour ce signal.</p>
            )}
            <div className="mt-4 pt-4 border-t flex items-center gap-4" style={{ borderColor: 'var(--card-border)' }}>
              <div>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Détecté le : </span>
                <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  {new Date(signal.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle size={13} className="text-green-500" />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{signal.isRead ? 'Lu' : 'Non lu'}</span>
              </div>
            </div>
          </div>

          {/* Recommended actions */}
          <div className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <h2 className="font-semibold mb-3 text-sm" style={{ color: 'var(--text-muted)' }}>ACTIONS RECOMMANDÉES</h2>
            <div className="space-y-2">
              {RECOMMENDED_ACTIONS.map((action, i) => (
                <button key={i} onClick={() => {
                  if (action.type === 'email') toast.info('Fonctionnalité de rédaction email — bientôt disponible');
                  else if (action.type === 'deal') navigate('/pipeline');
                  else if (action.type === 'sequence') navigate('/sequences');
                  else toast.info('Action planifiée dans vos activités');
                }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border text-left hover:border-teal-300 transition-all"
                  style={{ background: 'var(--body-bg)', borderColor: 'var(--card-border)' }}>
                  <span className="text-lg">{action.icon}</span>
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{action.label}</span>
                  <ExternalLink size={13} className="ml-auto" style={{ color: 'var(--text-muted)' }} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          <div className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <h2 className="font-semibold mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>SCORE D'INTENTION</h2>
            <div className="flex items-center justify-center mb-3">
              <div className="relative w-24 h-24">
                <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--body-bg)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke={typeInfo.color} strokeWidth="3"
                    strokeDasharray={`${signal.score || 50} 100`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold" style={{ color: typeInfo.color }}>{signal.score || 50}</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              {signal.score >= 80 ? '🔥 Signal très fort — agissez maintenant' :
                signal.score >= 60 ? '⚡ Signal fort — à traiter rapidement' :
                  '📊 Signal modéré — à surveiller'}
            </p>
          </div>

          <div className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <h2 className="font-semibold mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>INFORMATIONS</h2>
            <div className="space-y-2">
              {[
                { l: 'Entreprise', v: signal.company },
                { l: 'Type', v: typeInfo.label },
                { l: 'Score', v: `${signal.score || 50}/100` },
                { l: 'Statut', v: signal.isRead ? 'Lu' : 'Non lu' },
                { l: 'Favori', v: signal.isStarred ? '⭐ Oui' : 'Non' },
              ].map(m => (
                <div key={m.l} className="flex justify-between">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.l}</span>
                  <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{m.v}</span>
                </div>
              ))}
            </div>
          </div>

          <button onClick={() => navigate('/signals')} className="w-full py-2.5 rounded-xl text-sm border text-left px-3 flex items-center gap-2"
            style={{ borderColor: 'var(--card-border)', color: 'var(--text-secondary)', background: 'var(--card-bg)' }}>
            <Zap size={13} style={{ color: 'var(--color-primary)' }} />
            Voir tous les signaux
          </button>
        </div>
      </div>
    </div>
  );
}
