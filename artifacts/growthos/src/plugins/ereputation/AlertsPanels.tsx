import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Bell, Check, Loader2, Mail, RotateCcw, Save, ShieldAlert, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'wouter';
import apiClient from '@/lib/api-client';

/**
 * E-réputation — lot 3 : score expliqué, alertes, plan de crise et e-mails.
 * Styles : variables du thème existant uniquement (périmètre design de l'agent 1).
 * Aucun bouton ne publie ni n'envoie quoi que ce soit à l'extérieur de l'agence.
 */

export interface ScoreFactor { label: string; impact: number; tone: 'neg' | 'pos' | 'info'; url?: string | null; component?: string }
export interface ScoreComponent { key: string; label: string; measured: boolean; value: number | null; weight: number; effectiveWeight: number; points: number | null; basis: string; factors: ScoreFactor[] }
export interface ScoreExplanation {
  score: number | null; level: { key: string; label: string }; components: ScoreComponent[]; summary: string[];
  topFactors: ScoreFactor[]; unmeasured: { key: string; label: string; basis: string }[];
  previous: { day: string; score: number; delta: number; byComponent: { key: string; label: string; delta: number }[] } | null;
  history: { day: string; score: number }[];
}
export interface Alert { id: string; campaign_id: string; campaign_name: string; type: string; severity: 'high' | 'medium' | 'low'; title: string; description: string | null; href: string | null; is_resolved: boolean; created_at: string; emailed_at: string | null }
interface CrisisAction { id: string; label: string; level: number; done: boolean; doneAt: string | null; doneBy: string | null; assigneeId: string | null }
interface CrisisPlan { id: string; level: number; status: 'open' | 'closed'; reasons: string[]; actions: CrisisAction[]; close_note: string | null; opened_at: string; escalated_at: string | null; closed_at: string | null }
export interface CrisisState { current: { level: number; reasons: string[] }; open: CrisisPlan | null; history: CrisisPlan[] }
interface Member { id: string; email: string; name: string | null; role: string }
interface EmailState { settings: { daily: boolean; weekly: boolean; immediateCritical: boolean; recipients: string[]; mode: 'smtp' | 'log' | 'off'; lastSends: { kind: string; status: string; error: string | null; sent_at: string }[] }; members: Member[] }

export const CRISIS_LABEL: Record<number, string> = { 0: 'Aucun', 1: 'Vigilance', 2: 'Alerte', 3: 'Crise' };
const CRISIS_COLOR: Record<number, string> = { 0: '#059669', 1: '#D97706', 2: '#EA580C', 3: '#DC2626' };
const SEVERITY: Record<Alert['severity'], { label: string; color: string }> = { high: { label: 'Critique', color: '#DC2626' }, medium: { label: 'Importante', color: '#D97706' }, low: { label: 'Information', color: '#6B7280' } };
const LEVEL_COLOR: Record<string, string> = { excellent: '#059669', good: '#16A34A', fragile: '#D97706', critical: '#DC2626', none: '#6B7280' };
const SEND_KIND: Record<string, string> = { daily: 'Quotidien', weekly: 'Hebdomadaire', immediate: 'Immédiat', test: 'Test' };
const SEND_STATUS: Record<string, string> = { sent: 'envoyé', failed: 'échec', empty: 'rien à signaler' };

const card = { background: 'var(--card-bg)', borderColor: 'var(--card-border)' } as const;
const inputStyle = { background: 'var(--input-bg, var(--card-bg))', borderColor: 'var(--card-border)', color: 'var(--text-primary)' } as const;
const muted = { color: 'var(--text-secondary)' } as const;
const strong = { color: 'var(--text-primary)' } as const;
const fmt = (v: string | null) => v ? new Date(v).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Paris' }) : '—';
const pts = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} pt${Math.abs(v) >= 2 ? 's' : ''}`;
const safeHref = (v: string | null | undefined) => { try { const u = new URL(v || ''); return /^https?:$/.test(u.protocol) ? u.href : null; } catch { return null; } };
function apiError(error: unknown, fallback: string): string {
  const e = error as { response?: { data?: { error?: string } }; message?: string };
  return e?.response?.data?.error || e?.message || fallback;
}

function Panel({ id, title, icon, right, children }: { id?: string; title: string; icon?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="rounded-xl border p-5 space-y-4 scroll-mt-4" style={card}>
      <div className="flex items-center justify-between gap-3"><h2 className="font-semibold inline-flex items-center gap-2" style={strong}>{icon}{title}</h2>{right}</div>
      {children}
    </section>
  );
}

/** Explication du score : résumé, composantes (valeur, poids, points), facteurs chiffrés, courbe. */
export function ScoreBreakdown({ data, compact = false }: { data: ScoreExplanation; compact?: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <p className="text-4xl font-bold" style={{ color: LEVEL_COLOR[data.level.key] }}>{data.score ?? '—'}<span className="text-base font-normal" style={muted}>/100</span></p>
          <p className="text-sm font-medium" style={{ color: LEVEL_COLOR[data.level.key] }}>{data.level.label}</p>
        </div>
        {data.previous && <p className="text-sm" style={{ color: data.previous.delta >= 0 ? '#059669' : '#DC2626' }}>
          {data.previous.delta >= 0 ? '▲' : '▼'} {Math.abs(data.previous.delta)} depuis le {new Date(data.previous.day).toLocaleDateString('fr-FR')}</p>}
      </div>
      <ul className="space-y-1 text-sm" aria-label="Pourquoi ce score">{data.summary.map((s, i) => <li key={i} style={i === 0 ? strong : muted}>{s}</li>)}</ul>
      <div className="grid sm:grid-cols-2 gap-3">
        {data.components.map(c => (
          <div key={c.key} className="rounded-lg border p-3" style={{ borderColor: 'var(--card-border)', opacity: c.measured ? 1 : 0.7 }}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-semibold" style={strong}>{c.label}</p>
              <p className="text-sm" style={strong}>{c.measured ? <>{c.value}/100 <span className="text-xs" style={muted}>· {Math.round(c.effectiveWeight * 100)} % · {c.points?.toLocaleString('fr-FR')} pts</span></> : <span className="text-xs" style={muted}>Non mesuré</span>}</p>
            </div>
            {c.measured && <div className="h-1.5 rounded mt-1.5" style={{ background: 'var(--card-border)' }}><div className="h-1.5 rounded" style={{ width: `${c.value}%`, background: (c.value ?? 0) >= 60 ? '#059669' : (c.value ?? 0) >= 40 ? '#D97706' : '#DC2626' }} /></div>}
            <p className="text-xs mt-1.5" style={muted}>{c.basis} · poids nominal {Math.round(c.weight * 100)} %</p>
            {!compact && c.factors.length > 0 && <ul className="mt-2 space-y-1">{c.factors.slice(0, 5).map((f, i) => {
              const href = safeHref(f.url);
              return <li key={i} className="text-xs flex gap-2"><span className="font-mono shrink-0 w-16 text-right" style={{ color: f.impact < 0 ? '#DC2626' : '#059669' }}>{pts(f.impact)}</span>
                <span style={strong}>{href ? <a href={href} target="_blank" rel="noopener noreferrer" className="hover:underline">{f.label}</a> : f.label}</span></li>;
            })}</ul>}
          </div>))}
      </div>
      {!compact && data.history.length > 1 && <div className="h-40" aria-label="Évolution du score">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.history.map(h => ({ ...h, label: new Date(h.day).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} width={30} />
            <Tooltip formatter={(v: number) => [`${v}/100`, 'Score']} />
            <Line type="monotone" dataKey="score" stroke="var(--accent, #2563EB)" strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>}
      {!compact && <p className="text-xs" style={muted}>Pondération : résultats de recherche 40 %, sentiment des mentions 30 %, avis 20 %, liens 10 %, répartie sur les seules composantes mesurées. Chaque facteur indique les points gagnés ou perdus par rapport à un élément neutre.</p>}
    </div>
  );
}

export function useScore(campaignId: string) {
  return useQuery({ queryKey: ['erep-score', campaignId], enabled: !!campaignId, queryFn: () => apiClient.get(`/ereputation/campaigns/${campaignId}/score`) as Promise<ScoreExplanation> });
}

export function ScorePanel({ campaignId }: { campaignId: string }) {
  const score = useScore(campaignId);
  return (
    <Panel id="erep-score" title="Score de réputation expliqué">
      {score.isLoading ? <Loader2 className="animate-spin" size={18} /> : score.data ? <ScoreBreakdown data={score.data} /> : <p className="text-sm" style={muted}>Score indisponible.</p>}
    </Panel>
  );
}

export function AlertsList({ alerts, onResolve }: { alerts: Alert[]; onResolve: (id: string, resolved: boolean) => void }) {
  if (!alerts.length) return <p className="text-sm" style={muted}>Aucune alerte.</p>;
  return (
    <ul className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
      {alerts.map(a => (
        <li key={a.id} className="py-2.5 flex gap-3" style={{ opacity: a.is_resolved ? 0.6 : 1 }}>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs mb-0.5">
              <span className="font-semibold" style={{ color: SEVERITY[a.severity].color }}>{SEVERITY[a.severity].label}</span>
              <span style={muted}>{fmt(a.created_at)}</span>
              {a.emailed_at && <span style={muted}>· e-mail envoyé</span>}
              {a.is_resolved && <span style={muted}>· traitée</span>}
            </div>
            <p className="text-sm font-medium" style={strong}>{a.title}</p>
            {a.description && <p className="text-xs line-clamp-2" style={muted}>{a.description}</p>}
          </div>
          <button onClick={() => onResolve(a.id, !a.is_resolved)} aria-label={a.is_resolved ? 'Rouvrir' : 'Marquer comme traitée'} title={a.is_resolved ? 'Rouvrir' : 'Marquer comme traitée'}
            className="self-start p-1.5 rounded-lg border" style={{ borderColor: 'var(--card-border)', color: a.is_resolved ? 'var(--text-secondary)' : '#059669' }}>
            {a.is_resolved ? <RotateCcw size={12} /> : <Check size={12} />}
          </button>
        </li>))}
    </ul>
  );
}

export function AlertsPanel({ campaignId }: { campaignId: string }) {
  const qc = useQueryClient();
  const [onlyOpen, setOnlyOpen] = useState(true);
  const alerts = useQuery({ queryKey: ['erep-alerts', campaignId, onlyOpen], enabled: !!campaignId,
    queryFn: () => apiClient.get('/ereputation/alerts', { params: { campaignId, ...(onlyOpen ? { open: '1' } : {}) } }) as Promise<Alert[]> });
  const resolve = useMutation({
    mutationFn: ({ id, resolved }: { id: string; resolved: boolean }) => apiClient.patch(`/ereputation/alerts/${id}`, { resolved }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erep-alerts', campaignId] }),
    onError: e => toast.error(apiError(e, 'Mise à jour impossible')),
  });
  return (
    <Panel id="erep-alerts" title={`Alertes${alerts.data ? ` · ${alerts.data.filter(a => !a.is_resolved).length} à traiter` : ''}`} icon={<Bell size={16} />} right={
      <select aria-label="Filtre des alertes" className="px-2 py-1 rounded-lg border text-sm" style={inputStyle} value={onlyOpen ? 'open' : 'all'} onChange={e => setOnlyOpen(e.target.value === 'open')}>
        <option value="open">À traiter</option><option value="all">Toutes</option>
      </select>}>
      <AlertsList alerts={alerts.data ?? []} onResolve={(id, resolved) => resolve.mutate({ id, resolved })} />
    </Panel>
  );
}

export function CrisisView({ data, members, onToggle, onAssign, onClose }: {
  data: CrisisState; members: Member[]; onToggle: (actionId: string, done: boolean) => void; onAssign: (actionId: string, userId: string | null) => void; onClose: (note: string) => void;
}) {
  const [note, setNote] = useState('');
  const plan = data.open;
  return (
    <div className="space-y-3">
      <p className="text-sm"><span style={muted}>Niveau mesuré : </span><strong style={{ color: CRISIS_COLOR[data.current.level] }}>{CRISIS_LABEL[data.current.level]}</strong>
        {data.current.reasons.length > 0 && <span style={muted}> — {data.current.reasons.join(' · ')}</span>}</p>
      {!plan && <p className="text-sm" style={muted}>Aucun plan de crise ouvert. Un plan s'ouvre automatiquement quand un seuil est franchi ; il ne se ferme que sur décision de l'agence.</p>}
      {plan && <div className="rounded-lg border p-3 space-y-3" style={{ borderColor: CRISIS_COLOR[plan.level] }}>
        <p className="text-sm font-semibold" style={{ color: CRISIS_COLOR[plan.level] }}>Plan « {CRISIS_LABEL[plan.level]} » ouvert le {fmt(plan.opened_at)}{plan.escalated_at ? ` · relevé le ${fmt(plan.escalated_at)}` : ''}</p>
        <p className="text-xs" style={muted}>{plan.reasons.join(' · ')}</p>
        <ul className="space-y-2">{plan.actions.map(a => (
          <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
            <label className="inline-flex items-start gap-2 flex-1 min-w-[200px] cursor-pointer">
              <input type="checkbox" checked={a.done} onChange={e => onToggle(a.id, e.target.checked)} className="mt-0.5" />
              <span style={{ ...strong, textDecoration: a.done ? 'line-through' : 'none' }}>{a.label}
                <span className="text-xs ml-1" style={muted}>({CRISIS_LABEL[a.level]}{a.done && a.doneBy ? ` · fait par ${a.doneBy}` : ''})</span></span>
            </label>
            <select aria-label={`Responsable : ${a.label}`} className="px-2 py-1 rounded-lg border text-xs" style={inputStyle} value={a.assigneeId ?? ''} onChange={e => onAssign(a.id, e.target.value || null)}>
              <option value="">Non attribuée</option>{members.map(m => <option key={m.id} value={m.id}>{m.name ?? m.email}</option>)}
            </select>
          </li>))}</ul>
        <div className="flex flex-wrap gap-2">
          <input aria-label="Note de clôture" placeholder="Note de clôture (facultative)" className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg border text-sm" style={inputStyle} value={note} onChange={e => setNote(e.target.value)} />
          <button onClick={() => onClose(note)} className="px-3 py-1.5 rounded-lg border text-sm" style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}>Clôturer le plan</button>
        </div>
      </div>}
      {data.history.length > 0 && <p className="text-xs" style={muted}>Plans clôturés : {data.history.map(p => `${CRISIS_LABEL[p.level]} (${fmt(p.opened_at)} → ${fmt(p.closed_at)})`).join(' · ')}</p>}
    </div>
  );
}

function useMembers() {
  return useQuery({ queryKey: ['erep-alert-email'], queryFn: () => apiClient.get('/ereputation/alert-email') as Promise<EmailState> });
}

export function CrisisPanel({ campaignId }: { campaignId: string }) {
  const qc = useQueryClient();
  const crisis = useQuery({ queryKey: ['erep-crisis', campaignId], enabled: !!campaignId, queryFn: () => apiClient.get(`/ereputation/campaigns/${campaignId}/crisis`) as Promise<CrisisState> });
  const members = useMembers();
  const refresh = () => { qc.invalidateQueries({ queryKey: ['erep-crisis', campaignId] }); qc.invalidateQueries({ queryKey: ['erep-alerts', campaignId] }); };
  const evaluate = useMutation({ mutationFn: () => apiClient.post(`/ereputation/campaigns/${campaignId}/crisis/evaluate`, {}), onSuccess: refresh, onError: e => toast.error(apiError(e, 'Évaluation impossible')) });
  const action = useMutation({
    mutationFn: ({ actionId, body }: { actionId: string; body: Record<string, unknown> }) => apiClient.patch(`/ereputation/crisis/${crisis.data?.open?.id}/actions/${actionId}`, body),
    onSuccess: refresh, onError: e => toast.error(apiError(e, 'Mise à jour impossible')),
  });
  const close = useMutation({
    mutationFn: (note: string) => apiClient.post(`/ereputation/crisis/${crisis.data?.open?.id}/close`, { note }),
    onSuccess: () => { toast.success('Plan de crise clôturé'); refresh(); }, onError: e => toast.error(apiError(e, 'Clôture impossible')),
  });
  return (
    <Panel id="erep-crisis" title="Plan de crise" icon={<ShieldAlert size={16} />} right={
      <button onClick={() => evaluate.mutate()} disabled={evaluate.isPending} className="px-2 py-1 rounded-lg border text-xs inline-flex items-center gap-1" style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}>
        {evaluate.isPending ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Réévaluer</button>}>
      {crisis.data ? <CrisisView data={crisis.data} members={members.data?.members ?? []}
        onToggle={(actionId, done) => action.mutate({ actionId, body: { done } })} onAssign={(actionId, assigneeId) => action.mutate({ actionId, body: { assigneeId } })}
        onClose={note => close.mutate(note)} /> : <Loader2 className="animate-spin" size={18} />}
    </Panel>
  );
}

export function EmailSettingsPanel() {
  const qc = useQueryClient();
  const state = useMembers();
  const [form, setForm] = useState<EmailState['settings'] | null>(state.data?.settings ?? null);
  useEffect(() => { if (state.data) setForm(state.data.settings); }, [state.data]);
  const save = useMutation({
    mutationFn: () => apiClient.put('/ereputation/alert-email', { daily: form!.daily, weekly: form!.weekly, immediateCritical: form!.immediateCritical, recipients: form!.recipients }) as Promise<EmailState>,
    onSuccess: data => { toast.success('Réglages e-mail enregistrés'); qc.setQueryData(['erep-alert-email'], data); },
    onError: e => toast.error(apiError(e, 'Enregistrement impossible')),
  });
  const test = useMutation({
    mutationFn: () => apiClient.post('/ereputation/alert-email/test', {}) as Promise<{ sent: boolean; error?: string; recipients: number; mode: string }>,
    onSuccess: r => { r.sent ? toast.success(r.mode === 'log' ? 'Test journalisé (mode recette, rien envoyé)' : `Test envoyé à ${r.recipients} destinataire(s)`) : toast.error(r.error ?? 'Envoi impossible'); qc.invalidateQueries({ queryKey: ['erep-alert-email'] }); },
    onError: e => toast.error(apiError(e, 'Envoi impossible')),
  });
  if (!state.data || !form) return <Panel title="E-mails d'alerte" icon={<Mail size={16} />}><Loader2 className="animate-spin" size={18} /></Panel>;
  const mode = state.data.settings.mode;
  const toggle = (id: string) => setForm(f => f && ({ ...f, recipients: f.recipients.includes(id) ? f.recipients.filter(x => x !== id) : [...f.recipients, id] }));
  return (
    <Panel id="erep-email" title="E-mails d'alerte (agence)" icon={<Mail size={16} />}>
      <p className="text-xs" style={{ color: mode === 'off' ? '#D97706' : 'var(--text-secondary)' }}>
        {mode === 'off' ? 'Envoi désactivé sur ce serveur (EREP_ALERT_EMAIL_ENABLED). Les réglages sont conservés et l’aperçu reste disponible.'
          : mode === 'log' ? 'Mode recette : les e-mails sont journalisés, rien n’est envoyé.' : 'Envoi par le SMTP de l’agence.'} Destinataires : membres de l’agence uniquement.</p>
      <div className="flex flex-wrap gap-4 text-sm" style={strong}>
        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.daily} onChange={e => setForm({ ...form, daily: e.target.checked })} /> Récapitulatif quotidien (8 h)</label>
        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.weekly} onChange={e => setForm({ ...form, weekly: e.target.checked })} /> Hebdomadaire (lundi 8 h)</label>
        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.immediateCritical} onChange={e => setForm({ ...form, immediateCritical: e.target.checked })} /> Immédiat pour les alertes critiques</label>
      </div>
      <fieldset className="flex flex-wrap gap-3 text-sm" style={strong}>
        <legend className="text-xs mb-1" style={muted}>Destinataires</legend>
        {state.data.members.map(m => <label key={m.id} className="inline-flex items-center gap-2"><input type="checkbox" checked={form.recipients.includes(m.id)} onChange={() => toggle(m.id)} /> {m.name ? `${m.name} (${m.email})` : m.email}</label>)}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => save.mutate()} disabled={save.isPending} className="px-3 py-2 rounded-lg text-sm font-medium text-white inline-flex items-center gap-2" style={{ background: 'var(--accent, #2563EB)' }}>
          {save.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer</button>
        <button onClick={() => test.mutate()} disabled={test.isPending || !state.data.settings.recipients.length} className="px-3 py-2 rounded-lg border text-sm inline-flex items-center gap-2" style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}>
          {test.isPending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />} Envoyer un test</button>
      </div>
      {state.data.settings.lastSends.length > 0 && <ul className="text-xs space-y-0.5" style={muted}>{state.data.settings.lastSends.slice(0, 5).map((s, i) =>
        <li key={i}>{SEND_KIND[s.kind] ?? s.kind} · {fmt(s.sent_at)} · {SEND_STATUS[s.status] ?? s.status}{s.error ? ` — ${s.error}` : ''}</li>)}</ul>}
    </Panel>
  );
}

/** Brouillon de réponse à un avis : à relire, copier et publier par l'agence elle-même. */
export function ReplyDraft({ reviewId, initial }: { reviewId: string; initial?: string | null }) {
  const [draft, setDraft] = useState(initial ?? '');
  const generate = useMutation({
    mutationFn: () => apiClient.post(`/ereputation/reviews/${reviewId}/reply-draft`, {}) as Promise<{ draft: string; source: string }>,
    onSuccess: r => setDraft(r.draft), onError: e => toast.error(apiError(e, 'Brouillon impossible')),
  });
  const copy = async () => { try { await navigator.clipboard.writeText(draft); toast.success('Brouillon copié'); } catch { toast.error('Copie impossible'); } };
  return (
    <div className="mt-1 space-y-1">
      {draft ? <>
        <textarea aria-label="Brouillon de réponse" className="w-full px-2 py-1.5 rounded-lg border text-xs" rows={3} style={inputStyle} value={draft} onChange={e => setDraft(e.target.value)} />
        <div className="flex gap-2 text-xs"><button onClick={copy} className="underline" style={strong}>Copier</button>
          <button onClick={() => generate.mutate()} className="underline" style={muted}>Régénérer</button>
          <span style={muted}>Brouillon à valider : rien n'est publié automatiquement.</span></div>
      </> : <button onClick={() => generate.mutate()} disabled={generate.isPending} className="text-xs underline inline-flex items-center gap-1" style={strong}>
        {generate.isPending && <Loader2 size={11} className="animate-spin" />} Préparer une réponse</button>}
    </div>
  );
}

export function ScoreLink({ campaignId }: { campaignId: string }) {
  return <Link href={`/ereputation/watch?campaign=${campaignId}&tab=score`} className="text-xs inline-flex items-center gap-1 hover:underline" style={muted}>Pourquoi ce score ? <ExternalLink size={11} /></Link>;
}
