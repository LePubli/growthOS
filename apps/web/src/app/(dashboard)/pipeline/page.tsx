'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ChevronRight, Building2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface Stage {
  id: string; name: string; color: string; order_index: number;
  count: number; total_value: number; is_won: boolean; is_lost: boolean;
}

interface Prospect {
  id: string; company_name: string; city?: string;
  propensity_score?: number; propensity_category?: string;
  email?: string; phone?: string; deal_value?: number;
}

interface KanbanData {
  [stageId: string]: Prospect[];
}

const CAT_DOT: Record<string, string> = { HOT: '#DC3545', WARM: '#F0AD4E', COLD: '#017E84' };

export default function PipelinePage() {
  const qc = useQueryClient();
  const [dragging, setDragging] = useState<{ id: string; fromStage: string } | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const { data: stages = [], isLoading: stagesLoading } = useQuery<Stage[]>({
    queryKey: ['pipeline-stages'],
    queryFn: () => apiClient.get('/pipeline'),
  });

  const { data: prospectsData } = useQuery({
    queryKey: ['prospects-all'],
    queryFn: () => apiClient.get<any>('/prospects', { page_size: 500 }),
  });

  const moveMutation = useMutation({
    mutationFn: ({ prospectId, stageId }: { prospectId: string; stageId: string }) =>
      apiClient.post('/pipeline/move', { prospectId, stageId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prospects-all'] }),
    onError: (e: any) => toast.error(e.message),
  });

  // Group prospects by stage
  const kanban: KanbanData = {};
  const prospects: Prospect[] = prospectsData?.items || [];
  stages.forEach(s => { kanban[s.id] = []; });
  prospects.forEach(p => {
    const stageId = (p as any).stage_id;
    if (stageId && kanban[stageId]) kanban[stageId].push(p);
    else if (stages[0]) kanban[stages[0].id]?.push(p);
  });

  const onDragStart = (prospectId: string, stageId: string) => {
    setDragging({ id: prospectId, fromStage: stageId });
  };

  const onDrop = (targetStageId: string) => {
    if (!dragging || dragging.fromStage === targetStageId) { setDragging(null); setDragOver(null); return; }
    moveMutation.mutate({ prospectId: dragging.id, stageId: targetStageId });
    setDragging(null);
    setDragOver(null);
  };

  const totalProspects = stages.reduce((a, s) => a + (s.count || 0), 0);
  const totalValue = stages.filter(s => !s.is_lost).reduce((a, s) => a + (s.total_value || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg-app)' }}>

      {/* Header */}
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', padding: '14px 24px', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Pipeline</h1>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            {totalProspects} prospects · Valeur totale : {totalValue.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/prospects" className="o-btn o-btn-secondary o-btn-sm">
            <Building2 size={13} /> Vue liste
          </a>
        </div>
      </div>

      {/* Kanban */}
      <div style={{ flex: 1, overflow: 'auto', padding: 20, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {stagesLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="o-skeleton" style={{ width: 260, minWidth: 260, height: 400, borderRadius: 8 }} />
          ))
        ) : stages.map(stage => {
          const stageProspects = kanban[stage.id] || [];
          const isDragTarget = dragOver === stage.id;
          return (
            <div key={stage.id}
              style={{ width: 260, minWidth: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}
              onDragOver={e => { e.preventDefault(); setDragOver(stage.id); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => onDrop(stage.id)}
            >
              {/* Stage header */}
              <div style={{
                padding: '10px 14px', borderRadius: 8,
                background: isDragTarget ? 'rgba(1,126,132,.08)' : 'var(--bg-card)',
                border: `2px solid ${isDragTarget ? 'var(--color-primary)' : 'var(--border-color)'}`,
                transition: 'all .15s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{stage.name}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', background: '#F8F9FA', padding: '2px 8px', borderRadius: 20 }}>
                    {stageProspects.length}
                  </span>
                </div>
                {stage.total_value > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {stage.total_value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                  </div>
                )}
              </div>

              {/* Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 100 }}>
                {stageProspects.map(p => (
                  <div key={p.id}
                    draggable
                    onDragStart={() => onDragStart(p.id, stage.id)}
                    style={{
                      background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                      borderRadius: 8, padding: '12px 14px', cursor: 'grab',
                      boxShadow: 'var(--shadow-card)', transition: 'all .15s',
                      borderLeft: `4px solid ${stage.color}`,
                      opacity: dragging?.id === p.id ? 0.5 : 1,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--shadow-md)')}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow = 'var(--shadow-card)')}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <a href={`/prospects/${p.id}`}
                        style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', textDecoration: 'none', lineHeight: 1.3 }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-primary)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}>
                        {p.company_name}
                      </a>
                      {p.propensity_category && (
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: CAT_DOT[p.propensity_category] || '#ccc', flexShrink: 0, marginTop: 3 }} />
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                      {p.city && <span>{p.city}</span>}
                      {p.email && <span style={{ color: 'var(--color-primary)' }}>✉</span>}
                      {p.phone && <span style={{ color: 'var(--color-success)' }}>📞</span>}
                      {p.propensity_score && (
                        <span style={{ marginLeft: 'auto', fontWeight: 700, color: CAT_DOT[p.propensity_category || ''] || 'var(--text-muted)' }}>
                          {Math.round(p.propensity_score)}
                        </span>
                      )}
                    </div>

                    {p.deal_value && (
                      <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: 'var(--color-primary)' }}>
                        {p.deal_value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                      </div>
                    )}
                  </div>
                ))}

                {stageProspects.length === 0 && (
                  <div style={{ padding: '20px', border: '2px dashed var(--border-light)', borderRadius: 8, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                    Glisser un prospect ici
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
