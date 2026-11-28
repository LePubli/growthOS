import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearch, useLocation } from 'wouter';
import { Radar, Loader2, Play, RotateCcw, X, Save, ExternalLink, Check, EyeOff, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';

/**
 * Veille e-réputation — lot 2.
 * SERP Google / Bing (nouveaux résultats, disparus, déplacés), avis Google Maps
 * et PagesJaunes, presse (Google Actualités, flux RSS), fil des mentions à qualifier.
 * Styles : variables du thème existant uniquement (périmètre design de l'agent 1).
 */

type Engine = 'google_search' | 'bing';
type RunStatus = 'queued' | 'running' | 'awaiting_user' | 'completed' | 'partial' | 'failed' | 'cancelled';
interface CampaignLite { id: string; name: string; targetName: string; targetType: 'B2B' | 'B2C'; status: string }
interface Settings {
  engines: Engine[]; extraQueries: string[]; mapsUrl: string | null; pagesjaunesUrl: string | null; newsEnabled: boolean;
  rssFeeds: string[]; frequency: 'off' | 'daily' | 'weekly'; dailyDepth: number; weeklyDepth: number;
  nextRunAt: string | null; nextWeeklyAt: string | null; configured: boolean;
}
interface Step { type: 'serp' | 'reviews' | 'news' | 'rss'; source: string; query?: string; url?: string; status: string; message?: string | null; items?: number; newItems?: number; dropped?: number; moved?: number }
interface Run { id: string; kind: string; depth: number; status: RunStatus; steps: Step[]; stats: Record<string, number | boolean>; message: string | null; createdAt: string; finishedAt: string | null }
interface Overview { settings: Settings; queries: string[]; cloudConfigured: boolean; profiles: Record<string, boolean>; lastRun: Run | null }
interface Mention { id: string; kind: 'serp' | 'review' | 'news'; source: string; url: string | null; title: string | null; excerpt: string | null; sentiment: 'pos' | 'neg' | 'neu'; status: 'new' | 'qualified' | 'ignored'; baseline: boolean; first_seen_at: string }
interface SerpRow { engine: Engine; query: string; position: number | null; url: string | null; result_count?: number; title: string | null; previous_position: number | null; is_new: boolean; captured_at: string }
interface ReviewsOverview { stats: { source: string; rating: number | null; review_count: number | null; captured_at: string }[]; reviews: { id: string; source: string; author: string | null; rating: number | null; review_date: string | null; text: string | null; sentiment: string; owner_response: boolean }[] }

export const SOURCE_LABEL: Record<string, string> = { google_search: 'Google', bing: 'Bing', google_maps: 'Google Maps', pagesjaunes: 'PagesJaunes', google_news: 'Google Actualités', rss: 'Flux RSS' };
export const RUN_LABEL: Record<RunStatus, string> = { queued: 'En file', running: 'En cours', awaiting_user: 'Vérification requise', completed: 'Terminée', partial: 'Partielle', failed: 'Échec', cancelled: 'Annulée' };
const RUN_COLOR: Record<RunStatus, string> = { queued: '#6B7280', running: '#2563EB', awaiting_user: '#D97706', completed: '#059669', partial: '#D97706', failed: '#DC2626', cancelled: '#6B7280' };
const SENTIMENT: Record<string, { label: string; color: string }> = { pos: { label: 'Positif', color: '#059669' }, neg: { label: 'Négatif', color: '#DC2626' }, neu: { label: 'Neutre', color: '#6B7280' } };
const KIND_LABEL: Record<Mention['kind'], string> = { serp: 'Résultat', review: 'Avis', news: 'Presse' };
const STEP_STATUS: Record<string, string> = { pending: 'à faire', completed: 'lue', awaiting_user: 'vérification requise', skipped: 'ignorée', failed: 'échec' };

function apiError(error: unknown, fallback: string): string {
  const e = error as { response?: { data?: { error?: string } }; message?: string };
  return e?.response?.data?.error || e?.message || fallback;
}
const fmt = (v: string | null) => v ? new Date(v).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Paris' }) : '—';
const card = { background: 'var(--card-bg)', borderColor: 'var(--card-border)' } as const;
const input = 'w-full px-3 py-2 rounded-lg border text-sm';
const inputStyle = { background: 'var(--input-bg, var(--card-bg))', borderColor: 'var(--card-border)', color: 'var(--text-primary)' } as const;
const lines = (v: string) => v.split('\n').map(s => s.trim()).filter(Boolean);
/** N'affiche un lien que s'il est http(s) (pas de javascript:). */
const safeHref = (v: string | null) => { try { const u = new URL(v || ''); return /^https?:$/.test(u.protocol) ? u.href : null; } catch { return null; } };

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-xl border p-5 space-y-4" style={card}>
      <div className="flex items-center justify-between gap-3"><h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>{right}</div>
      {children}
    </section>
  );
}

function SettingsForm({ campaignId, overview }: { campaignId: string; overview: Overview }) {
  const qc = useQueryClient();
  const s = overview.settings;
  const [form, setForm] = useState({ ...s, extra: s.extraQueries.join('\n'), rss: s.rssFeeds.join('\n') });
  useEffect(() => { setForm({ ...s, extra: s.extraQueries.join('\n'), rss: s.rssFeeds.join('\n') }); }, [campaignId, s.configured]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useMutation({
    mutationFn: () => apiClient.put(`/ereputation/campaigns/${campaignId}/watch`, {
      engines: form.engines, frequency: form.frequency, dailyDepth: Number(form.dailyDepth), weeklyDepth: Number(form.weeklyDepth),
      mapsUrl: form.mapsUrl || null, pagesjaunesUrl: form.pagesjaunesUrl || null, newsEnabled: form.newsEnabled,
      extraQueries: lines(form.extra), rssFeeds: lines(form.rss),
    }) as Promise<Overview>,
    onSuccess: () => { toast.success('Réglages de veille enregistrés'); qc.invalidateQueries({ queryKey: ['erep-watch', campaignId] }); },
    onError: e => toast.error(apiError(e, 'Enregistrement impossible')),
  });
  const toggleEngine = (e: Engine) => setForm(f => ({ ...f, engines: f.engines.includes(e) ? f.engines.filter(x => x !== e) : [...f.engines, e] }));
  const label = 'block text-xs font-medium mb-1';
  const missing = (['google_search', 'bing', 'google_maps', 'pagesjaunes'] as const).filter(src =>
    (src === 'google_search' || src === 'bing' ? form.engines.includes(src) : src === 'google_maps' ? !!form.mapsUrl : !!form.pagesjaunesUrl) && !overview.profiles[src]);
  return (
    <div className="space-y-4">
      {!overview.cloudConfigured && <p className="text-xs flex items-center gap-1.5" style={{ color: '#D97706' }}><AlertTriangle size={13} /> Navigateur cloud non configuré : seule la presse sera lue.</p>}
      {missing.length > 0 && <p className="text-xs flex items-center gap-1.5" style={{ color: '#D97706' }}><AlertTriangle size={13} />
        Profil navigateur manquant : {missing.map(m => SOURCE_LABEL[m]).join(', ')}. Créez-le dans Prospection → Navigateur cloud (ouvrez la source une fois pour valider le consentement).</p>}
      <div className="grid md:grid-cols-3 gap-4">
        <div>
          <span className={label} style={{ color: 'var(--text-secondary)' }}>Moteurs</span>
          {(['google_search', 'bing'] as Engine[]).map(e => (
            <label key={e} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
              <input type="checkbox" checked={form.engines.includes(e)} onChange={() => toggleEngine(e)} /> {SOURCE_LABEL[e]}
            </label>))}
          <label className="flex items-center gap-2 text-sm mt-2" style={{ color: 'var(--text-primary)' }}>
            <input type="checkbox" checked={form.newsEnabled} onChange={e => setForm(f => ({ ...f, newsEnabled: e.target.checked }))} /> Google Actualités
          </label>
        </div>
        <div>
          <label className={label} style={{ color: 'var(--text-secondary)' }} htmlFor="erep-frequency">Fréquence</label>
          <select id="erep-frequency" className={input} style={inputStyle} value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value as Settings['frequency'] }))}>
            <option value="daily">Quotidienne (nuit) + hebdomadaire le dimanche</option>
            <option value="weekly">Hebdomadaire (dimanche)</option>
            <option value="off">Manuelle uniquement</option>
          </select>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted, var(--text-secondary))' }}>Prochaine : {fmt(s.nextRunAt)}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={label} style={{ color: 'var(--text-secondary)' }} htmlFor="erep-daily">Top quotidien</label>
            <input id="erep-daily" type="number" min={10} max={100} className={input} style={inputStyle} value={form.dailyDepth} onChange={e => setForm(f => ({ ...f, dailyDepth: Number(e.target.value) }))} /></div>
          <div><label className={label} style={{ color: 'var(--text-secondary)' }} htmlFor="erep-weekly">Top hebdo</label>
            <input id="erep-weekly" type="number" min={10} max={100} className={input} style={inputStyle} value={form.weeklyDepth} onChange={e => setForm(f => ({ ...f, weeklyDepth: Number(e.target.value) }))} /></div>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div><label className={label} style={{ color: 'var(--text-secondary)' }} htmlFor="erep-maps">Fiche Google Maps (adresse complète …/maps/place/…)</label>
          <input id="erep-maps" className={input} style={inputStyle} value={form.mapsUrl ?? ''} placeholder="https://www.google.com/maps/place/…" onChange={e => setForm(f => ({ ...f, mapsUrl: e.target.value }))} /></div>
        <div><label className={label} style={{ color: 'var(--text-secondary)' }} htmlFor="erep-pj">Fiche PagesJaunes</label>
          <input id="erep-pj" className={input} style={inputStyle} value={form.pagesjaunesUrl ?? ''} placeholder="https://www.pagesjaunes.fr/pros/…" onChange={e => setForm(f => ({ ...f, pagesjaunesUrl: e.target.value }))} /></div>
        <div><label className={label} style={{ color: 'var(--text-secondary)' }} htmlFor="erep-extra">Requêtes supplémentaires (une par ligne)</label>
          <textarea id="erep-extra" rows={3} className={input} style={inputStyle} value={form.extra} onChange={e => setForm(f => ({ ...f, extra: e.target.value }))} /></div>
        <div><label className={label} style={{ color: 'var(--text-secondary)' }} htmlFor="erep-rss">Flux RSS de presse (HTTPS, un par ligne)</label>
          <textarea id="erep-rss" rows={3} className={input} style={inputStyle} value={form.rss} onChange={e => setForm(f => ({ ...f, rss: e.target.value }))} /></div>
      </div>
      <div>
        <span className={label} style={{ color: 'var(--text-secondary)' }}>Requêtes surveillées ({overview.queries.length})</span>
        <div className="flex flex-wrap gap-1.5">{overview.queries.map(q => <code key={q} className="text-xs px-2 py-0.5 rounded border" style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}>{q}</code>)}</div>
      </div>
      <button onClick={() => save.mutate()} disabled={save.isPending} className="px-4 py-2 rounded-lg text-sm font-medium text-white inline-flex items-center gap-2" style={{ background: 'var(--accent, #2563EB)' }}>
        {save.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer
      </button>
    </div>
  );
}

export function RunsList({ runs, onResume, onCancel }: { runs: Run[]; onResume: (id: string) => void; onCancel: (id: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!runs.length) return <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Aucun passage pour l'instant.</p>;
  return (
    <ul className="space-y-2">
      {runs.map(r => (
        <li key={r.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--card-border)' }}>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ color: RUN_COLOR[r.status], border: `1px solid ${RUN_COLOR[r.status]}` }}>{RUN_LABEL[r.status]}</span>
            <span style={{ color: 'var(--text-primary)' }}>{r.kind === 'manual' ? 'Manuelle' : r.kind === 'weekly' ? 'Hebdomadaire' : 'Quotidienne'} · top {r.depth}</span>
            <span style={{ color: 'var(--text-secondary)' }}>{fmt(r.finishedAt ?? r.createdAt)}</span>
            {r.stats?.steps ? <span style={{ color: 'var(--text-secondary)' }}>
              {r.stats.baseline ? 'Relevé de référence · ' : ''}{Number(r.stats.newItems)} nouveauté(s) · {Number(r.stats.dropped)} disparu(s) · {Number(r.stats.moved)} déplacé(s)</span> : null}
            <span className="ml-auto flex gap-1.5">
              {['awaiting_user', 'partial', 'failed'].includes(r.status) && <button onClick={() => onResume(r.id)} className="px-2 py-1 rounded border text-xs inline-flex items-center gap-1" style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}><RotateCcw size={12} /> Reprendre</button>}
              {['queued', 'awaiting_user'].includes(r.status) && <button onClick={() => onCancel(r.id)} className="px-2 py-1 rounded border text-xs inline-flex items-center gap-1" style={{ borderColor: 'var(--card-border)', color: 'var(--text-secondary)' }}><X size={12} /> Annuler</button>}
              <button onClick={() => setOpen(open === r.id ? null : r.id)} className="px-2 py-1 rounded border text-xs" style={{ borderColor: 'var(--card-border)', color: 'var(--text-secondary)' }}>Étapes</button>
            </span>
          </div>
          {r.message && <p className="text-xs mt-2" style={{ color: RUN_COLOR[r.status] }}>{r.message}</p>}
          {open === r.id && <ul className="mt-2 space-y-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {r.steps.map((s, i) => <li key={i}><strong style={{ color: 'var(--text-primary)' }}>{SOURCE_LABEL[s.source] ?? s.source}</strong> · {s.query ?? s.url} — {STEP_STATUS[s.status] ?? s.status}
              {s.items !== undefined ? ` · ${s.items} lu(s)` : ''}{s.newItems ? ` · ${s.newItems} nouveau(x)` : ''}{s.message ? ` · ${s.message}` : ''}</li>)}
          </ul>}
        </li>))}
    </ul>
  );
}

export function MentionsFeed({ mentions, onStatus }: { mentions: Mention[]; onStatus: (id: string, status: Mention['status']) => void }) {
  if (!mentions.length) return <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Aucune mention pour ce filtre.</p>;
  return (
    <ul className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
      {mentions.map(m => {
        const href = safeHref(m.url);
        return (
          <li key={m.id} className="py-3 flex gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs mb-1">
                <span className="px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--card-border)', color: 'var(--text-secondary)' }}>{KIND_LABEL[m.kind]} · {SOURCE_LABEL[m.source] ?? m.source}</span>
                <span style={{ color: SENTIMENT[m.sentiment].color }}>{SENTIMENT[m.sentiment].label}</span>
                {m.status === 'new' && !m.baseline && <span className="font-semibold" style={{ color: '#2563EB' }}>Nouveau</span>}
                {m.baseline && <span style={{ color: 'var(--text-secondary)' }}>Référence</span>}
                <span style={{ color: 'var(--text-secondary)' }}>{fmt(m.first_seen_at)}</span>
              </div>
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="hover:underline inline-flex items-center gap-1">{m.title || href} <ExternalLink size={11} /></a> : m.title}
              </p>
              {m.excerpt && <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{m.excerpt}</p>}
            </div>
            <div className="flex items-start gap-1.5">
              {m.status !== 'qualified' && <button onClick={() => onStatus(m.id, 'qualified')} aria-label="Qualifier" title="Qualifier (à traiter)" className="p-1.5 rounded-lg border" style={{ borderColor: 'var(--card-border)', color: '#059669' }}><Check size={12} /></button>}
              {m.status !== 'ignored' && <button onClick={() => onStatus(m.id, 'ignored')} aria-label="Ignorer" title="Ignorer" className="p-1.5 rounded-lg border" style={{ borderColor: 'var(--card-border)', color: 'var(--text-secondary)' }}><EyeOff size={12} /></button>}
            </div>
          </li>);
      })}
    </ul>
  );
}

export function SerpTable({ rows }: { rows: SerpRow[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, SerpRow[]>();
    for (const r of rows) { const k = `${SOURCE_LABEL[r.engine]} · ${r.query}`; map.set(k, [...(map.get(k) ?? []), r]); }
    return [...map.entries()];
  }, [rows]);
  if (!groups.length) return <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Aucun relevé SERP.</p>;
  return (
    <div className="space-y-4">
      {groups.map(([k, list]) => (
        <div key={k}>
          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>{k} · {fmt(list[0].captured_at)}</p>
          <table className="w-full text-sm"><tbody>
            {list.filter(r => r.url).length === 0 && <tr><td className="py-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>Aucun résultat lu lors de ce relevé.</td></tr>}
            {list.filter(r => r.url && r.position != null).map(r => {
              const delta = r.previous_position == null ? null : r.previous_position - (r.position as number);
              const href = safeHref(r.url);
              return (
                <tr key={r.url as string} className="border-t" style={{ borderColor: 'var(--card-border)' }}>
                  <td className="py-1.5 w-10 font-mono" style={{ color: 'var(--text-primary)' }}>{r.position}</td>
                  <td className="py-1.5 w-20 text-xs">{r.is_new ? <span className="font-semibold" style={{ color: '#2563EB' }}>Nouveau</span>
                    : delta ? <span style={{ color: delta > 0 ? '#059669' : '#DC2626' }}>{delta > 0 ? `▲ ${delta}` : `▼ ${-delta}`}</span> : <span style={{ color: 'var(--text-secondary)' }}>=</span>}</td>
                  <td className="py-1.5 truncate max-w-0" style={{ color: 'var(--text-primary)' }}>{href ? <a href={href} target="_blank" rel="noopener noreferrer" className="hover:underline">{r.title || href}</a> : r.title}
                    <span className="block text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{r.url}</span></td>
                </tr>);
            })}
          </tbody></table>
        </div>))}
    </div>
  );
}

export default function WatchPage() {
  const qc = useQueryClient();
  const search = useSearch();
  const [, navigate] = useLocation();
  const [mentionStatus, setMentionStatus] = useState<'new' | 'qualified' | 'ignored' | ''>('new');
  const { data: campaigns = [] } = useQuery({
    queryKey: ['erep-campaigns', { showArchived: false }],
    queryFn: () => apiClient.get('/ereputation/campaigns') as Promise<CampaignLite[]>,
  });
  const selected = new URLSearchParams(search).get('campaign') || campaigns.find(c => c.status === 'active')?.id || campaigns[0]?.id || '';
  const enabled = !!selected;
  const overview = useQuery({
    queryKey: ['erep-watch', selected], enabled,
    queryFn: () => apiClient.get(`/ereputation/campaigns/${selected}/watch`) as Promise<Overview>,
  });
  const runs = useQuery({
    queryKey: ['erep-watch', selected, 'runs'], enabled,
    queryFn: () => apiClient.get(`/ereputation/campaigns/${selected}/watch/runs`) as Promise<Run[]>,
    refetchInterval: q => (q.state.data as Run[] | undefined)?.some(r => r.status === 'queued' || r.status === 'running') ? 4000 : false,
  });
  const active = runs.data?.some(r => r.status === 'queued' || r.status === 'running');
  const mentions = useQuery({
    queryKey: ['erep-watch', selected, 'mentions', mentionStatus], enabled,
    queryFn: () => apiClient.get(`/ereputation/campaigns/${selected}/mentions`, { params: mentionStatus ? { status: mentionStatus } : undefined }) as Promise<{ mentions: Mention[]; counts: Record<string, number> }>,
  });
  const serp = useQuery({ queryKey: ['erep-watch', selected, 'serp'], enabled, queryFn: () => apiClient.get(`/ereputation/campaigns/${selected}/watch/serp`) as Promise<SerpRow[]> });
  const reviews = useQuery({ queryKey: ['erep-watch', selected, 'reviews'], enabled, queryFn: () => apiClient.get(`/ereputation/campaigns/${selected}/reviews`) as Promise<ReviewsOverview> });
  // À la fin d'un passage, recharger fil, relevés et avis.
  useEffect(() => { if (!active && enabled) qc.invalidateQueries({ queryKey: ['erep-watch', selected] }); }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  const runNow = useMutation({
    mutationFn: () => apiClient.post(`/ereputation/campaigns/${selected}/watch/run`, {}) as Promise<Run>,
    onSuccess: () => { toast.success('Veille lancée'); qc.invalidateQueries({ queryKey: ['erep-watch', selected, 'runs'] }); },
    onError: e => toast.error(apiError(e, 'Lancement impossible')),
  });
  const runAction = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'resume' | 'cancel' }) => apiClient.post(`/ereputation/watch/runs/${id}/${action}`, {}) as Promise<Run>,
    onSuccess: (_r, v) => { toast.success(v.action === 'resume' ? 'Veille reprise' : 'Veille annulée'); qc.invalidateQueries({ queryKey: ['erep-watch', selected, 'runs'] }); },
    onError: e => toast.error(apiError(e, 'Action impossible')),
  });
  const qualify = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Mention['status'] }) => apiClient.patch(`/ereputation/mentions/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erep-watch', selected, 'mentions'] }),
    onError: e => toast.error(apiError(e, 'Qualification impossible')),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Radar size={22} style={{ color: 'var(--accent, #2563EB)' }} />
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Veille</h1>
        <select aria-label="Campagne" className="ml-auto px-3 py-2 rounded-lg border text-sm" style={inputStyle} value={selected}
          onChange={e => navigate(`/ereputation/watch?campaign=${e.target.value}`)}>
          {campaigns.map(c => <option key={c.id} value={c.id}>{c.name} — {c.targetType === 'B2C' ? 'Personne physique' : 'Entité'}</option>)}
        </select>
      </div>
      {!campaigns.length && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Créez d'abord une campagne dans SEO et réputation → Campagnes.</p>}
      {enabled && overview.data && <>
        <Section title="Passages" right={
          <button onClick={() => runNow.mutate()} disabled={runNow.isPending || active} className="px-3 py-2 rounded-lg text-sm font-medium text-white inline-flex items-center gap-2" style={{ background: 'var(--accent, #2563EB)', opacity: active ? 0.6 : 1 }}>
            {runNow.isPending || active ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} {active ? 'Veille en cours' : 'Lancer maintenant'}
          </button>}>
          <RunsList runs={runs.data ?? []} onResume={id => runAction.mutate({ id, action: 'resume' })} onCancel={id => runAction.mutate({ id, action: 'cancel' })} />
        </Section>
        <Section title={`Fil des mentions${mentions.data ? ` · ${mentions.data.counts.newSinceBaseline} nouveauté(s), ${mentions.data.counts.negative} négative(s)` : ''}`} right={
          <select aria-label="Filtre des mentions" className="px-2 py-1 rounded-lg border text-sm" style={inputStyle} value={mentionStatus} onChange={e => setMentionStatus(e.target.value as typeof mentionStatus)}>
            <option value="new">À traiter</option><option value="qualified">Qualifiées</option><option value="ignored">Ignorées</option><option value="">Toutes</option>
          </select>}>
          <MentionsFeed mentions={mentions.data?.mentions ?? []} onStatus={(id, status) => qualify.mutate({ id, status })} />
        </Section>
        <div className="grid lg:grid-cols-2 gap-6">
          <Section title="Résultats de recherche (dernier relevé)"><SerpTable rows={serp.data ?? []} /></Section>
          <Section title="Avis">
            {reviews.data?.stats.length ? <div className="flex flex-wrap gap-3">{reviews.data.stats.map(s => (
              <div key={s.source} className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--card-border)' }}>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{SOURCE_LABEL[s.source]}</p>
                <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{s.rating != null ? `${s.rating.toLocaleString('fr-FR')}/5` : '—'}
                  <span className="text-xs font-normal ml-1" style={{ color: 'var(--text-secondary)' }}>{s.review_count != null ? `${s.review_count} avis` : ''}</span></p>
              </div>))}</div> : <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Aucune fiche relevée. Ajoutez une fiche Google Maps ou PagesJaunes dans les réglages.</p>}
            <ul className="space-y-2">{(reviews.data?.reviews ?? []).slice(0, 15).map(r => (
              <li key={r.id} className="text-sm border-t pt-2" style={{ borderColor: 'var(--card-border)' }}>
                <span className="text-xs" style={{ color: SENTIMENT[r.sentiment]?.color }}>{r.rating != null ? `${r.rating}/5` : SENTIMENT[r.sentiment]?.label}</span>
                <span className="text-xs ml-2" style={{ color: 'var(--text-secondary)' }}>{SOURCE_LABEL[r.source]} · {r.author ?? 'Anonyme'} · {r.review_date ?? ''}{r.owner_response ? ' · réponse publiée' : ''}</span>
                {r.text && <p style={{ color: 'var(--text-primary)' }}>{r.text}</p>}
              </li>))}</ul>
          </Section>
        </div>
        <Section title="Réglages de la veille"><SettingsForm campaignId={selected} overview={overview.data} /></Section>
      </>}
      {enabled && overview.isLoading && <Loader2 className="animate-spin" size={20} />}
    </div>
  );
}
