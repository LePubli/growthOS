import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { CreditCard, CheckCircle, Crown, Users, Mail, Zap, AlertCircle, Download, X, RefreshCw, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';

const PLANS = [
  {
    id: 'starter', name: 'Starter', price: 49, desc: 'Pour les freelances et petites équipes',
    features: ['500 prospects/mois', '3 séquences actives', '2 utilisateurs', 'Plugins de base', 'Support email'],
  },
  {
    id: 'pro', name: 'Pro', price: 149, desc: 'Pour les équipes commerciales',
    features: ['5 000 prospects/mois', 'Séquences illimitées', '10 utilisateurs', 'Tous les plugins', 'Support prioritaire', 'Export CSV'],
  },
  {
    id: 'enterprise', name: 'Enterprise', price: 499, desc: 'Pour les grandes organisations',
    features: ['Prospects illimités', 'API complète', 'Utilisateurs illimités', 'SSO/SAML', 'Account manager dédié', 'SLA 99.9%'],
  },
];

const USAGE_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  prospects: { label: 'Prospects', icon: <Users size={14} /> },
  sequences: { label: 'Séquences', icon: <Zap size={14} /> },
  users: { label: 'Utilisateurs', icon: <Users size={14} /> },
  emails: { label: 'Emails', icon: <Mail size={14} /> },
};

type SubscriptionData = {
  plan: string; status: string; stripe_configured: boolean;
  stripe_subscription_id?: string; current_period_end?: string;
};
type UsageData = Record<string, { used: number; limit: number; percent: number }>;
type Invoice = { id: string; amount: number; currency: string; status: string; invoice_url: string | null; created_at: string };

function UpgradeModal({ plan, onClose, onCheckout }: { plan: typeof PLANS[0]; onClose: () => void; onCheckout: (planId: string) => void }) {
  const [loading, setLoading] = useState(false);
  const confirm = async () => {
    setLoading(true);
    await onCheckout(plan.id);
    setLoading(false);
    onClose();
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--card-bg)', borderRadius: 20, width: '100%', maxWidth: 400, padding: 28, boxShadow: '0 24px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Passer au plan {plan.name}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ background: 'var(--body-bg)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>{plan.price}€<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)' }}>/mois</span></div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {plan.features.slice(0, 4).map(f => (
              <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                <CheckCircle size={13} color="var(--color-primary)" />{f}
              </li>
            ))}
          </ul>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Vous serez redirigé vers Stripe pour finaliser le paiement en sécurité.</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>Annuler</button>
          <button onClick={confirm} disabled={loading} style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'var(--color-primary)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Redirection…' : 'Confirmer →'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BillingPage() {
  const [upgrading, setUpgrading] = useState<typeof PLANS[0] | null>(null);

  const { data: sub, isLoading: subLoading } = useQuery<SubscriptionData>({
    queryKey: ['billing-subscription'],
    queryFn: () => apiClient.get('/billing/subscription') as Promise<SubscriptionData>,
    staleTime: 30_000,
  });

  const { data: usage = {} } = useQuery<UsageData>({
    queryKey: ['billing-usage'],
    queryFn: () => apiClient.get('/billing/usage') as Promise<UsageData>,
    staleTime: 60_000,
  });

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ['billing-invoices'],
    queryFn: () => apiClient.get('/billing/invoices') as Promise<Invoice[]>,
    staleTime: 60_000,
  });

  const checkoutMut = useMutation({
    mutationFn: (plan: string) => apiClient.post('/billing/checkout', { plan }) as Promise<{ url: string }>,
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
      else toast.success('Plan mis à jour');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const portalMut = useMutation({
    mutationFn: () => apiClient.post('/billing/portal', {}) as Promise<{ url: string }>,
    onSuccess: (data) => { if (data.url) window.location.href = data.url; },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleCheckout = async (planId: string) => {
    if (!sub?.stripe_configured) {
      toast.info('Stripe non configuré — mode simulation');
      return;
    }
    await checkoutMut.mutateAsync(planId);
  };

  const currentPlan = sub?.plan ?? 'pro';
  const planData = PLANS.find(p => p.id === currentPlan) ?? PLANS[1];
  const renewDate = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); d.setDate(1); return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); })();

  return (
    <div style={{ padding: 24, maxWidth: 920, margin: '0 auto' }}>
      {upgrading && <UpgradeModal plan={upgrading} onClose={() => setUpgrading(null)} onCheckout={handleCheckout} />}

      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Facturation</h1>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>Gérez votre abonnement et vos informations de paiement</p>

      {!sub?.stripe_configured && (
        <div style={{ padding: '12px 16px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertCircle size={16} color="#F59E0B" />
          <span style={{ fontSize: 13, color: '#B45309' }}>Stripe non configuré — les actions de facturation sont en mode simulation. Ajoutez <code>STRIPE_SECRET_KEY</code> pour activer les paiements réels.</span>
        </div>
      )}

      {/* Plan banner */}
      <div style={{ borderRadius: 16, padding: 24, marginBottom: 20, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ color: 'rgba(255,255,255,.7)', fontSize: 13, margin: '0 0 4px' }}>Plan actuel</p>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>
            {planData.name} · {planData.price}€/mois
          </h2>
          <p style={{ color: 'rgba(255,255,255,.7)', fontSize: 13, margin: 0 }}>Renouvellement le {renewDate}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {sub?.stripe_configured && (
            <button onClick={() => portalMut.mutate()} disabled={portalMut.isPending} style={{ padding: '8px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
              {portalMut.isPending ? '…' : 'Gérer l\'abonnement'}
            </button>
          )}
          <Crown size={48} color="rgba(255,255,255,.35)" />
        </div>
      </div>

      {/* Usage */}
      <div style={{ borderRadius: 16, border: '1px solid var(--card-border)', background: 'var(--card-bg)', padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', margin: 0 }}>Utilisation ce mois</h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Réinitialisé le 1er du mois</span>
        </div>
        {Object.keys(usage).length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Aucune donnée d'utilisation disponible.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {Object.entries(usage).map(([key, u]) => {
              const meta = USAGE_LABELS[key] ?? { label: key, icon: <TrendingUp size={14} /> };
              const warn = u.limit !== -1 && u.percent >= 80;
              return (
                <div key={key}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                      {meta.icon}{meta.label}
                    </div>
                    <div style={{ fontSize: 12, color: warn ? '#D97706' : 'var(--text-muted)', fontWeight: 500 }}>
                      {u.used.toLocaleString('fr-FR')} / {u.limit === -1 ? '∞' : u.limit.toLocaleString('fr-FR')}
                    </div>
                  </div>
                  <div style={{ height: 6, borderRadius: 9999, background: 'var(--body-bg)', overflow: 'hidden' }}>
                    {u.limit === -1
                      ? <div style={{ height: '100%', background: '#DCFCE7', width: '100%' }} />
                      : <div style={{ height: '100%', borderRadius: 9999, background: warn ? '#F59E0B' : 'var(--color-primary)', width: `${u.percent}%`, transition: 'width .4s' }} />
                    }
                  </div>
                  {warn && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#D97706', marginTop: 4 }}>
                      <AlertCircle size={11} />{u.percent}% utilisé — envisagez un upgrade
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Plans */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        {PLANS.map(plan => {
          const isCurrent = plan.id === currentPlan;
          return (
            <div key={plan.id} style={{ borderRadius: 16, border: `2px solid ${isCurrent ? 'var(--color-primary)' : 'var(--card-border)'}`, background: 'var(--card-bg)', padding: 20, boxShadow: isCurrent ? '0 4px 20px rgba(0,0,0,.08)' : 'none' }}>
              {isCurrent && (
                <div style={{ fontSize: 11, background: 'var(--color-primary)', color: '#fff', padding: '2px 10px', borderRadius: 9999, display: 'inline-block', marginBottom: 10, fontWeight: 600 }}>Plan actuel</div>
              )}
              <h3 style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-primary)', margin: '0 0 4px' }}>{plan.name}</h3>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', margin: '4px 0' }}>
                {plan.price}€<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)' }}>/mois</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px' }}>{plan.desc}</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {plan.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <CheckCircle size={13} color="var(--color-primary)" />{f}
                  </li>
                ))}
              </ul>
              <button
                disabled={isCurrent}
                onClick={() => !isCurrent && setUpgrading(plan)}
                style={{ width: '100%', padding: '9px', borderRadius: 10, border: `1px solid ${isCurrent ? 'var(--color-primary)' : 'var(--card-border)'}`, background: isCurrent ? 'var(--color-primary-light)' : 'transparent', color: isCurrent ? 'var(--color-primary)' : 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: isCurrent ? 'default' : 'pointer' }}>
                {isCurrent ? 'Plan actuel' : 'Passer à ce plan →'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Payment method */}
      <div style={{ borderRadius: 16, border: '1px solid var(--card-border)', background: 'var(--card-bg)', padding: 20, marginBottom: 16 }}>
        <h2 style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 14 }}>Moyen de paiement</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, border: '1px solid var(--card-border)', background: 'var(--body-bg)' }}>
          <CreditCard size={20} color="var(--text-secondary)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
              {sub?.stripe_configured ? 'Géré via Stripe' : 'Stripe non configuré'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {sub?.stripe_configured ? 'Cliquez sur "Gérer l\'abonnement" pour modifier' : 'Ajoutez STRIPE_SECRET_KEY pour activer'}
            </div>
          </div>
          {sub?.stripe_configured && (
            <button onClick={() => portalMut.mutate()} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
              Modifier
            </button>
          )}
        </div>
      </div>

      {/* Invoices */}
      <div style={{ borderRadius: 16, border: '1px solid var(--card-border)', background: 'var(--card-bg)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--card-border)', background: 'var(--body-bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Historique des factures</span>
        </div>
        {invoices.length === 0 ? (
          <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Aucune facture disponible.</div>
        ) : invoices.map(inv => (
          <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', borderBottom: '1px solid var(--card-border)' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CheckCircle size={14} color="#22C55E" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--text-primary)' }}>{inv.id.slice(0, 16)}…</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(inv.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
              {(inv.amount / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {inv.currency.toUpperCase()}
            </span>
            <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 9999, background: '#ECFDF5', color: '#059669', fontWeight: 500 }}>
              {inv.status}
            </span>
            {inv.invoice_url && (
              <a href={inv.invoice_url} target="_blank" rel="noopener noreferrer"
                style={{ padding: 6, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                <Download size={14} />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
