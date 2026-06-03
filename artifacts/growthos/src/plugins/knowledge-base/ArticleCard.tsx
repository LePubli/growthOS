import React from 'react';
import { BookOpen, FileText, ShieldAlert, Mic, HelpCircle, ClipboardList, Tag, Clock } from 'lucide-react';

export interface Article {
  id: string;
  title: string;
  content: string;
  category: 'playbook' | 'objection' | 'script' | 'procedure' | 'faq';
  tags: string[];
  createdBy: string | null;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

const CATEGORY_META: Record<Article['category'], { label: string; icon: React.ReactNode; bg: string; color: string }> = {
  playbook:  { label: 'Playbook',    icon: <BookOpen size={11} />,     bg: '#EDE9FE', color: '#6D28D9' },
  objection: { label: 'Objection',   icon: <ShieldAlert size={11} />,  bg: '#FEF2F2', color: '#DC2626' },
  script:    { label: 'Script',      icon: <Mic size={11} />,          bg: '#EFF6FF', color: '#2563EB' },
  procedure: { label: 'Procédure',   icon: <ClipboardList size={11} />, bg: '#F0FDF4', color: '#16A34A' },
  faq:       { label: 'FAQ',         icon: <HelpCircle size={11} />,   bg: '#FFF7ED', color: '#C2410C' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  return `il y a ${d}j`;
}

interface Props {
  article: Article;
  onClick?: (article: Article) => void;
  selected?: boolean;
}

export function ArticleCard({ article, onClick, selected }: Props) {
  const meta = CATEGORY_META[article.category] ?? CATEGORY_META.faq;
  const snippet = article.content.length > 160 ? article.content.slice(0, 160) + '…' : article.content;

  return (
    <div
      onClick={() => onClick?.(article)}
      style={{
        background: selected ? 'var(--body-bg)' : 'var(--card-bg)',
        border: `1.5px solid ${selected ? 'var(--color-primary)' : 'var(--card-border)'}`,
        borderRadius: 12,
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-primary-faint, #c7d2fe)'; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.borderColor = 'var(--card-border)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.4, flex: 1 }}>
          {article.title}
        </h3>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: meta.bg, color: meta.color, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {meta.icon}{meta.label}
        </span>
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: 1.5 }}>{snippet}</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {article.tags.slice(0, 4).map(tag => (
          <span key={tag} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'var(--body-bg)', color: 'var(--text-muted)', border: '1px solid var(--card-border)' }}>
            <Tag size={9} />{tag}
          </span>
        ))}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)' }}>
          <Clock size={9} />{timeAgo(article.updatedAt)}
        </span>
      </div>
    </div>
  );
}
