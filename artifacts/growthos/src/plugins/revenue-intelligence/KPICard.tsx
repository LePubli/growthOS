import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPICardProps {
  label: string;
  value: string;
  subValue?: string;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  accentColor: string;
  accentBg: string;
  loading?: boolean;
}

export function KPICard({
  label, value, subValue, change, changeLabel,
  icon, accentColor, accentBg, loading = false,
}: KPICardProps) {
  const pct = change !== undefined ? Math.abs(change) : null;
  const isPositive = (change ?? 0) >= 0;
  const isNeutral = change === 0 || change === undefined;

  return (
    <div style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--card-border)',
      borderRadius: 16,
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      transition: 'box-shadow 0.15s',
      cursor: 'default',
    }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.07)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.02em' }}>
          {label}
        </span>
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: accentBg, color: accentColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {icon}
        </div>
      </div>

      {loading ? (
        <div style={{ height: 32, borderRadius: 6, background: 'var(--card-border)', animation: 'pulse 1.5s infinite' }} />
      ) : (
        <div>
          <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1 }}>
            {value}
          </div>
          {subValue && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{subValue}</div>
          )}
        </div>
      )}

      {pct !== null && !loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 11, fontWeight: 700,
            color: isNeutral ? 'var(--text-muted)' : isPositive ? '#059669' : '#DC2626',
          }}>
            {isNeutral ? <Minus size={11} /> : isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {isNeutral ? '—' : `${isPositive ? '+' : '-'}${pct}%`}
          </span>
          {changeLabel && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{changeLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
