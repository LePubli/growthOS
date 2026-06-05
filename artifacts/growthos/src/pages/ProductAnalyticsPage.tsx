import { useQuery } from '@tanstack/react-query';
import { BarChart2, TrendingUp, Users, Target, Zap, Activity, Clock, ArrowUpRight } from 'lucide-react';
import apiClient from '@/lib/api-client';

export default function ProductAnalyticsPage() {
  const { data: dashboard } = useQuery({
    queryKey: ['analytics-dashboard'],
    queryFn: () => apiClient.get('/dashboard') as Promise<any>,
    staleTime: 60_000,
  });
  const { data: analyticsData } = useQuery({
    queryKey: ['analytics-data'],
    queryFn: () => apiClient.get('/analytics/overview') as Promise<any>,
    staleTime: 60_000,
  });
  const { data: auditStats } = useQuery({
    queryKey: ['audit-stats-analytics', '30'],
    queryFn: () => apiClient.get('/collaboration/audit-logs/stats?days=30') as Promise<any>,
    staleTime: 60_000,
  });
  const { data: tasks } = useQuery({
    queryKey: ['tasks-analytics'],
    queryFn: () => apiClient.get('/tasks?limit=200') as Promise<any>,
    staleTime: 60_000,
  });
  const { data: sequences } = useQuery({
    queryKey: ['sequences-analytics'],
    queryFn: () => apiClient.get('/sequences') as Promise<any>,
    staleTime: 60_000,
  });
  const { data: revenueKPIs } = useQuery({
    queryKey: ['revenue-kpis-analytics'],
    queryFn: () => apiClient.get('/revenue/kpis') as Promise<any>,
    staleTime: 60_000,
  });

  const prospects = dashboard?.prospects ?? {};
  const deals = dashboard?.deals ?? {};
  const signals = dashboard?.signals ?? {};

  const tasksList: any[] = tasks?.tasks ?? [];
  const tasksDone = tasksList.filter(t => t.status === 'done').length;
  const tasksTodo = tasksList.filter(t => t.status === 'todo' || t.status === 'in_progress').length;
  const taskRate = tasksList.length > 0 ? Math.round((tasksDone / tasksList.length) * 100) : 0;

  const seqList: any[] = Array.isArray(sequences) ? sequences : (sequences?.sequences ?? []);
  const activeSeqs = seqList.filter(s => s.status === 'active').length;

  const topActions: any[] = auditStats?.byAction ?? [];
  const topEntities: any[] = auditStats?.byEntity ?? [];

  const conversionRate = prospects.total > 0 ? Math.round(((deals.won ?? 0) / prospects.total) * 100 * 10) / 10 : 0;

  const KPIS = [
    { label: 'Prospects total', value: prospects.total ?? '—', icon: <Users size={18} />, color: '#8B5CF6', sub: `+${prospects.new ?? 0} ce mois` },
    { label: 'Pipeline actif', value: revenueKPIs?.pipeline ? `${(Number(revenueKPIs.pipeline) / 1000).toFixed(0)}k€` : `${((deals.totalValue ?? 0) / 1000).toFixed(0)}k€`, icon: <TrendingUp size={18} />, color: '#059669', sub: `${deals.total ?? 0} deals ouverts` },
    { label: 'Deals gagnés', value: deals.won ?? '—', icon: <Target size={18} />, color: '#10B981', sub: `Taux de conversion ${conversionRate}%` },
    { label: 'Séquences actives', value: activeSeqs, icon: <Zap size={18} />, color: '#F59E0B', sub: `${seqList.length} séquences total` },
    { label: 'Tâches terminées', value: `${tasksDone}/${tasksList.length}`, icon: <Activity size={18} />, color: '#3B82F6', sub: `${taskRate}% de complétion` },
    { label: 'Signaux captés', value: signals.total ?? '—', icon: <BarChart2 size={18} />, color: '#EF4444', sub: `${signals.unread ?? 0} non lus` },
  ];

  const FEATURES_USAGE = [
    { name: 'Prospects', usage: prospects.total ?? 0, max: 5000, color: '#8B5CF6' },
    { name: 'Deals pipeline', usage: deals.total ?? 0, max: 500, color: '#059669' },
    { name: 'Séquences', usage: seqList.length, max: 50, color: '#F59E0B' },
    { name: 'Tâches', usage: tasksList.length, max: 1000, color: '#3B82F6' },
    { name: 'Signaux', usage: signals.total ?? 0, max: 2000, color: '#EF4444' },
    { name: 'Actions audit', usage: auditStats?.total ?? 0, max: 10000, color: '#10B981' },
  ];

  const FUNNEL = [
    { stage: 'Prospects identifiés', value: prospects.total ?? 0, color: '#8B5CF6' },
    { stage: 'Contactés', value: prospects.contacted ?? Math.round((prospects.total ?? 0) * 0.6), color: '#3B82F6' },
    { stage: 'Qualifiés', value: prospects.qualified ?? Math.round((prospects.total ?? 0) * 0.3), color: '#F59E0B' },
    { stage: 'En proposition', value: deals.total ?? 0, color: '#F97316' },
    { stage: 'Deals gagnés', value: deals.won ?? 0, color: '#10B981' },
  ];
  const funnelMax = FUNNEL[0].value || 1;

  return (
    <div style={{ padding: 24, maxWidth: 1300, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <BarChart2 size={22} style={{ color: '#8B5CF6' }} /> Product Analytics
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Vue produit de l'usage et de la performance de GrowthOS</p>
      </div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
        {KPIS.map(k => (
          <div key={k.label} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '18px 20px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${k.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: k.color, flexShrink: 0 }}>{k.icon}</div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 4 }}>{k.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{k.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Conversion funnel */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={15} style={{ color: '#059669' }} />Funnel de conversion
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {FUNNEL.map((f, i) => (
              <div key={f.stage}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{f.stage}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>{f.value.toLocaleString()}</span>
                </div>
                <div style={{ height: 10, background: 'var(--body-bg)', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: f.color, borderRadius: 5, width: `${Math.max(2, (f.value / funnelMax) * 100)}%`, transition: 'width .5s' }} />
                </div>
                {i < FUNNEL.length - 1 && FUNNEL[i + 1].value > 0 && f.value > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, textAlign: 'right' }}>
                    → {Math.round((FUNNEL[i + 1].value / f.value) * 100)}% passent à l'étape suivante
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Feature usage */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={15} style={{ color: '#3B82F6' }} />Usage des fonctionnalités
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {FEATURES_USAGE.map(f => (
              <div key={f.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{f.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{f.usage.toLocaleString()} / {f.max.toLocaleString()}</span>
                </div>
                <div style={{ height: 8, background: 'var(--body-bg)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: f.color, borderRadius: 4, width: `${Math.min(100, Math.max(2, (f.usage / f.max) * 100))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Activity heatmap (simplified) */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={15} style={{ color: '#F59E0B' }} />Actions les plus fréquentes (30j)
          </div>
          {topActions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 12 }}>Aucune action enregistrée</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topActions.map((a: any, i: number) => (
                <div key={a.action} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: '#EDE9FE', color: '#7C3AED', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{a.action}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{Number(a.count).toLocaleString()}</span>
                    </div>
                    <div style={{ height: 5, background: 'var(--body-bg)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: '#8B5CF6', borderRadius: 3, width: `${Math.max(4, (Number(a.count) / Math.max(1, Number(topActions[0]?.count))) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Entity breakdown */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ArrowUpRight size={15} style={{ color: '#10B981' }} />Entités les plus actives (30j)
          </div>
          {topEntities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 12 }}>Aucune donnée d'audit disponible</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topEntities.map((e: any) => {
                const pct = Math.max(4, (Number(e.count) / Math.max(1, Number(topEntities[0]?.count))) * 100);
                return (
                  <div key={e.entity_type} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 18, width: 28 }}>
                      {e.entity_type === 'prospect' ? '👤' : e.entity_type === 'deal' ? '💼' : e.entity_type === 'signal' ? '📡' : e.entity_type === 'task' ? '✅' : e.entity_type === 'sequence' ? '📧' : '📌'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{e.entity_type}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{Number(e.count).toLocaleString()}</span>
                      </div>
                      <div style={{ height: 5, background: 'var(--body-bg)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: '#10B981', borderRadius: 3, width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 20, padding: '12px 14px', background: '#F0FDF4', borderRadius: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#065F46', marginBottom: 4 }}>🎯 Taux d'activation</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 8, background: '#D1FAE5', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#059669', borderRadius: 4, width: `${Math.min(100, taskRate)}%` }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#059669' }}>{taskRate}%</span>
            </div>
            <div style={{ fontSize: 11, color: '#059669', marginTop: 4 }}>des tâches complétées · {tasksDone} sur {tasksList.length}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
