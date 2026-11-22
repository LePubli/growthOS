import { useCallback, useEffect, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { ArrowLeft, Building2, Download, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';

type SourcingJob = {
  id: string;
  type: string;
  name: string;
  status: string;
  count: number | null;
  error: string | null;
  duration: string | null;
  createdAt: string;
  params: { query?: string; limit?: number };
};
type ImportedProspect = {
  id: string;
  company: string | null;
  address: string | null;
  website: string | null;
  email: string | null;
  status: string;
};

function csvCell(value: unknown): string {
  // Always quote to preserve embedded punctuation; guard spreadsheet formula
  // injection when exporting external company names and addresses.
  const raw = String(value ?? '');
  const safe = /^[\s]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export default function SourcingJobPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [job, setJob] = useState<SourcingJob | null>(null);
  const [results, setResults] = useState<ImportedProspect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [jobInfo, resultInfo] = await Promise.all([
        apiClient.get<SourcingJob>(`/sourcing/jobs/${id}`),
        apiClient.get<{ data: ImportedProspect[] }>(`/sourcing/jobs/${id}/results`),
      ]);
      setJob(jobInfo);
      setResults(resultInfo.data);
      setError('');
    } catch (e: any) {
      setError(e.message ?? 'Recherche introuvable');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void reload(); }, [reload]);

  function exportCsv() {
    if (!results.length) return;
    const lines = [
      ['Entreprise', 'Adresse', 'Site', 'Email', 'Statut'],
      ...results.map(p => [p.company, p.address, p.website, p.email, p.status]),
    ];
    const csv = '\uFEFF' + lines.map(line => line.map(csvCell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `growthos-entreprises-${id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Export CSV créé');
  }

  return <main style={{ background: 'var(--body-bg)', minHeight: '100vh', padding: 24 }}>
    <button onClick={() => navigate('/sourcing')} style={{ border: 0, background: 'none', color: 'var(--text-muted)', display: 'flex', gap: 7, alignItems: 'center', cursor: 'pointer', marginBottom: 20 }}>
      <ArrowLeft size={16} /> Retour aux recherches
    </button>

    {loading && <div style={{ padding: 48, textAlign: 'center' }}><Loader2 size={28} className="animate-spin" /></div>}
    {error && <div role="alert" style={{ padding: 20, color: '#B91C1C', background: '#FEE2E2', borderRadius: 12 }}>{error}</div>}
    {!loading && job && !error && <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'center', flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontWeight: 800, fontSize: 24, color: 'var(--text-primary)', margin: '0 0 7px' }}>{job.name}</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 13 }}>
            {job.type === 'entreprises' ? 'Annuaire officiel des entreprises françaises' : 'Ancien connecteur'} · {new Date(job.createdAt).toLocaleString('fr-FR')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={reload} style={{ border: '1px solid var(--card-border)', color: 'var(--text-primary)', background: 'var(--card-bg)', padding: '10px 14px', borderRadius: 10, display: 'flex', gap: 7, alignItems: 'center', cursor: 'pointer' }}><RefreshCw size={15}/> Actualiser</button>
          <button onClick={exportCsv} disabled={!results.length} style={{ border: 0, color: '#fff', background: '#2563EB', opacity: results.length ? 1 : .5, padding: '10px 14px', borderRadius: 10, display: 'flex', gap: 7, alignItems: 'center', cursor: results.length ? 'pointer' : 'not-allowed' }}><Download size={15}/> Export CSV</button>
        </div>
      </div>

      <div style={{ padding: 20, border: '1px solid var(--card-border)', background: 'var(--card-bg)', borderRadius: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ background: job.status === 'completed' ? '#D1FAE5' : job.status === 'error' ? '#FEE2E2' : '#DBEAFE', color: job.status === 'completed' ? '#065F46' : job.status === 'error' ? '#991B1B' : '#1E40AF', padding: '5px 11px', borderRadius: 100, fontSize: 12, fontWeight: 700 }}>
            {job.status === 'completed' ? 'Terminé' : job.status === 'error' ? 'Erreur' : job.status}
          </span>
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{job.count ?? 0} entreprise(s) importée(s)</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Durée : {job.duration ?? '—'}</span>
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Recherche : <strong>{job.params?.query ?? 'Non renseignée'}</strong></div>
        {job.error && <p style={{ fontSize: 13, color: '#B91C1C' }}>{job.error}</p>}
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 0 }}>
          Les entreprises sont déjà enregistrées dans le CRM. L'annuaire ne fournit pas d'adresses email de prospection ni de sites web vérifiés : aucun contact n'est inventé.
        </p>
      </div>

      <section style={{ border: '1px solid var(--card-border)', background: 'var(--card-bg)', borderRadius: 16, overflow: 'hidden' }}>
        <h2 style={{ padding: 18, margin: 0, fontSize: 17, color: 'var(--text-primary)' }}>Entreprises enregistrées ({results.length})</h2>
        {results.length === 0 ? <p style={{ padding: 25, color: 'var(--text-muted)', fontSize: 13 }}>Aucun résultat enregistré pour cette recherche.</p> :
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: 'var(--body-bg)', color: 'var(--text-muted)' }}><tr>
                {['Entreprise', 'Adresse', 'Email connu', 'CRM'].map(label => <th key={label} style={{ textAlign: 'left', padding: 12 }}>{label}</th>)}
              </tr></thead>
              <tbody>{results.map(p => <tr key={p.id} style={{ borderTop: '1px solid var(--card-border)' }}>
                <td style={{ padding: 12, color: 'var(--text-primary)', fontWeight: 650 }}><Building2 size={14} style={{ display: 'inline', marginRight: 7 }}/>{p.company ?? 'Inconnu'}</td>
                <td style={{ padding: 12, color: 'var(--text-secondary)' }}>{p.address ?? '—'}</td>
                <td style={{ padding: 12, color: 'var(--text-secondary)' }}>{p.email ?? 'Non disponible'}</td>
                <td style={{ padding: 12 }}><button onClick={() => navigate(`/prospects/${p.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 5, border: 0, background: 'none', color: '#2563EB', cursor: 'pointer' }}>Ouvrir <ExternalLink size={12}/></button></td>
              </tr>)}</tbody>
            </table>
          </div>
        }
      </section>
    </>}
  </main>;
}
