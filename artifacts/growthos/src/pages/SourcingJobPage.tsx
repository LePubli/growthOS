import { useCallback, useEffect, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { ArrowLeft, Building2, Download, ExternalLink, Loader2, RefreshCw, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';

type SourcingJob = {
  id: string; type: string; name: string; status: string; count: number | null;
  error: string | null; duration: string | null; createdAt: string;
  params: { query?: string; location?: string; codePostal?: string; regions?: string[]; departements?: string[]; codesPostaux?: string[]; limit?: number;
    sources?: string[]; sourceStatuses?: Record<string, { status: string; count?: number; error?: string; zonesAttempted?: number; zonesTotal?: number }> };
};
type Candidate = {
  id?: string; siren: string; source?: string; sources?: string[]; siret?: string | null; company: string | null; address: string | null;
  phone?: string | null; website?: string | null; sourceUrl?: string | null;
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

  const reload = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);
    try {
      const [jobInfo, resultInfo] = await Promise.all([
        apiClient.get<SourcingJob>(`/sourcing/jobs/${id}`),
        apiClient.get<{ data: Candidate[] }>(`/sourcing/jobs/${id}/results`),
      ]);
      setJob(jobInfo);
      setResults(resultInfo.data || []);
      setSelected(previous => previous.filter(siren => resultInfo.data?.some(
        candidate => (candidate.id || candidate.siren) === siren && !candidate.imported,
      )));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recherche introuvable');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    if (job?.status !== 'running' && job?.status !== 'queued') return;
    const timer = window.setInterval(() => { void reload(true); }, 3000);
    return () => window.clearInterval(timer);
  }, [job?.status, reload]);

  const candidateKey = (candidate: Candidate) => candidate.id || candidate.siren;
  const available = results.filter(candidate => !candidate.imported);
  const allSelected = available.length > 0 && available.every(candidate => selected.includes(candidateKey(candidate)));

  function toggleAll() {
    setSelected(allSelected ? [] : available.map(candidateKey));
  }

  async function importSelection() {
    if (!id || !selected.length || importing) return;
    setImporting(true);
    try {
      const result = await apiClient.post<{ imported: number; skipped: number }>(
        `/sourcing/jobs/${id}/import`, { ids: selected },
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
      ['Sources', 'SIREN', 'SIRET', 'Entreprise', 'Adresse', 'Code postal', 'Ville', 'Téléphone', 'Site web', 'Fiche source', 'Déjà importée'],
      ...results.map(p => [(p.sources || [p.source]).filter(Boolean).join(', '), p.siren, p.siret, p.company, p.address, p.codePostal, p.city, p.phone, p.website, p.sourceUrl, p.imported ? 'Oui' : 'Non']),
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
              <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 13 }}>{job.type === 'multi' ? 'Recherche multisource' : job.type === 'pagesjaunes' ? 'PagesJaunes.fr · extraction HTML' : 'Annuaire des entreprises'} · {new Date(job.createdAt).toLocaleString('fr-FR')}</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { void reload(); }} style={{ border: '1px solid var(--card-border)', color: 'var(--text-primary)', background: 'var(--card-bg)', padding: '10px 14px', borderRadius: 10, display: 'flex', gap: 7, alignItems: 'center', cursor: 'pointer' }}><RefreshCw size={15}/> Actualiser</button>
              <button onClick={exportCsv} disabled={!results.length} style={{ border: 0, color: '#fff', background: '#2563EB', opacity: results.length ? 1 : .5, padding: '10px 14px', borderRadius: 10, display: 'flex', gap: 7, alignItems: 'center', cursor: results.length ? 'pointer' : 'not-allowed' }}><Download size={15}/> Export CSV</button>
            </div>
          </div>

          <div style={{ padding: 18, border: '1px solid var(--card-border)', background: 'var(--card-bg)', borderRadius: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
              <strong style={{ color: 'var(--text-primary)' }}>{results.length} entreprise(s) trouvée(s)</strong>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>· {results.filter(item => item.imported).length} déjà dans le CRM</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>· {job.duration || '—'}</span>
            </div>
            <p style={{ color: 'var(--text-secondary)', margin: '0 0 8px', fontSize: 13 }}>Recherche : {job.params?.query || '—'} · Zone : {[
              job.params?.regions?.length ? `Régions ${job.params.regions.join(', ')}` : '',
              job.params?.departements?.length ? `Départements ${job.params.departements.join(', ')}` : '',
              job.params?.codesPostaux?.length ? `CP ${job.params.codesPostaux.join(', ')}` : '',
              job.params?.codePostal ? `CP ${job.params.codePostal}` : '',
              job.params?.location ? job.params.location : '',
            ].filter(Boolean).join(' · ') || 'Non précisée'}</p>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 12 }}>
              Les entreprises ci-dessous ne sont pas importées automatiquement. Cochez celles qui vous intéressent.
              L'annuaire officiel ne garantit ni email, ni téléphone, ni site web : aucune coordonnée n'est inventée.
            </p>
            {job.error && <p style={{ color: '#B91C1C', fontSize: 12 }}>{job.error}</p>}
          </div>

          {job.type === 'multi' && <div className="rounded-2xl border p-4 mb-4 space-y-3" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>État des sources</h2>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{job.status === 'running' ? 'Recherche en cours…' : job.status === 'completed' ? (job.error ? 'Recherche partiellement terminée' : 'Recherche terminée') : 'Recherche interrompue'}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(job.params.sources || []).map(source => {
                const state = job.params.sourceStatuses?.[source];
                const status = state?.status || 'pending';
                return <div key={source} className={`rounded-xl border px-3 py-2.5 text-sm ${status === 'error' ? 'bg-red-50 border-red-200' : status === 'completed' ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <strong>{source === 'entreprises' ? 'Annuaire des entreprises' : 'PagesJaunes.fr'}</strong>
                    <span className="text-xs">{status === 'completed' ? '✓ Terminé' : status === 'error' ? 'Échec' : status === 'running' ? 'En cours…' : 'En attente'}</span>
                  </div>
                  {status === 'completed' && <p className="text-xs mt-1">{state?.count ?? 0} résultat(s) · source consultée</p>}
                  {state?.zonesTotal && <p className="text-xs mt-1">{state.zonesAttempted ?? 0}/{state.zonesTotal} zone(s) consultée(s)</p>}
                  {state?.error && <p role="alert" className="text-xs text-red-800 mt-1 break-words">{state.error}</p>}
                </div>;
              })}
            </div>
            {(job.status === 'running' || job.status === 'queued') && <p className="text-xs text-gray-500">Les résultats apparaissent progressivement. Aucune entreprise n'est importée automatiquement.</p>}
          </div>}

          <section style={{ border: '1px solid var(--card-border)', background: 'var(--card-bg)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: 16, display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
              <h2 style={{ fontWeight: 700, fontSize: 16, margin: 0, color: 'var(--text-primary)' }}>Sélection des entreprises ({selected.length})</h2>
              <button onClick={importSelection} disabled={!selected.length || importing || job.status !== 'completed'}
                style={{ background: 'var(--color-primary)', color: '#fff', opacity: selected.length && !importing && job.status === 'completed' ? 1 : .5, padding: '9px 14px', border: 0, borderRadius: 10, cursor: selected.length ? 'pointer' : 'not-allowed', fontWeight: 600 }}>
                {importing ? 'Import en cours…' : job.status !== 'completed' ? 'Import disponible après la recherche' : `Importer ${selected.length} entreprise(s) dans le CRM`}
              </button>
            </div>
            {results.length === 0 ? (
              <p style={{ padding: 25, color: 'var(--text-muted)', fontSize: 13 }}>
                {job.status === 'running' ? 'Recherche en cours : les résultats apparaîtront ici.' : 'Aucun résultat exploitable. Essayez une activité plus large ou une autre zone. Pour PagesJaunes, le site peut refuser l’accès ou sa structure peut avoir changé.'}
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead style={{ background: 'var(--body-bg)', color: 'var(--text-muted)' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: 12 }}>
                        <input aria-label="Sélectionner toutes les entreprises non importées" type="checkbox" checked={allSelected} disabled={!available.length} onChange={toggleAll} />
                      </th>
                      {['Entreprise / source', 'Adresse locale', 'Code postal', 'SIREN', 'SIRET', 'Téléphone', 'Site', 'CRM'].map(label =>
                        <th key={label} style={{ textAlign: 'left', padding: 12 }}>{label}</th>)}
                    </tr>
                  </thead>
                  <tbody>{results.map(candidate => (
                    <tr key={candidateKey(candidate)} style={{ borderTop: '1px solid var(--card-border)' }}>
                      <td style={{ padding: 12 }}>
                        <input type="checkbox" aria-label={`Sélectionner ${candidate.company || candidate.siren}`}
                          disabled={candidate.imported} checked={candidate.imported || selected.includes(candidateKey(candidate))}
                          onChange={() => setSelected(previous => previous.includes(candidateKey(candidate))
                            ? previous.filter(id => id !== candidateKey(candidate)) : [...previous, candidateKey(candidate)])} />
                      </td>
                      <td style={{ padding: 12, color: 'var(--text-primary)', fontWeight: 650 }}>
                        <Building2 size={14} style={{ display: 'inline', marginRight: 7 }}/>{candidate.company || 'Inconnue'}
                         <div className="text-xs text-teal-700 mt-1">{(candidate.sources || [candidate.source]).filter(Boolean).map(source => source === 'entreprises' ? 'Annuaire' : source === 'pagesjaunes' ? 'PagesJaunes' : source).join(' + ')}</div>
                      </td>
                      <td style={{ padding: 12, color: 'var(--text-secondary)' }}>{candidate.address || 'Non renseignée'}</td>
                      <td style={{ padding: 12, color: 'var(--text-secondary)' }}>{candidate.codePostal || '—'}</td>
                      <td style={{ padding: 12, color: 'var(--text-muted)' }}>{candidate.siren || '—'}</td>
                       <td style={{ padding: 12, color: 'var(--text-muted)' }}>{candidate.siret || '—'}</td>
                       <td style={{ padding: 12, color: 'var(--text-muted)' }}>{candidate.phone || '—'}</td>
                       <td style={{ padding: 12, color: 'var(--text-muted)' }}>{candidate.sourceUrl ? <a href={candidate.sourceUrl} target="_blank" rel="noreferrer" className="text-teal-700 underline">Fiche source</a> : candidate.website ? <a href={candidate.website} target="_blank" rel="noreferrer" className="text-teal-700 underline">Site</a> : '—'}</td>
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
