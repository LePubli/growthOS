import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Activity, AlertTriangle, ArrowUpRight, CheckCircle2, ChevronDown, ChevronRight, Clock3, Cloud, Code2, Download, Filter, Layers3, RefreshCw, Search, ShieldCheck, Terminal, XCircle } from 'lucide-react';
import apiClient from '@/lib/api-client';
import '@/diagnostics.css';

type Level = 'info' | 'warn' | 'error';
type DiagnosticEvent = {
  id: string; trace_id: string | null; level: Level; component: string; code: string; message: string;
  source: string | null; prospect_id: string | null; job_id: string | null;
  details: Record<string, unknown>; created_at: string;
};
type DiagnosticJob = {
  id: string; type: 'cloud' | 'enrichment'; prospectId: string | null; status: string;
  source?: string | null; message?: string; diagnosis?: SourceDiagnosis | null;
  sources?: { source: string; status: string; message: string; diagnosis?: SourceDiagnosis | null }[];
  updatedAt: string;
};
type SourceDiagnosis = { causeCode: string; certainty: 'observed' | 'likely' | 'unknown'; cause: string; action: string };
type Summary = {
  levels: { level: Level; count: number }[];
  components: { component: string; count: number }[];
  totals: { last_24h: number; last_7d: number }; generatedAt: string;
};
const fmt = (date: string) => new Date(date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });
const levelNames: Record<Level, string> = { error: 'Erreur', warn: 'Attention', info: 'Information' };
const statuses: Record<string, string> = {
  failed: 'Échec', awaiting_user: 'Intervention requise', needs_review: 'À vérifier',
  partial: 'Partiel', completed: 'Terminé', queued: 'En attente', running: 'En cours', cancelled: 'Annulé',
};
function LevelBadge({ level }: { level: Level }) {
  return <span className={`diag-badge diag-level-${level}`}>{level === 'error' ? <XCircle size={12} /> : level === 'warn' ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}{levelNames[level]}</span>;
}
function CausePanel({ diagnosis }: { diagnosis?: SourceDiagnosis | null }) {
  if (!diagnosis) return null;
  return <div className="diag-cause"><strong>Pourquoi ? <span>{diagnosis.certainty === 'observed' ? 'Motif constaté' : diagnosis.certainty === 'likely' ? 'Cause probable' : 'Cause à confirmer'}</span></strong><p>{diagnosis.cause}</p><strong>Que faire ?</strong><p>{diagnosis.action}</p></div>;
}

export default function DiagnosticsPage() {
  const [level, setLevel] = useState('');
  const [component, setComponent] = useState('');
  const [source, setSource] = useState('');
  const [days, setDays] = useState(7);
  const [search, setSearch] = useState('');
  const [prospectId, setProspectId] = useState('');
  const [jobId, setJobId] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const params = { level, component, source, days, search, prospectId, jobId, page, limit: 35 };
  const summary = useQuery({ queryKey: ['diagnostics-summary'], queryFn: () => apiClient.get<Summary>('/diagnostics/summary'), refetchInterval: 30000 });
  const events = useQuery({ queryKey: ['diagnostics-events', params], queryFn: () => apiClient.get<{ events: DiagnosticEvent[]; total: number }>('/diagnostics/events', { params }), refetchInterval: 30000 });
  const jobs = useQuery({ queryKey: ['diagnostics-jobs', days], queryFn: () => apiClient.get<{ jobs: DiagnosticJob[] }>('/diagnostics/jobs', { params: { days } }), refetchInterval: 30000 });
  const sources = useQuery({ queryKey: ['diagnostics-sources', days], queryFn: () => apiClient.get<{ sources: { source: string; runs: number; issues: number; lastSeen: string; lastReason: string; diagnosis: SourceDiagnosis | null }[] }>('/diagnostics/sources', { params: { days } }), refetchInterval: 30000 });

  const tally = (key: Level) => summary.data?.levels.find(l => l.level === key)?.count || 0;
  const visibleJobs = (jobs.data?.jobs || []).filter(job => !onlyProblems || ['failed', 'partial', 'needs_review', 'awaiting_user'].includes(job.status));
  const filter = (setter: (value: string) => void, value: string) => { setter(value); setPage(1); };
  const reload = () => { void Promise.all([summary.refetch(), events.refetch(), jobs.refetch(), sources.refetch()]); };

  const exportReport = async () => {
    try {
      const data = await apiClient.get('/diagnostics/export', { params: { level, component, source, days, search, prospectId, jobId } });
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url;
      link.download = `growthos-diagnostic-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    } catch { /* Axios already presents the error to the user. */ }
  };

  return <main className="diag-root">
    <div className="diag-heading">
      <div><div className="diag-kicker"><ShieldCheck size={14} /> GROWTHOS · OBSERVABILITÉ</div>
        <h1>Centre de diagnostic <span className={`diag-live ${summary.isError?'diag-live-error':''}`}><span />{summary.isPending?'Connexion…':summary.isError?'API indisponible':'Suivi actif'}</span></h1>
        <p>Retrouvez la cause, le contexte technique et la tâche liée à chaque incident. Les nouvelles routes API sont couvertes automatiquement.</p></div>
      <div className="diag-heading-actions">
        <button className="diag-button diag-button-quiet" onClick={reload}><RefreshCw size={15} /> Actualiser</button>
        <button className="diag-button diag-button-primary" onClick={() => void exportReport()}><Download size={15} /> Exporter le rapport</button>
      </div>
    </div>

    <div className="diag-metrics">
      <div className="diag-metric diag-metric-red"><div className="diag-metric-top"><span>Erreurs · 24 h</span><XCircle size={18} /></div><strong>{tally('error')}</strong><small>Échecs à investiguer</small></div>
      <div className="diag-metric diag-metric-amber"><div className="diag-metric-top"><span>Avertissements · 24 h</span><AlertTriangle size={18} /></div><strong>{tally('warn')}</strong><small>Actions ou vérifications nécessaires</small></div>
      <div className="diag-metric diag-metric-blue"><div className="diag-metric-top"><span>Événements · 7 j</span><Activity size={18} /></div><strong>{summary.data?.totals.last_7d ?? '—'}</strong><small>Tous composants confondus</small></div>
      <div className="diag-metric diag-metric-mint"><div className="diag-metric-top"><span>Tâches visibles</span><Layers3 size={18} /></div><strong>{jobs.data?.jobs.length ?? '—'}</strong><small>Collectes et enrichissements · {days} j</small></div>
    </div>

    <div className="diag-layout">
      <section className="diag-panel diag-main-panel">
        <div className="diag-panel-heading"><div><div className="diag-panel-title"><Terminal size={18} /> Journal des événements</div><p>Traçabilité avec identifiant de corrélation pour retrouver les logs Docker.</p></div><span className="diag-count">{events.data?.total ?? 0} événements</span></div>
        <div className="diag-filters">
          <label className="diag-search"><Search size={15} /><input placeholder="Code, message ou identifiant de trace…" value={search} onChange={e => filter(setSearch, e.target.value)} /></label>
          <select aria-label="Gravité" value={level} onChange={e => filter(setLevel, e.target.value)}><option value="">Toutes les gravités</option><option value="error">Erreurs</option><option value="warn">Avertissements</option><option value="info">Informations</option></select>
          <select aria-label="Composant" value={component} onChange={e => filter(setComponent, e.target.value)}><option value="">Tous les composants</option>{[...new Set(['api', 'frontend', 'cloud-browser', 'enrichment', ...(summary.data?.components.map(c => c.component) || [])])].map(c => <option key={c} value={c}>{c}</option>)}</select>
          <select aria-label="Période" value={days} onChange={e => { setDays(Number(e.target.value)); setPage(1); }}><option value={1}>24 heures</option><option value={7}>7 jours</option><option value={30}>30 jours</option><option value={90}>90 jours</option></select>
        </div>
        <div className="diag-extra-filters"><Filter size={13} /><input aria-label="Identifiant prospect" placeholder="ID du prospect (optionnel)" value={prospectId} onChange={e => filter(setProspectId, e.target.value)} /><input aria-label="Identifiant tâche" placeholder="ID de tâche (optionnel)" value={jobId} onChange={e => filter(setJobId, e.target.value)} />{source && <span className="diag-source-active">Source : {source} <button aria-label="Retirer la source" onClick={() => filter(setSource, '')}>×</button></span>}{(prospectId || jobId || search || level || component || source) && <button onClick={() => { setProspectId(''); setJobId(''); setSearch(''); setLevel(''); setComponent(''); setSource(''); setPage(1); }}>Effacer les filtres</button>}</div>

        {events.isPending ? <div className="diag-empty"><RefreshCw size={21} className="diag-spin" /> Chargement des traces…</div> : events.isError ? <div className="diag-empty diag-failure"><AlertTriangle size={22} /> Impossible de lire les diagnostics. Vérifiez vos droits administrateur et la connexion API.<button onClick={reload}>Réessayer</button></div> : !events.data?.events.length ? <div className="diag-empty"><CheckCircle2 size={25} /> Aucun événement sur cette période et pour ces filtres.<span>Les erreurs et lenteurs API remontent automatiquement ; les premières tâches enrichiront ce journal.</span></div> : <div className="diag-list">{events.data.events.map(event => <div className={`diag-event diag-event-${event.level}`} key={event.id}>
          <button className="diag-event-trigger" onClick={() => setExpanded(expanded === event.id ? null : event.id)} aria-expanded={expanded === event.id}>
            <span className="diag-timeline-marker" /><span className="diag-event-body"><span className="diag-event-line"><LevelBadge level={event.level} /><span className="diag-event-code">{event.code}</span><span className="diag-event-component">{event.component}{event.source ? ` · ${event.source}` : ''}</span></span><strong>{event.message}</strong><span className="diag-event-meta"><Clock3 size={12} /> {fmt(event.created_at)} {event.trace_id && <> · Trace <code>{event.trace_id.slice(0, 13)}…</code></>}</span></span>{expanded === event.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          {expanded === event.id && <div className="diag-event-detail"><div className="diag-detail-links">{event.prospect_id && <Link href={`/prospects/${event.prospect_id}`}>Ouvrir la fiche prospect <ArrowUpRight size={12} /></Link>}{event.job_id && <button onClick={() => { setJobId(event.job_id!); setPage(1); }}>Voir les traces de cette tâche</button>}</div><CausePanel diagnosis={event.details?.causeCode ? event.details as SourceDiagnosis : null} /><div className="diag-detail-caption">Identifiant de trace complet : <code>{event.trace_id || 'Non fourni'}</code></div><pre>{JSON.stringify(event.details || {}, null, 2)}</pre><button className="diag-mini-action" onClick={() => void navigator.clipboard.writeText(JSON.stringify({ id: event.id, traceId: event.trace_id, code: event.code, component: event.component, createdAt: event.created_at, details: event.details }, null, 2))}>Copier ce diagnostic</button></div>}
        </div>)}</div>}
        <div className="diag-pagination"><span>Page {page} sur {Math.max(1, Math.ceil((events.data?.total || 0) / 35))}</span><div><button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Précédent</button><button disabled={page * 35 >= (events.data?.total || 0)} onClick={() => setPage(p => p + 1)}>Suivant</button></div></div>
      </section>

      <aside className="diag-aside">
        <section className="diag-panel diag-source-panel"><div className="diag-panel-heading"><div><div className="diag-panel-title"><AlertTriangle size={18} /> Santé des sources</div><p>Occurrences et motifs d'incidents par source · {days} j.</p></div></div>
          <div className="diag-source-list">{sources.isPending ? <div className="diag-job-empty">Analyse des sources…</div> : sources.isError ? <div className="diag-job-empty">Analyse indisponible</div> : !sources.data?.sources.length ? <div className="diag-job-empty">Aucune activité source dans cette période.</div> : sources.data.sources.map(item => <details key={item.source} className="diag-source-item"><summary><span className={`diag-job-dot ${item.issues ? 'failed' : 'completed'}`} /><span>{item.source}</span><small>{item.issues ? `${item.issues} anomalie(s)` : 'Aucune anomalie'} / {item.runs} étapes</small><ChevronRight size={13} /></summary><div className="diag-source-body">{item.lastReason && <p><b>Dernier motif :</b> {item.lastReason}</p>}<CausePanel diagnosis={item.diagnosis} /><button onClick={() => { setSource(item.source); setPage(1); }}>Afficher les traces de cette source</button></div></details>)}</div>
        </section>
        <section className="diag-panel diag-job-panel"><div className="diag-panel-heading"><div><div className="diag-panel-title"><Cloud size={18} /> État des tâches</div><p>Historique réel, même avant l'activation des traces.</p></div></div>
          <label className="diag-toggle"><input type="checkbox" checked={onlyProblems} onChange={e => setOnlyProblems(e.target.checked)} /> Problèmes uniquement</label>
          <div className="diag-job-list">{jobs.isPending ? <div className="diag-job-empty">Chargement…</div> : jobs.isError ? <div className="diag-job-empty">Tâches indisponibles</div> : visibleJobs.length === 0 ? <div className="diag-job-empty"><CheckCircle2 size={22} />Aucune tâche correspondante.</div> : visibleJobs.slice(0, 45).map(job => <details className="diag-job" key={job.id}><summary><span className={`diag-job-dot ${job.status}`} /><span><strong>{job.type === 'cloud' ? (job.source || 'Navigateur cloud') : 'Enrichissement multisource'}</strong><small>{fmt(job.updatedAt)}</small></span><span className={`diag-status diag-status-${job.status}`}>{statuses[job.status] || job.status}</span></summary><div className="diag-job-detail">{job.message && <p>{job.message}</p>}<CausePanel diagnosis={job.diagnosis} />{job.sources?.map(s => <div key={s.source} className="diag-job-source"><span>{s.source}</span><span>{statuses[s.status] || s.status}</span>{s.message && <small>{s.message}</small>}<CausePanel diagnosis={s.diagnosis} /></div>)}<div className="diag-job-actions"><button onClick={() => { setJobId(job.id); setPage(1); }}>Traces liées</button>{job.prospectId && <Link href={`/prospects/${job.prospectId}`}>Fiche prospect <ArrowUpRight size={12} /></Link>}</div></div></details>)}</div>
        </section>
        <section className="diag-help"><div><Code2 size={18} /> <strong>Rapport pour les agents</strong></div><p>Exportez les événements filtrés et les états des tâches. Transmettez le fichier JSON à l’agent chargé du correctif avec l’heure et l’action effectuée.</p><p>Les corps HTTP, mots de passe, cookies et captures ne sont pas enregistrés dans ce rapport.</p><Link href="/admin/deep-audit">Lancer l'audit technique existant <ArrowUpRight size={13} /></Link></section>
      </aside>
    </div>
  </main>;
}
