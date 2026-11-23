import { useCallback, useEffect, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { ArrowLeft, Building2, Download, ExternalLink, Loader2, RefreshCw, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';

type SourcingJob = {
  id: string; type: string; name: string; status: string; count: number | null;
  error: string | null; duration: string | null; createdAt: string;
  params: { query?: string; codePostal?: string; limit?: number };
};
type Candidate = {
  siren: string; company: string | null; address: string | null;
  codePostal: string; city: string | null; imported: boolean; prospectId: string | null;
};

function csvCell(value: unknown): string {
  const raw = String(value ?? '');
  const safe = /^[\s]*[=+\-@]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replace(/"/g, '""') + '"';
}

export default function SourcingJobPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [job, setJob] = useState<SourcingJob | null>(null);
  const [results, setResults] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [jobInfo, resultInfo] = await Promise.all([
        apiClient.get<SourcingJob>(`/sourcing/jobs/${id}`),
        apiClient.get<{ data: Candidate[] }>(`/sourcing/jobs/${id}/results`),
      ]);
      setJob(jobInfo);
      setResults(resultInfo.data || []);
      setSelected(previous => previous.filter(siren => resultInfo.data?.some(
        candidate => candidate.siren === siren && !candidate.imported,
      )));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recherche introuvable');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void reload(); }, [reload]);

  const available = results.filter(candidate => !candidate.imported);
  const allSelected = available.length > 0 && available.every(candidate => selected.includes(candidate.siren));

  function toggleAll() {
    setSelected(allSelected ? [] : available.map(candidate => candidate.siren));
  }

  async function importSelection() {
    if (!id || !selected.length || importing) return;
    setImporting(true);
    try {
      const result = await apiClient.post<{ imported: number; skipped: number }>(
        `/sourcing/jobs/${id}/import`, { sirens: selected },
      );
      toast.success(`${result.imported} entreprise(s) ajoutée(s) au CRM${result.skipped ? ` · ${result.skipped} doublon(s) ignoré(s)` : ''}`);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import impossible');
    } finally {
      setImporting(false);
    }
  }

  function exportCsv() {
    if (!results.length) return;
    const lines = [
      ['SIREN', 'Entreprise', 'Adresse', 'Code postal', 'Ville', 'Déjà importée'],
      ...results.map(p => [p.siren, p.company, p.address, p.codePostal, p.city, p.imported ? 'Oui' : 'Non']),
    ];
    const csv = '\uFEFF' + lines.map(line => line.map(csvCell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `growthos-recherche-${id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Résultats exportés en CSV');
  }

  return (
    <main style={{ background: 'var(--body-bg)', minHeight: '100vh', padding: 24 }}>
      <button onClick={() => navigate('/sourcing')} style={{ border: 0, background: 'none', color: 'var(--text-muted)', display: 'flex', gap: 7, alignItems: 'center', cursor: 'pointer', marginBottom: 20 }}>
        <ArrowLeft size={16} /> Retour aux recherches
      </button>

      {loading && <div style={{ padding: 48, textAlign: 'center' }}><Loader2 size={28} className="animate-spin" /></div>}
      {error && <div role="alert" style={{ padding: 20, color: '#B91C1C', background: '#FEE2E2', borderRadius: 12 }}>{error}</div>}
      {!loading && job && !error && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'center', flexWrap: 'wrap', marginBottom: 22 }}>
            <div>
              <h1 style={{ fontWeight: 800, fontSize: 24, color: 'var(--text-primary)', margin: '0 0 7px' }}>{job.name}</h1>
              <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 13 }}>Annuaire des entreprises · {new Date(job.createdAt).toLocaleString('fr-FR')}</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={reload} style={{ border: '1px solid var(--card-border)', color: 'var(--text-primary)', background: 'var(--card-bg)', padding: '10px 14px', borderRadius: 10, display: 'flex', gap: 7, alignItems: 'center', cursor: 'pointer' }}><RefreshCw size={15}/> Actualiser</button>
              <button onClick={exportCsv} disabled={!results.length} style={{ border: 0, color: '#fff', background: '#2563EB', opacity: results.length ? 1 : .5, padding: '10px 14px', borderRadius: 10, display: 'flex', gap: 7, alignItems: 'center', cursor: results.length ? 'pointer' : 'not-allowed' }}><Download size={15}/> Export CSV</button>
            </div>
          </div>

          <div style={{ padding: 18, border: '1px solid var(--card-border)', background: 'var(--card-bg)', borderRadius: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
              <strong style={{ color: 'var(--text-primary)' }}>{results.length} entreprise(s) trouvée(s)</strong>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>· {results.filter(item => item.imported).length} déjà dans le CRM</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>· {job.duration || '—'}</span>
            </div>
            <p style={{ color: 'var(--text-secondary)', margin: '0 0 8px', fontSize: 13 }}>Recherche : {job.params?.query || '—'} · Code postal : {job.params?.codePostal || 'Ancienne recherche sans filtre'}</p>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 12 }}>
              Les entreprises ci-dessous ne sont pas importées automatiquement. Cochez celles qui vous intéressent.
              L'annuaire officiel ne garantit ni email, ni téléphone, ni site web : aucune coordonnée n'est inventée.
            </p>
            {job.error && <p style={{ color: '#B91C1C', fontSize: 12 }}>{job.error}</p>}
          </div>

          <section style={{ border: '1px solid var(--card-border)', background: 'var(--card-bg)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: 16, display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
              <h2 style={{ fontWeight: 700, fontSize: 16, margin: 0, color: 'var(--text-primary)' }}>Sélection des entreprises ({selected.length})</h2>
              <button onClick={importSelection} disabled={!selected.length || importing}
                style={{ background: 'var(--color-primary)', color: '#fff', opacity: selected.length && !importing ? 1 : .5, padding: '9px 14px', border: 0, borderRadius: 10, cursor: selected.length ? 'pointer' : 'not-allowed', fontWeight: 600 }}>
                {importing ? 'Import en cours…' : `Importer ${selected.length} entreprise(s) dans le CRM`}
              </button>
            </div>
            {results.length === 0 ? (
              <p style={{ padding: 25, color: 'var(--text-muted)', fontSize: 13 }}>
                Aucun établissement ne correspond exactement à ce code postal. Essayez un métier plus large ou un autre code postal.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead style={{ background: 'var(--body-bg)', color: 'var(--text-muted)' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: 12 }}>
                        <input aria-label="Sélectionner toutes les entreprises non importées" type="checkbox" checked={allSelected} disabled={!available.length} onChange={toggleAll} />
                      </th>
                      {['Entreprise', 'Adresse locale', 'Code postal', 'SIREN', 'CRM'].map(label =>
                        <th key={label} style={{ textAlign: 'left', padding: 12 }}>{label}</th>)}
                    </tr>
                  </thead>
                  <tbody>{results.map(candidate => (
                    <tr key={candidate.siren} style={{ borderTop: '1px solid var(--card-border)' }}>
                      <td style={{ padding: 12 }}>
                        <input type="checkbox" aria-label={`Sélectionner ${candidate.company || candidate.siren}`}
                          disabled={candidate.imported} checked={candidate.imported || selected.includes(candidate.siren)}
                          onChange={() => setSelected(previous => previous.includes(candidate.siren)
                            ? previous.filter(id => id !== candidate.siren) : [...previous, candidate.siren])} />
                      </td>
                      <td style={{ padding: 12, color: 'var(--text-primary)', fontWeight: 650 }}>
                        <Building2 size={14} style={{ display: 'inline', marginRight: 7 }}/>{candidate.company || 'Inconnue'}
                      </td>
                      <td style={{ padding: 12, color: 'var(--text-secondary)' }}>{candidate.address || 'Non renseignée'}</td>
                      <td style={{ padding: 12, color: 'var(--text-secondary)' }}>{candidate.codePostal || '—'}</td>
                      <td style={{ padding: 12, color: 'var(--text-muted)' }}>{candidate.siren}</td>
                      <td style={{ padding: 12 }}>
                        {candidate.imported ? (
                          <button onClick={() => candidate.prospectId && navigate(`/prospects/${candidate.prospectId}`)}
                            disabled={!candidate.prospectId} style={{ border: 0, background: 'none', color: '#059669', cursor: 'pointer', display: 'flex', gap: 5, alignItems: 'center' }}>
                            <CheckCircle size={13}/> Dans le CRM <ExternalLink size={12}/>
                          </button>
                        ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>À sélectionner</span>}
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
