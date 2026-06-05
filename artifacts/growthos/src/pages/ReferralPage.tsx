import { useState } from 'react';
import { Copy, CheckCircle2, Gift, Users, TrendingUp, Share2, Mail, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';

export default function ReferralPage() {
  const { user } = useAuthStore();
  const [copied, setCopied] = useState(false);

  const tenantSlug = (user as any)?.tenantId?.slice(0, 8) ?? 'demo';
  const referralCode = `GOS-${tenantSlug.toUpperCase()}`;
  const referralLink = `https://growthos.app/signup?ref=${referralCode}`;

  const copy = async () => {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success('Lien copié !');
    setTimeout(() => setCopied(false), 2000);
  };

  const MOCK_REFERRALS = [
    { email: 'agency@growth.fr', status: 'active', date: '15 mai 2026', discount: '20%' },
    { email: 'startup@scale.io', status: 'pending', date: '28 mai 2026', discount: '—' },
  ];

  return (
    <div style={{ minHeight: '100vh', padding: '20px 24px', background: 'var(--body-bg)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: '#FFFBEB', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Gift size={28} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>Programme de parrainage</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0, maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
            Recommandez GrowthOS à vos contacts et recevez <strong>20% de réduction</strong> sur votre prochain mois pour chaque filleul activé.
          </p>
        </div>

        {/* How it works */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { step: '1', icon: <Share2 size={20} />, title: 'Partagez votre lien', desc: 'Envoyez votre lien unique à vos contacts', color: '#3B82F6', bg: '#EFF6FF' },
            { step: '2', icon: <Users size={20} />, title: 'Votre filleul s\'inscrit', desc: 'Il bénéficie de 20% sur son premier mois', color: '#8B5CF6', bg: '#F5F3FF' },
            { step: '3', icon: <TrendingUp size={20} />, title: 'Vous gagnez une réduction', desc: '20% de réduction sur votre prochain mois', color: '#10B981', bg: '#ECFDF5' },
          ].map((s, i) => (
            <div key={i} style={{ padding: '16px', borderRadius: 16, border: '1px solid var(--card-border)', background: 'var(--card-bg)', textAlign: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: s.bg, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>{s.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{s.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.desc}</div>
            </div>
          ))}
        </div>

        {/* Referral link */}
        <div style={{ borderRadius: 20, border: '1px solid var(--card-border)', background: 'var(--card-bg)', padding: '24px', marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px' }}>Votre lien de parrainage</h2>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1, padding: '11px 14px', borderRadius: 12, border: '1px solid var(--card-border)', background: 'var(--body-bg)', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {referralLink}
            </div>
            <button onClick={copy}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '11px 16px', borderRadius: 12, border: 'none', background: copied ? '#10B981' : 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0, transition: 'background .2s' }}>
              {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
              {copied ? 'Copié !' : 'Copier'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ padding: '8px 14px', borderRadius: 10, background: 'var(--body-bg)', border: '1px solid var(--card-border)', fontSize: 12, color: 'var(--text-muted)' }}>
              Code : <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{referralCode}</strong>
            </div>

            <button onClick={() => { window.open(`mailto:?subject=Essayez GrowthOS&body=Bonjour,%0A%0AJe vous recommande GrowthOS, la plateforme de growth intelligence B2B.%0A%0AInscrivez-vous via ce lien pour bénéficier de 20% de réduction : ${referralLink}%0A%0ABonne croissance !`, '_blank'); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              <Mail size={12} />Partager par email
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { l: 'Filleuls invités', v: '2' },
            { l: 'Filleuls actifs', v: '1' },
            { l: 'Réductions gagnées', v: '20%' },
          ].map((s, i) => (
            <div key={i} style={{ padding: '16px', borderRadius: 14, border: '1px solid var(--card-border)', background: 'var(--card-bg)', textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{s.v}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* History */}
        <div style={{ borderRadius: 20, border: '1px solid var(--card-border)', background: 'var(--card-bg)', padding: '20px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 14px' }}>Historique des parrainages</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {MOCK_REFERRALS.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, background: 'var(--body-bg)', border: '1px solid var(--card-border)' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: r.status === 'active' ? '#ECFDF5' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Users size={14} style={{ color: r.status === 'active' ? '#10B981' : '#6B7280' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{r.email}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Inscrit le {r.date}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 9999, background: r.status === 'active' ? '#ECFDF5' : '#F3F4F6', color: r.status === 'active' ? '#10B981' : '#6B7280' }}>
                  {r.status === 'active' ? '✓ Actif' : '⏳ En attente'}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: r.discount !== '—' ? '#D97706' : 'var(--text-muted)' }}>{r.discount}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
