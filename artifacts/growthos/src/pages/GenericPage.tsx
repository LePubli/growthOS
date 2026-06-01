import { useLocation } from 'wouter';

interface GenericPageProps {
  title: string;
  icon: string;
  description?: string;
}

export function GenericPage({ title, icon, description }: GenericPageProps) {
  const [location] = useLocation();
  return (
    <div style={{ minHeight: '100vh', padding: 24, background: 'var(--body-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>{icon}</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>{title}</h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 24px', lineHeight: 1.6 }}>
          {description || 'Cette section est en cours de développement. Elle sera disponible dans une prochaine version.'}
        </p>
        <div style={{ padding: '10px 16px', borderRadius: 10, background: 'var(--card-bg)', border: '1px solid var(--card-border)', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
          Route: {location}
        </div>
      </div>
    </div>
  );
}
