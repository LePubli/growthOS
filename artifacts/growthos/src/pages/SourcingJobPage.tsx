import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { ArrowLeft, CheckCircle, Loader2, AlertCircle, Download, Users, Mail, Building2, Linkedin, ExternalLink, Search } from 'lucide-react';
import { toast } from 'sonner';

const MOCK_RESULTS: Record<string, any> = {
  '1': {
    id: '1', type: 'linkedin', name: 'Directeurs commerciaux Paris', status: 'completed',
    count: 127, duration: '2m 34s', createdAt: '2026-05-31 14:23', query: 'Directeur commercial Paris site:linkedin.com',
    prospects: [
      { name: 'Alexandre Bernard', title: 'Directeur Commercial', company: 'Acme SaaS', email: 'a.bernard@acme.fr', linkedin: 'linkedin.com/in/alexandre-bernard', score: 88 },
      { name: 'Marie Rousseau', title: 'VP Sales France', company: 'TechVision', email: 'marie.rousseau@techvision.fr', linkedin: 'linkedin.com/in/marie-rousseau', score: 92 },
      { name: 'Thomas Leclerc', title: 'Head of Sales', company: 'GrowFast', email: '', linkedin: 'linkedin.com/in/thomas-leclerc', score: 74 },
      { name: 'Camille Petit', title: 'Directrice des Ventes', company: 'CloudPro', email: 'camille@cloudpro.io', linkedin: 'linkedin.com/in/camille-petit', score: 81 },
      { name: 'Nicolas Martin', title: 'Sales Director EMEA', company: 'DataHub', email: 'n.martin@datahub.com', linkedin: '', score: 68 },
    ],
  },
  '2': {
    id: '2', type: 'google', name: 'Agences immobilières Bordeaux', status: 'running',
    count: 45, duration: '1m 12s', createdAt: '2026-05-31 15:10', query: 'agence immobilière Bordeaux Gironde',
    prospects: [
      { name: 'Immobilier Bordeaux Centre', title: '', company: 'Bordeaux Immo', email: 'contact@bdx-immo.fr', linkedin: '', score: 55 },
      { name: 'Agence du Lac', title: '', company: 'Agence du Lac', email: 'info@agence-lac.fr', linkedin: '', score: 62 },
    ],
  },
};

const TYPE_CONFIG: Record<string, { name: string; icon: string }> = {
  linkedin: { name: 'LinkedIn', icon: '💼' },
  google: { name: 'Google Maps', icon: '🗺️' },
  societe_info: { name: 'Societe.info', icon: '🏢' },
  custom: { name: 'Custom', icon: '⚙️' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label: 'Terminé', color: '#059669', bg: '#ECFDF5' },
  running: { label: 'En cours', color: '#2563EB', bg: '#EFF6FF' },
  paused: { label: 'Pausé', color: '#D97706', bg: '#FEF3C7' },
  error: { label: 'Erreur', color: '#DC2626', bg: '#FEF2F2' },
};

export default function SourcingJobPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [job, setJob] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState<Set<string>>(new Set());
  const [imported, setImported] = useState<Set<string>>(new Set());

  useEffect(() => {
    const data = MOCK_RESULTS[params.id || ''] || {
      id: params.id, type: 'linkedin', name: `Scraping #${params.id}`, status: 'completed',
      count: 0, duration: '—', createdAt: '—', query: '—', prospects: [],
    };
    setJob(data);
  }, [params.id]);

  const importProspect = async (name: string) => {
    setImporting(s => new Set([...s, name]));
    await new Promise(r => setTimeout(r, 900));
    setImporting(s => { const n = new Set(s); n.delete(name); return n; });
    setImported(s => new Set([...s, name]));
    toast.success(`${name} importé dans les prospects`);
  };

  const importAll = async () => {
    const toImport = filtered.filter((p: { name: string }) => !imported.has(p.name));
    for (const p of toImport) {
      await importProspect(p.name);
      await new Promise(r => setTimeout(r, 200));
    }
  };

  const exportCSV = () => {
    if (!job) return;
    const rows = [
      ['Nom', 'Titre', 'Entreprise', 'Email', 'LinkedIn', 'Score'],
      ...job.prospects.map((p: any) => [p.name, p.title, p.company, p.email, p.linkedin, p.score]),
    ];
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `scraping_${job.name}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  if (!job) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-primary)' }} />
    </div>
  );

  const type = TYPE_CONFIG[job.type] || { name: job.type, icon: '🔍' };
  const st = STATUS_CONFIG[job.status] || STATUS_CONFIG.completed;
  const filtered = (job.prospects || []).filter((p: { name: string; company: string; title: string }) => {
    const q = search.toLowerCase();
    return !q || `${p.name} ${p.company} ${p.title}`.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: 'var(--body-bg)' }}>
      {/* Back */}
      <button onClick={() => navigate('/sourcing')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', marginBottom: 20, padding: 0 }}>
        <ArrowLeft size={14} />Retour au scraping
      </button>

      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--card-bg)', border: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{type.icon}</div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{job.name}</h1>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 9px', borderRadius: 9999, background: st.bg, color: st.color }}>
                  {job.status === 'running' && <Loader2 size={11} className="animate-spin" style={{ display: 'inline', marginRight: 4 }} />}{st.label}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{type.name}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{job.createdAt}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>⏱ {job.duration}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
              <Download size={13} />Exporter CSV
            </button>
            <button onClick={importAll} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <Users size={13} />Importer tout ({filtered.filter((p: any) => !imported.has(p.name)).length})
            </button>
          </div>
        </div>

        {/* Query */}
        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--card-bg)', border: '1px solid var(--card-border)', fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Search size={13} />
          <span style={{ fontFamily: 'monospace' }}>{job.query}</span>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { l: 'Prospects collectés', v: job.count },
          { l: 'Importés', v: imported.size },
          { l: 'Avec email', v: (job.prospects || []).filter((p: any) => p.email).length },
        ].map((s, i) => (
          <div key={i} style={{ padding: '14px 16px', borderRadius: 14, background: 'var(--card-bg)', border: '1px solid var(--card-border)', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-primary)' }}>{s.v}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un prospect…"
          style={{ width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 9, paddingBottom: 9, borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {/* Results table */}
      <div style={{ background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--card-border)', overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Users size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <div>Aucun résultat</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--body-bg)' }}>
                  {['Nom', 'Poste', 'Entreprise', 'Email', 'LinkedIn', 'Score', 'Action'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', borderBottom: '1px solid var(--card-border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{p.name}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title || '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Building2 size={11} />{p.company}</span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {p.email ? <a href={`mailto:${p.email}`} style={{ color: 'var(--color-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={11} />{p.email}</a> : '—'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {p.linkedin ? <a href={`https://${p.linkedin}`} target="_blank" rel="noopener noreferrer" style={{ color: '#0A66C2', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}><ExternalLink size={11} />Profil</a> : '—'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: p.score >= 80 ? '#059669' : p.score >= 60 ? '#D97706' : 'var(--text-muted)' }}>{p.score}</span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {imported.has(p.name) ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#059669', fontWeight: 600 }}><CheckCircle size={13} />Importé</span>
                      ) : (
                        <button onClick={() => importProspect(p.name)} disabled={importing.has(p.name)}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: importing.has(p.name) ? 0.7 : 1 }}>
                          {importing.has(p.name) ? <Loader2 size={11} className="animate-spin" /> : <Users size={11} />}
                          Importer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
