import { useQuery } from '@tanstack/react-query';
import { BarChart2, TrendingUp, Users, Target, Zap, Activity, Clock, ArrowUpRight } from 'lucide-react';
import apiClient from '@/lib/api-client';

function Skeleton({ w = '100%', h = 20, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{ width: w, height: h, borderRadius: r, background: 'linear-gradient(90deg,var(--card-border) 25%,var(--body-bg) 50%,var(--card-border) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
  );
}

export default function ProductAnalyticsPage() {
  const { data: overview, isLoading: ovLoading } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: () => apiClient.get('/analytics/overview') as Promise<any>,
    staleTime: 60_000,
  });

  const { data: funnelData, isLoading: fnLoading } = useQuery({
    queryKey: ['analytics-funnel'],
    queryFn: () => apiClient.get('/analytics/funnel') as Promise<any>,
    staleTime: 60_000,
  });

  const { data: usageData, isLoading: usLoading } = useQuery({
    queryKey: ['analytics-usage'],
    queryFn: () => apiClient.get('/analytics/usage') as Promise<any>,
    staleTime: 60_000,
  });

  const { data: actionsData, isLoading: acLoading } = useQuery({
    queryKey: ['analytics-actions'],
    queryFn: () => apiClient.get('/analytics/actions-frequent') as Promise<any>,
    staleTime: 60_000,
  });

  const { data: entitiesData, isLoading: enLoading } = useQuery({
    queryKey: ['analytics-entities'],
    queryFn: () => apiClient.get('/analytics/entities-active') as Promise<any>,
    staleTime: 60_000,
  });

  const isLoading = ovLoading || fnLoading || usLoading || acLoading || enLoading;

  const ov = overview ?? {};
  const seqTotal = ov.sequences?.total ?? 0;
  const seqActive = ov.sequences?.active ?? 0;
  const tasks: any[] = ov.tasksByStatus ?? [];
  const taskDone = tasks.find((t: any) => t.status === 'done')?.count ?? 0;
  const taskTotal = tasks.reduce((s: number, t: any) => s + Number(t.count), 0);
  const taskRate = taskTotal > 0 ? Math.round((Number(taskDone) / taskTotal) * 100) : 0;

  const prospects = ov.prospects ?? null;
  const deals = ov.deals ?? null;
  const signals = ov.signals ?? null;

  const wonDeals = (ov.dealsByStage ?? []).find((d: any) => d.stage === 'won')?.count ?? 0;
  const convRate = prospects > 0 ? Math.round((wonDeals / prospects) * 100 * 10) / 10 : 0;
  const pipelineVal = (ov.dealsByStage ?? [])
    .filter((d: any) => !['won', 'lost'].includes(d.stage))
    .reduce((s: number, d: any) => s + Number(d.value || 0), 0);

  const KPIS = [
    { label: 'Prospects total', value: prospects !== null ? prospects : null, icon: <Users size={18} />, color: '#8B5CF6', sub: `${seqActive} séquences actives` },
    { label: 'Pipeline actif', value: pipelineVal !== null ? `${(pipelineVal / 1000).toFixed(0)}k€` : null, icon: <TrendingUp size={18} />, color: '#059669', sub: `${deals ?? 0} deals ouverts` },
    { label: 'Deals gagnés', value: wonDeals !== null ? wonDeals : null, icon: <Target size={18} />, color: '#10B981', sub: `Taux conversion ${convRate}%` },
    { label: 'Séquences actives', value: seqActive !== null ? seqActive : null, icon: <Zap size={18} />, color: '#F59E0B', sub: `${seqTotal} séquences total` },
    { label: 'Tâches terminées', value: taskTotal > 0 ? `${taskDone}/${taskTotal}` : null, icon: <Activity size={18} />, color: '#3B82F6', sub: `${taskRate}% de complétion` },
    { label: 'Signaux captés', value: signals !== null ? signals : null, icon: <BarChart2 size={18} />, color: '#EF4444', sub: `Signaux d'intention` },
  ];

  const resources: any[] = usageData?.resources ?? [];

  const funnel: any[] = funnelData?.funnel ?? [];
  const STAGE_LABELS: Record<string, string> = {
    lead: 'Lead', qualified: 'Qualifié', proposal: 'Proposition',
    negotiation: 'Négociation', won: 'Gagné', lost: 'Perdu',
  };
  const funnelFiltered = funnel.filter(f => f.stage !== 'lost');
  const funnelMax = Math.max(...funnelFiltered.map(f => f.count), 1);

  const topActions: any[] = actionsData?.actions ?? [];
  const topEntities: any[] = entitiesData?.entities ?? [];

  return (
    <div style={{ padding: 24, maxWidth: 1300, margin: '0 auto' }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>

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
            <div style={{ flex: 1 }}>
              {isLoading ? (
                <><Skeleton h={28} w={80} r={6} /><div style={{ marginTop: 6 }}><Skeleton h={12} w="70%" /></div></>
              ) : k.value === null ? (
                <><div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-muted)', lineHeight: 1 }}>—</div><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 4 }}>{k.label}</div></>
              ) : (
                <>
                  <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>{k.value}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 4 }}>{k.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{k.sub}</div>
                </>
              )}
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
          {fnLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1,2,3,4,5].map(i => <Skeleton key={i} h={20} />)}
            </div>
          ) : funnelFiltered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
              Aucune donnée — créez des deals pour voir le funnel
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {funnelFiltered.map((f: any, i: number) => (
                <div key={f.stage}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{STAGE_LABELS[f.stage] ?? f.stage}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>{Number(f.count).toLocaleString('fr-FR')}</span>
                  </div>
                  <div style={{ height: 10, background: 'var(--body-bg)', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#8B5CF6', borderRadius: 5, width: `${Math.max(2, (f.count / funnelMax) * 100)}%`, transition: 'width .5s' }} />
                  </div>
                  {i < funnelFiltered.length - 1 && funnelFiltered[i + 1].count > 0 && f.count > 0 && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, textAlign: 'right' }}>
                      → {Math.round((funnelFiltered[i + 1].count / f.count) * 100)}% à l'étape suivante
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Feature usage */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={15} style={{ color: '#3B82F6' }} />Usage des fonctionnalités
          </div>
          {usLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[1,2,3,4,5,6].map(i => <Skeleton key={i} h={16} />)}
            </div>
          ) : resources.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>Aucune donnée</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {resources.map((f: any) => (
                <div key={f.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{f.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{Number(f.used).toLocaleString('fr-FR')} / {Number(f.limit).toLocaleString('fr-FR')}</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--body-bg)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: f.pct > 80 ? '#EF4444' : f.pct > 60 ? '#F59E0B' : '#3B82F6', borderRadius: 4, width: `${Math.min(100, Math.max(2, f.pct))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Top actions */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={15} style={{ color: '#F59E0B' }} />Actions les plus fréquentes (30j)
          </div>
          {acLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1,2,3,4,5].map(i => <Skeleton key={i} h={18} />)}
            </div>
          ) : topActions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 12 }}>Aucune action enregistrée</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topActions.map((a: any, i: number) => (
                <div key={`${a.action}-${a.entity_type}`} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: '#EDE9FE', color: '#7C3AED', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                        {a.action}{a.entity_type ? ` · ${a.entity_type}` : ''}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{Number(a.count).toLocaleString('fr-FR')}</span>
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

        {/* Top entities */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ArrowUpRight size={15} style={{ color: '#10B981' }} />Entités les plus actives (30j)
          </div>
          {enLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1,2,3,4,5].map(i => <Skeleton key={i} h={18} />)}
            </div>
          ) : topEntities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 12 }}>Aucune donnée d'audit disponible</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topEntities.map((e: any) => {
                const pct = Math.max(4, (Number(e.event_count) / Math.max(1, Number(topEntities[0]?.event_count))) * 100);
                return (
                  <div key={`${e.entity_type}-${e.entity_id}`} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 18, width: 28, flexShrink: 0 }}>
                      {e.entity_type === 'prospect' ? '👤' : e.entity_type === 'deal' ? '💼' : e.entity_type === 'signal' ? '📡' : e.entity_type === 'task' ? '✅' : e.entity_type === 'sequence' ? '📧' : '📌'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{e.entity_type}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{Number(e.event_count).toLocaleString('fr-FR')} événements</span>
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
            <div style={{ fontSize: 12, fontWeight: 700, color: '#065F46', marginBottom: 4 }}>🎯 Taux d'activation tâches</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 8, background: '#D1FAE5', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#059669', borderRadius: 4, width: `${Math.min(100, taskRate)}%` }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#059669' }}>{taskRate}%</span>
            </div>
            <div style={{ fontSize: 11, color: '#059669', marginTop: 4 }}>
              {taskTotal > 0 ? `${taskDone} sur ${taskTotal} tâches complétées` : 'Aucune tâche'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
