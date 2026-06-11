import { useQuery } from '@tanstack/react-query';
import {
  BarChart2, AlertTriangle, CheckCircle, Loader2,
  Users, Mail, GitBranch, UserCheck, TrendingUp, Zap,
} from 'lucide-react';
import apiClient from '@/lib/api-client';

/* ─── Types ─── */
interface ResourceUsage {
  used: number;
  limit: number;
  percent: number;
  monthly: { used: number; limit: number; percent: number } | null;
}

interface TenantQuota {
  tenantId: string;
  tenantName: string;
  plan: string;
  resources: {
    prospects: ResourceUsage;
    emails: ResourceUsage;
    sequences: ResourceUsage;
    users: ResourceUsage;
    deals: ResourceUsage;
    signals: ResourceUsage;
  };
  alerts: string[];
}

interface QuotaData {
  tenants: TenantQuota[];
  generatedAt: string;
}

/* ─── Helpers ─── */
const RESOURCE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  prospects: { label: 'Prospects',   icon: <Users size={13} />,      color: '#4F46E5' },
  emails:    { label: 'Emails',      icon: <Mail size={13} />,       color: '#059669' },
  sequences: { label: 'Séquences',   icon: <GitBranch size={13} />,  color: '#D97706' },
  users:     { label: 'Utilisateurs', icon: <UserCheck size={13} />, color: '#7C3AED' },
  deals:     { label: 'Deals',       icon: <TrendingUp size={13} />, color: '#2563EB' },
  signals:   { label: 'Signaux',     icon: <Zap size={13} />,        color: '#DC2626' },
};

const PLAN_COLORS: Record<string, string> = {
  starter:    '#6B7280',
  pro:        '#2563EB',
  enterprise: '#7C3AED',
};

function pctColor(pct: number): string {
  if (pct >= 90) return '#DC2626';
  if (pct >= 80) return '#D97706';
  return '#059669';
}

function fmtLimit(limit: number): string {
  if (limit === -1) return '∞';
  return limit.toLocaleString('fr-FR');
}

/* ─── Sub-components ─── */
function ResourceBar({ label, icon, used, limit, percent, color }: {
  label: string; icon: React.ReactNode; used: number; limit: number; percent: number; color: string;
}) {
  const barColor = limit === -1 ? '#6B7280' : pctColor(percent);
  const displayPct = limit === -1 ? null : percent;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>
          <span style={{ color }}>{icon}</span>
          {label}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: displayPct !== null && displayPct >= 80 ? barColor : 'var(--text-primary)' }}>
          {used.toLocaleString('fr-FR')}&thinsp;/&thinsp;{fmtLimit(limit)}
          {displayPct !== null && <span style={{ color: barColor, marginLeft: 4 }}>({displayPct}%)</span>}
        </div>
      </div>
      <div style={{ height: 5, borderRadius: 4, background: 'var(--card-border)', overflow: 'hidden' }}>
        {limit !== -1 ? (
          <div style={{ height: 5, borderRadius: 4, width: `${percent}%`, background: barColor, transition: 'width 0.4s ease' }} />
        ) : (
          <div style={{ height: 5, borderRadius: 4, width: '100%', background: 'repeating-linear-gradient(90deg,#6B728033 0px,#6B728033 6px,transparent 6px,transparent 12px)' }} />
        )}
      </div>
    </div>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const color = PLAN_COLORS[plan.toLowerCase()] ?? '#6B7280';
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 20,
      background: color + '18', color, border: `1px solid ${color}33`,
      textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
      {plan}
    </span>
  );
}

/* ─── Main page ─── */
export default function QuotaMonitoringPage() {
  const { data, isLoading, error, refetch } = useQuery<QuotaData>({
    queryKey: ['admin-quotas'],
    queryFn: () => apiClient.get('/admin/quotas'),
    refetchInterval: 30000,
  });

  const tenants = data?.tenants ?? [];
  const totalAlerts = tenants.reduce((sum, t) => sum + t.alerts.length, 0);
  const tenantsAtRisk = tenants.filter(t => t.alerts.length > 0).length;

  return (
    <div style={{ padding: 28, maxWidth: 1300, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <BarChart2 size={22} color="var(--color-primary)" /> Monitoring des Quotas
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Consommation des ressources par tenant · Mise à jour toutes les 30s
            {data?.generatedAt && ` · ${new Date(data.generatedAt).toLocaleTimeString('fr-FR')}`}
          </p>
        </div>
        <button onClick={() => refetch()}
          style={{ padding: '8px 16px', borderRadius: 10, border: '1.5px solid var(--card-border)', background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <BarChart2 size={13} /> Actualiser
        </button>
      </div>

      {/* Summary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        <div style={{ background: 'var(--card-bg)', border: '1.5px solid var(--card-border)', borderRadius: 14, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>TENANTS ACTIFS</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--text-primary)' }}>{tenants.length}</div>
        </div>
        <div style={{
          background: tenantsAtRisk > 0 ? '#FEF2F2' : 'var(--card-bg)',
          border: `1.5px solid ${tenantsAtRisk > 0 ? '#FECACA' : 'var(--card-border)'}`,
          borderRadius: 14, padding: '16px 20px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: tenantsAtRisk > 0 ? '#DC2626' : 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
            {tenantsAtRisk > 0 ? <AlertTriangle size={11} /> : <CheckCircle size={11} />}
            TENANTS EN ALERTE (≥80%)
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: tenantsAtRisk > 0 ? '#DC2626' : 'var(--text-primary)' }}>{tenantsAtRisk}</div>
          {totalAlerts > 0 && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 2 }}>{totalAlerts} alerte{totalAlerts > 1 ? 's' : ''} au total</div>}
        </div>
        <div style={{ background: 'var(--card-bg)', border: '1.5px solid var(--card-border)', borderRadius: 14, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>PLANS DISTRIBUÉS</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {(['enterprise', 'pro', 'starter'] as const).map(plan => {
              const count = tenants.filter(t => t.plan.toLowerCase() === plan).length;
              if (count === 0) return null;
              return (
                <div key={plan} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PlanBadge plan={plan} />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{count} tenant{count > 1 ? 's' : ''}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Loading / Error */}
      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
          <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} color="var(--color-primary)" />
        </div>
      )}
      {error && (
        <div style={{ textAlign: 'center', padding: 32, color: '#DC2626', fontSize: 13 }}>
          Erreur lors du chargement des quotas.
        </div>
      )}

      {/* Tenants grid */}
      {!isLoading && tenants.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
          {tenants.map(tenant => (
            <div key={tenant.tenantId}
              style={{
                background: tenant.alerts.length > 0 ? '#FFFBEB' : 'var(--card-bg)',
                border: `1.5px solid ${tenant.alerts.length > 0 ? '#FDE68A' : 'var(--card-border)'}`,
                borderRadius: 14, padding: '18px 20px',
              }}>
              {/* Card header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
                    {tenant.tenantName}
                  </div>
                  <PlanBadge plan={tenant.plan} />
                </div>
                {tenant.alerts.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: '#FEF2F2', border: '1px solid #FECACA' }}>
                    <AlertTriangle size={11} color="#DC2626" />
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#DC2626' }}>{tenant.alerts.length} alerte{tenant.alerts.length > 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>

              {/* Alertes */}
              {tenant.alerts.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  {tenant.alerts.map((alert, i) => (
                    <div key={i} style={{ fontSize: 10, color: '#D97706', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                      <AlertTriangle size={9} /> {alert}
                    </div>
                  ))}
                </div>
              )}

              {/* Resource bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(Object.entries(tenant.resources) as [string, ResourceUsage][]).map(([key, res]) => {
                  const meta = RESOURCE_META[key];
                  if (!meta) return null;
                  return (
                    <ResourceBar
                      key={key}
                      label={meta.label}
                      icon={meta.icon}
                      color={meta.color}
                      used={res.used}
                      limit={res.limit}
                      percent={res.percent}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && tenants.length === 0 && !error && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)', fontSize: 14 }}>
          Aucun tenant trouvé.
        </div>
      )}
    </div>
  );
}
