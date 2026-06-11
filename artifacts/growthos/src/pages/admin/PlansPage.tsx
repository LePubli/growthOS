import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CreditCard, Plus, Pencil, Trash2, Check, X, Loader2,
  Users, Mail, Zap, ArrowRightLeft, Star, TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';

/* ─── Types ─── */
interface Plan {
  id: string; name: string; displayName: string; description: string;
  priceMonthly: number; priceYearly: number; features: string[];
  limits: Record<string, number>; isActive: boolean; isDefault: boolean;
  stripePriceId?: string;
}
interface Tenant { id: string; name: string; slug: string; plan: string; planId?: string; planDisplayName?: string; }

const LIMIT_LABELS: Record<string, string> = {
  users: 'Utilisateurs', prospects: 'Prospects', sequences: 'Séquences',
  emails_per_month: 'Emails/mois', enrichments_per_month: 'Enrichissements/mois',
  signals_per_month: 'Signaux/mois',
};

function formatPrice(cents: number) {
  if (cents === 0) return 'Gratuit';
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}
function formatLimit(val: number) { return val === -1 ? '∞' : val.toLocaleString('fr-FR'); }

const PLAN_COLORS: Record<string, string> = { starter: '#6B7280', pro: '#2563EB', enterprise: '#7C3AED' };

/* ─── Modal Plan ─── */
function PlanModal({ plan, onClose }: { plan?: Plan; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!plan;
  const [form, setForm] = useState({
    name: plan?.name ?? '',
    displayName: plan?.displayName ?? '',
    description: plan?.description ?? '',
    priceMonthly: plan?.priceMonthly ?? 0,
    priceYearly: plan?.priceYearly ?? 0,
    stripePriceId: plan?.stripePriceId ?? '',
    features: (plan?.features ?? []).join('\n'),
    limits: JSON.stringify(plan?.limits ?? { users: 5, prospects: 1000, emails_per_month: 5000 }, null, 2),
  });
  const [limitsError, setLimitsError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: typeof form) => {
      let limits: Record<string, number>;
      try { limits = JSON.parse(data.limits); } catch { throw new Error('Limites JSON invalide'); }
      const payload = {
        name: data.name, displayName: data.displayName, description: data.description,
        priceMonthly: Number(data.priceMonthly), priceYearly: Number(data.priceYearly),
        stripePriceId: data.stripePriceId || undefined,
        features: data.features.split('\n').map(f => f.trim()).filter(Boolean),
        limits,
      };
      return isEdit ? apiClient.patch(`/admin/plans/${plan!.id}`, payload) : apiClient.post('/admin/plans', payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-plans'] }); toast.success(isEdit ? 'Plan modifié' : 'Plan créé'); onClose(); },
    onError: (e: any) => toast.error(e?.error ?? e?.message ?? 'Erreur'),
  });

  const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' as const };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 32, width: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{isEdit ? 'Modifier le plan' : 'Créer un plan'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Identifiant * (ex: pro)</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="pro" disabled={isEdit} style={{ ...inputStyle, opacity: isEdit ? 0.5 : 1 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Nom affiché *</label>
              <input value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} placeholder="Pro" style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Description</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description du plan" style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Prix mensuel (centimes) *</label>
              <input type="number" value={form.priceMonthly} onChange={e => setForm(f => ({ ...f, priceMonthly: Number(e.target.value) }))} placeholder="4900" style={inputStyle} />
              <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>{formatPrice(Number(form.priceMonthly))}/mois</p>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Prix annuel (centimes)</label>
              <input type="number" value={form.priceYearly} onChange={e => setForm(f => ({ ...f, priceYearly: Number(e.target.value) }))} placeholder="49000" style={inputStyle} />
              <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>{formatPrice(Number(form.priceYearly))}/an</p>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Stripe Price ID (optionnel)</label>
            <input value={form.stripePriceId} onChange={e => setForm(f => ({ ...f, stripePriceId: e.target.value }))} placeholder="price_..." style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Features (une par ligne)</label>
            <textarea value={form.features} onChange={e => setForm(f => ({ ...f, features: e.target.value }))} rows={5} placeholder="500 prospects&#10;3 séquences email&#10;Support email" style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Limites (JSON) — -1 = illimité</label>
            <textarea
              value={form.limits}
              onChange={e => { setForm(f => ({ ...f, limits: e.target.value })); try { JSON.parse(e.target.value); setLimitsError(''); } catch { setLimitsError('JSON invalide'); } }}
              rows={6}
              style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }} />
            {limitsError && <p style={{ margin: '3px 0 0', fontSize: 11, color: '#DC2626' }}>{limitsError}</p>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>Annuler</button>
          <button onClick={() => mutation.mutate(form)} disabled={mutation.isPending || !!limitsError || !form.name || !form.displayName}
            style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {isEdit ? 'Enregistrer' : 'Créer le plan'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Page principale ─── */
export default function PlansPage() {
  const qc = useQueryClient();
  const [planModal, setPlanModal] = useState<{ open: boolean; plan?: Plan }>({ open: false });
  const [changePlanTenant, setChangePlanTenant] = useState('');
  const [changePlanId, setChangePlanId] = useState('');

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ['admin-plans'],
    queryFn: () => apiClient.get('/admin/plans?all=true') as Promise<Plan[]>,
    staleTime: 60_000,
  });

  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ['admin-tenants'],
    queryFn: () => apiClient.get('/admin/tenants') as Promise<Tenant[]>,
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/plans/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-plans'] }); toast.success('Plan désactivé'); },
    onError: (e: any) => toast.error(e?.error ?? 'Erreur'),
  });

  const changePlanMutation = useMutation({
    mutationFn: ({ tenantId, planId }: { tenantId: string; planId: string }) =>
      apiClient.post('/admin/plans/change', { tenantId, planId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-tenants'] });
      toast.success('Plan changé avec succès');
      setChangePlanTenant('');
      setChangePlanId('');
    },
    onError: (e: any) => toast.error(e?.error ?? 'Erreur'),
  });

  const activePlans = plans.filter(p => p.isActive);
  const inactivePlans = plans.filter(p => !p.isActive);

  return (
    <div style={{ padding: 28, maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <CreditCard size={22} /> Plans d'abonnement
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            {activePlans.length} plan{activePlans.length !== 1 ? 's' : ''} actif{activePlans.length !== 1 ? 's' : ''} · {tenants.length} tenant{tenants.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setPlanModal({ open: true })}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
          <Plus size={16} /> Nouveau plan
        </button>
      </div>

      {/* Plans grid */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}><Loader2 size={28} className="animate-spin" /></div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20, marginBottom: 32 }}>
            {activePlans.map(plan => {
              const color = PLAN_COLORS[plan.name] ?? '#6B7280';
              return (
                <div key={plan.id} style={{ background: 'var(--card-bg)', borderRadius: 16, border: `2px solid ${plan.isDefault ? color : 'var(--card-border)'}`, padding: 24, position: 'relative' }}>
                  {plan.isDefault && (
                    <span style={{ position: 'absolute', top: 12, right: 12, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: color + '20', color, textTransform: 'uppercase' }}>
                      <Star size={9} style={{ verticalAlign: 'middle', marginRight: 3 }} />Défaut
                    </span>
                  )}

                  <div style={{ marginBottom: 16 }}>
                    <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color }}>
                      {plan.displayName}
                    </h3>
                    <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-muted)' }}>{plan.description}</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>{formatPrice(plan.priceMonthly)}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>/mois</span>
                    </div>
                    {plan.priceYearly > 0 && (
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>{formatPrice(plan.priceYearly)}/an</p>
                    )}
                  </div>

                  {/* Limites */}
                  <div style={{ background: 'var(--body-bg)', borderRadius: 10, padding: 12, marginBottom: 14 }}>
                    <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Limites</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {Object.entries(plan.limits).map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{LIMIT_LABELS[k] ?? k}</span>
                          <span style={{ fontWeight: 700, color: v === -1 ? '#059669' : 'var(--text-primary)' }}>{formatLimit(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Features */}
                  <ul style={{ margin: '0 0 16px', padding: '0 0 0 0', listStyle: 'none' }}>
                    {plan.features.slice(0, 5).map((f, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                        <Check size={12} style={{ color: '#059669', flexShrink: 0 }} />{f}
                      </li>
                    ))}
                    {plan.features.length > 5 && <li style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 18 }}>+{plan.features.length - 5} autres</li>}
                  </ul>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setPlanModal({ open: true, plan })}
                      style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13 }}>
                      <Pencil size={13} /> Modifier
                    </button>
                    {!plan.isDefault && (
                      <button onClick={() => { if (confirm(`Désactiver le plan "${plan.displayName}" ?`)) deleteMutation.mutate(plan.id); }}
                        style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #FCA5A5', background: '#FEF2F2', cursor: 'pointer', color: '#DC2626' }}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Plans désactivés */}
          {inactivePlans.length > 0 && (
            <div style={{ marginBottom: 32, opacity: 0.6 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>PLANS DÉSACTIVÉS ({inactivePlans.length})</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {inactivePlans.map(p => (
                  <div key={p.id} style={{ padding: '8px 16px', borderRadius: 8, border: '1px dashed var(--card-border)', fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {p.displayName}
                    <button onClick={() => setPlanModal({ open: true, plan: p })}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                      <Pencil size={11} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Section changement de plan */}
      <div style={{ background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--card-border)', padding: 24 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ArrowRightLeft size={18} /> Changer le plan d'un tenant
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Tenant</label>
            <select value={changePlanTenant} onChange={e => setChangePlanTenant(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 14 }}>
              <option value="">Sélectionner un tenant…</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.plan})</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Nouveau plan</label>
            <select value={changePlanId} onChange={e => setChangePlanId(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 14 }}>
              <option value="">Sélectionner un plan…</option>
              {activePlans.map(p => (
                <option key={p.id} value={p.id}>{p.displayName} — {formatPrice(p.priceMonthly)}/mois</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => { if (changePlanTenant && changePlanId) changePlanMutation.mutate({ tenantId: changePlanTenant, planId: changePlanId }); }}
            disabled={!changePlanTenant || !changePlanId || changePlanMutation.isPending}
            style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
            {changePlanMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Appliquer
          </button>
        </div>

        {/* Liste des tenants avec leur plan */}
        {tenants.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>TENANTS ACTUELS</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {tenants.map(t => {
                const color = PLAN_COLORS[t.plan] ?? '#6B7280';
                return (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--body-bg)', borderRadius: 8, fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</span>
                    <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: color + '20', color }}>{t.planDisplayName ?? t.plan}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {planModal.open && <PlanModal plan={planModal.plan} onClose={() => setPlanModal({ open: false })} />}
    </div>
  );
}
