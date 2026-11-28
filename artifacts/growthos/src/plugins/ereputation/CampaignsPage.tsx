import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield, Plus, Loader2, X, Search, Pencil, Trash2, History, Building2, User, Link2,
} from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';

/**
 * Campagnes e-réputation — lot 1 (fondations).
 * Cible « B2B » = entité, « B2C » = personne physique (mandat RGPD obligatoire).
 * Styles : variables du thème existant uniquement (aucune refonte visuelle,
 * périmètre design de l'agent 1).
 */

type TargetType = 'B2B' | 'B2C';
type Status = 'active' | 'paused' | 'archived';

interface Campaign {
  id: string;
  name: string;
  targetType: TargetType;
  targetName: string;
  targetUrl: string | null;
  keywords: string[];
  description: string | null;
  prospectId: string | null;
  prospectLabel: string | null;
  subjectAliases: string[];
  subjectLocation: string | null;
  subjectRole: string | null;
  mandate: { reference: string | null; signatory: string | null; signedAt: string | null; scope: string | null; retentionUntil: string | null };
  status: Status;
  reputationScore: number | null;
  createdAt: string;
}

interface HistoryEntry {
  id: string;
  action: 'create' | 'update' | 'status' | 'delete' | 'retention_purge';
  actor: { email: string | null };
  changes: Record<string, { before: unknown; after: unknown }>;
  redacted: boolean;
  createdAt: string;
}

interface ProspectHit { id: string; company: string | null; firstName: string | null; lastName: string | null; city: string | null }

const STATUS_LABEL: Record<Status, string> = { active: 'Active', paused: 'En pause', archived: 'Archivée' };
const TYPE_LABEL: Record<TargetType, string> = { B2B: 'Entité', B2C: 'Personne physique' };
const ACTION_LABEL: Record<HistoryEntry['action'], string> = {
  create: 'Création', update: 'Modification', status: 'Statut', delete: 'Suppression', retention_purge: 'Purge RGPD (fin de conservation)',
};
const FIELD_LABEL: Record<string, string> = {
  name: 'Nom', targetType: 'Type de cible', targetName: 'Cible', targetUrl: 'URL', keywords: 'Mots-clés', description: 'Description',
  prospectId: 'Fiche CRM', subjectAliases: 'Variantes du nom', subjectLocation: 'Localisation', subjectRole: 'Fonction / activité',
  mandateReference: 'Référence du mandat', mandateSignatory: 'Signataire', mandateSignedAt: 'Signature du mandat',
  mandateScope: 'Périmètre du mandat', retentionUntil: 'Fin de conservation', status: 'Statut', deletedData: 'Données supprimées',
};

const SCORE_COLOR = (s: number) => s >= 70 ? '#059669' : s >= 40 ? '#D97706' : '#DC2626';
const SCORE_BG = (s: number) => s >= 70 ? '#F0FDF4' : s >= 40 ? '#FFFBEB' : '#FEF2F2';

const today = () => new Date().toISOString().slice(0, 10);
const plusOneYear = (d: string) => { const x = new Date(d); x.setFullYear(x.getFullYear() + 1); return x.toISOString().slice(0, 10); };

interface FormState {
  name: string; targetType: TargetType; targetName: string; targetUrl: string; keywords: string; description: string;
  prospectId: string | null; prospectLabel: string; subjectAliases: string; subjectLocation: string; subjectRole: string;
  mandateReference: string; mandateSignatory: string; mandateSignedAt: string; mandateScope: string; retentionUntil: string;
}

const EMPTY_FORM: FormState = {
  name: '', targetType: 'B2B', targetName: '', targetUrl: '', keywords: '', description: '',
  prospectId: null, prospectLabel: '', subjectAliases: '', subjectLocation: '', subjectRole: '',
  mandateReference: '', mandateSignatory: '', mandateSignedAt: '', mandateScope: '', retentionUntil: '',
};

function fromCampaign(c: Campaign): FormState {
  return {
    name: c.name, targetType: c.targetType, targetName: c.targetName, targetUrl: c.targetUrl ?? '',
    keywords: c.keywords.join(', '), description: c.description ?? '',
    prospectId: c.prospectId, prospectLabel: c.prospectLabel ?? '',
    subjectAliases: c.subjectAliases.join(', '), subjectLocation: c.subjectLocation ?? '', subjectRole: c.subjectRole ?? '',
    mandateReference: c.mandate.reference ?? '', mandateSignatory: c.mandate.signatory ?? '',
    mandateSignedAt: c.mandate.signedAt ?? '', mandateScope: c.mandate.scope ?? '', retentionUntil: c.mandate.retentionUntil ?? '',
  };
}

const splitList = (v: string) => v.split(',').map(k => k.trim()).filter(Boolean);
const orNull = (v: string) => v.trim() || null;

function toPayload(f: FormState) {
  return {
    name: f.name.trim(), targetType: f.targetType, targetName: f.targetName.trim(),
    targetUrl: orNull(f.targetUrl), keywords: splitList(f.keywords), description: orNull(f.description),
    prospectId: f.prospectId, subjectAliases: splitList(f.subjectAliases),
    subjectLocation: orNull(f.subjectLocation), subjectRole: orNull(f.subjectRole),
    mandateReference: orNull(f.mandateReference), mandateSignatory: orNull(f.mandateSignatory),
    mandateSignedAt: f.mandateSignedAt || null, mandateScope: orNull(f.mandateScope), retentionUntil: f.retentionUntil || null,
  };
}

function apiError(error: unknown, fallback: string): string {
  const e = error as { response?: { data?: { error?: string } }; message?: string };
  return e?.response?.data?.error || e?.message || fallback;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  if (typeof v === 'object') return Object.entries(v as Record<string, unknown>).map(([k, n]) => `${k} : ${n}`).join(', ');
  if (v === 'B2B' || v === 'B2C') return TYPE_LABEL[v];
  if (v === 'active' || v === 'paused' || v === 'archived') return STATUS_LABEL[v];
  return String(v);
}

const inputStyle = { background: 'var(--body-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' };
const inputClass = 'w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none';

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>{label}</label>
      {children}
      {hint && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
    </div>
  );
}

function ProspectPicker({ value, label, onChange }: { value: string | null; label: string; onChange: (id: string | null, label: string) => void }) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebounced(query.trim()), 300); return () => clearTimeout(t); }, [query]);
  const { data, isFetching } = useQuery({
    queryKey: ['erep-prospect-search', debounced],
    queryFn: () => apiClient.get('/prospects', { params: { search: debounced, limit: 8 } }) as Promise<{ data: ProspectHit[] }>,
    enabled: debounced.length >= 2 && !value,
  });
  if (value) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 border rounded-xl text-sm" style={inputStyle}>
        <Link2 size={13} style={{ color: 'var(--text-muted)' }} />
        <span className="flex-1 truncate">{label || 'Fiche liée'}</span>
        <button type="button" onClick={() => onChange(null, '')} aria-label="Retirer la fiche CRM" style={{ color: 'var(--text-muted)' }}><X size={14} /></button>
      </div>
    );
  }
  return (
    <div className="relative">
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher une fiche du CRM (2 caractères min.)"
        className={inputClass} style={inputStyle} />
      {debounced.length >= 2 && (
        <div className="mt-1 rounded-xl border max-h-48 overflow-auto" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          {isFetching ? <div className="p-2 text-xs" style={{ color: 'var(--text-muted)' }}>Recherche…</div>
            : (data?.data ?? []).length === 0 ? <div className="p-2 text-xs" style={{ color: 'var(--text-muted)' }}>Aucune fiche</div>
              : data!.data.map(p => {
                const name = p.company || [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Sans nom';
                return (
                  <button key={p.id} type="button" onClick={() => { onChange(p.id, name); setQuery(''); }}
                    className="w-full text-left px-3 py-2 text-sm hover:opacity-80" style={{ color: 'var(--text-primary)' }}>
                    {name}{p.city ? <span style={{ color: 'var(--text-muted)' }}> · {p.city}</span> : null}
                  </button>
                );
              })}
        </div>
      )}
    </div>
  );
}

function CampaignForm({ initial, editing, pending, onCancel, onSubmit }: {
  initial: FormState; editing: boolean; pending: boolean; onCancel: () => void; onSubmit: (f: FormState) => void;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }));
  const person = form.targetType === 'B2C';

  const submit = () => {
    if (!form.name.trim() || !form.targetName.trim()) { toast.error('Nom de campagne et cible requis'); return; }
    if (person && (!form.mandateReference.trim() || !form.mandateSignatory.trim() || !form.mandateSignedAt || !form.retentionUntil)) {
      toast.error('Personne physique : référence, signataire, date du mandat et fin de conservation sont obligatoires'); return;
    }
    onSubmit(form);
  };

  return (
    <div className="space-y-4">
      <Field label="Nom de la campagne *">
        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex : Réputation Albert Ducamps 2026" className={inputClass} style={inputStyle} />
      </Field>
      <Field label="Type de cible *">
        <div className="flex gap-2">
          {(['B2B', 'B2C'] as const).map(t => (
            <button key={t} type="button" onClick={() => setForm(f => ({
              ...f, targetType: t,
              ...(t === 'B2C' && !f.mandateSignedAt ? { mandateSignedAt: today(), retentionUntil: f.retentionUntil || plusOneYear(today()) } : {}),
            }))}
              className="flex-1 py-2 rounded-xl text-sm font-medium border transition-all flex items-center justify-center gap-1.5"
              style={{
                background: form.targetType === t ? (t === 'B2B' ? '#2563EB' : '#7C3AED') : 'var(--body-bg)',
                color: form.targetType === t ? '#fff' : 'var(--text-secondary)',
                borderColor: form.targetType === t ? 'transparent' : 'var(--card-border)',
              }}>
              {t === 'B2B' ? <Building2 size={13} /> : <User size={13} />}{TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </Field>
      <Field label={person ? 'Nom et prénom de la personne *' : "Nom de l'entité *"}>
        <input value={form.targetName} onChange={e => set('targetName', e.target.value)}
          placeholder={person ? 'Ex : Albert Ducamps' : 'Ex : Acme SAS'} className={inputClass} style={inputStyle} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={person ? 'Fonction / activité' : 'Activité'}>
          <input value={form.subjectRole} onChange={e => set('subjectRole', e.target.value)} placeholder={person ? 'Ex : dirigeant, Acme SAS' : 'Ex : plomberie'} className={inputClass} style={inputStyle} />
        </Field>
        <Field label="Localisation">
          <input value={form.subjectLocation} onChange={e => set('subjectLocation', e.target.value)} placeholder="Ex : Lille (59)" className={inputClass} style={inputStyle} />
        </Field>
      </div>
      <Field label="Variantes du nom (séparées par des virgules)" hint="Aide à distinguer les homonymes lors de la veille.">
        <input value={form.subjectAliases} onChange={e => set('subjectAliases', e.target.value)} placeholder={person ? 'A. Ducamps, Albert D.' : 'Acme, Acme France'} className={inputClass} style={inputStyle} />
      </Field>
      <Field label="Fiche CRM liée (client ou prospect)">
        <ProspectPicker value={form.prospectId} label={form.prospectLabel} onChange={(id, label) => setForm(f => ({ ...f, prospectId: id, prospectLabel: label }))} />
      </Field>
      <Field label="URL principale">
        <input value={form.targetUrl} onChange={e => set('targetUrl', e.target.value)} placeholder="https://example.com" className={inputClass} style={inputStyle} />
      </Field>
      <Field label="Mots-clés suivis (séparés par des virgules)">
        <input value={form.keywords} onChange={e => set('keywords', e.target.value)} placeholder={person ? 'albert ducamps, albert ducamps lille' : 'acme avis, acme lille'} className={inputClass} style={inputStyle} />
      </Field>
      <Field label="Description / objectif">
        <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} className={inputClass} style={inputStyle} />
      </Field>

      {person && (
        <div className="rounded-xl border p-3 space-y-3" style={{ borderColor: '#7C3AED55', background: 'var(--body-bg)' }}>
          <div className="text-xs font-semibold" style={{ color: '#7C3AED' }}>Mandat RGPD (obligatoire pour une personne physique)</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Référence du mandat *">
              <input value={form.mandateReference} onChange={e => set('mandateReference', e.target.value)} placeholder="Ex : MAND-2026-014" className={inputClass} style={inputStyle} />
            </Field>
            <Field label="Signataire *">
              <input value={form.mandateSignatory} onChange={e => set('mandateSignatory', e.target.value)} placeholder="Ex : Albert Ducamps" className={inputClass} style={inputStyle} />
            </Field>
            <Field label="Date de signature *">
              <input type="date" value={form.mandateSignedAt} max={today()} onChange={e => set('mandateSignedAt', e.target.value)} className={inputClass} style={inputStyle} />
            </Field>
            <Field label="Fin de conservation *" hint="À cette date, la campagne et ses données sont purgées.">
              <input type="date" value={form.retentionUntil} min={form.mandateSignedAt || undefined} onChange={e => set('retentionUntil', e.target.value)} className={inputClass} style={inputStyle} />
            </Field>
          </div>
          <Field label="Périmètre du mandat">
            <textarea value={form.mandateScope} onChange={e => set('mandateScope', e.target.value)} rows={2} placeholder="Ex : veille et contre-mesures sur les résultats Google nominatifs" className={inputClass} style={inputStyle} />
          </Field>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl border text-sm" style={{ borderColor: 'var(--card-border)', color: 'var(--text-muted)' }}>
          Annuler
        </button>
        <button type="button" onClick={submit} disabled={pending}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg,#1E3A5F,#2563EB)' }}>
          {pending ? <Loader2 size={14} className="animate-spin" /> : editing ? <Pencil size={14} /> : <Plus size={14} />}
          {editing ? 'Enregistrer' : 'Créer'}
        </button>
      </div>
    </div>
  );
}

function HistoryPanel({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['erep-history', campaign.id],
    queryFn: () => apiClient.get(`/ereputation/campaigns/${campaign.id}/history`) as Promise<HistoryEntry[]>,
  });
  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-auto p-5 border-l" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Historique des interventions</h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{campaign.name}</p>
          </div>
          <button onClick={onClose} aria-label="Fermer" style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>
        {isLoading ? <Loader2 size={20} className="animate-spin" />
          : isError ? <p className="text-sm" style={{ color: '#DC2626' }}>Historique indisponible.</p>
            : data.length === 0 ? <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aucune intervention enregistrée.</p>
              : (
                <ol className="space-y-3">
                  {data.map(e => (
                    <li key={e.id} className="rounded-xl border p-3" style={{ borderColor: 'var(--card-border)' }}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{ACTION_LABEL[e.action] ?? e.action}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{new Date(e.createdAt).toLocaleString('fr-FR')}</span>
                      </div>
                      <div className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Par {e.actor.email ?? 'système'}</div>
                      <ul className="space-y-0.5">
                        {Object.entries(e.changes).map(([k, v]) => (
                          <li key={k} className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            <span className="font-medium">{FIELD_LABEL[k] ?? k}</span> : {e.action === 'create' ? formatValue(v.after) : `${formatValue(v.before)} → ${formatValue(v.after)}`}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              )}
      </div>
    </div>
  );
}

export default function CampaignsPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; campaign: Campaign } | null>(null);
  const [historyOf, setHistoryOf] = useState<Campaign | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const { data: campaigns = [], isLoading, isError } = useQuery({
    queryKey: ['erep-campaigns', { showArchived }],
    queryFn: () => apiClient.get('/ereputation/campaigns', { params: showArchived ? { includeArchived: 'true' } : undefined }) as Promise<Campaign[]>,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['erep-campaigns'] });

  const createMut = useMutation({
    mutationFn: (f: FormState) => apiClient.post('/ereputation/campaigns', toPayload(f)) as Promise<Campaign>,
    onSuccess: (c) => { toast.success(`Campagne « ${c.name} » créée`); refresh(); setModal(null); },
    onError: (e) => toast.error(apiError(e, 'Création impossible')),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, f }: { id: string; f: FormState }) => apiClient.patch(`/ereputation/campaigns/${id}`, toPayload(f)) as Promise<Campaign>,
    onSuccess: (c) => { toast.success(`Campagne « ${c.name} » enregistrée`); refresh(); qc.invalidateQueries({ queryKey: ['erep-history', c.id] }); setModal(null); },
    onError: (e) => toast.error(apiError(e, 'Modification impossible')),
  });
  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) => apiClient.post(`/ereputation/campaigns/${id}/status`, { status }) as Promise<Campaign>,
    onSuccess: (c) => { toast.success(`Statut : ${STATUS_LABEL[c.status]}`); refresh(); },
    onError: (e) => toast.error(apiError(e, 'Changement de statut impossible')),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/ereputation/campaigns/${id}`) as Promise<{ deleted: boolean; redacted: boolean }>,
    onSuccess: (r) => { toast.success(r.redacted ? 'Campagne supprimée, données personnelles purgées' : 'Campagne supprimée'); setConfirmDelete(null); refresh(); },
    onError: (e) => toast.error(apiError(e, 'Suppression impossible')),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return campaigns.filter(c => c.name.toLowerCase().includes(q) || c.targetName.toLowerCase().includes(q));
  }, [campaigns, search]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Campagnes E-Réputation</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{campaigns.length} campagne{campaigns.length > 1 ? 's' : ''} · entités et personnes physiques</p>
        </div>
        <button onClick={() => setModal({ mode: 'create' })}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: 'linear-gradient(135deg,#1E3A5F,#2563EB)' }}>
          <Plus size={14} />Nouvelle campagne
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une campagne ou une cible…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none"
            style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
        </div>
        <label className="flex items-center gap-2 text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
          <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />Afficher les archivées
        </label>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-primary)' }} /></div>
      ) : isError ? (
        <p className="text-sm text-center py-16" style={{ color: '#DC2626' }}>Lecture des campagnes impossible. Réessayez ou consultez le centre de diagnostic.</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Shield size={40} className="mx-auto mb-3" style={{ color: 'var(--card-border)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{search ? 'Aucun résultat' : 'Aucune campagne — cliquez sur « Nouvelle campagne »'}</p>
        </div>
      ) : (
        <div className="rounded-2xl border overflow-x-auto" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--card-border)', background: 'var(--body-bg)' }}>
                {['Campagne', 'Cible', 'Mots-clés', 'Statut', 'Score', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--card-border)' : undefined }}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{c.name}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {c.targetName}{c.subjectLocation ? ` · ${c.subjectLocation}` : ''}{c.prospectLabel ? ` · CRM : ${c.prospectLabel}` : ''}
                    </div>
                    {c.targetType === 'B2C' && c.mandate.retentionUntil && (
                      <div className="text-xs" style={{ color: '#7C3AED' }}>Mandat {c.mandate.reference} · conservation jusqu'au {new Date(c.mandate.retentionUntil).toLocaleDateString('fr-FR')}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-1 rounded-full font-medium text-white inline-flex items-center gap-1 whitespace-nowrap"
                      style={{ background: c.targetType === 'B2B' ? '#2563EB' : '#7C3AED' }}>
                      {c.targetType === 'B2B' ? <Building2 size={11} /> : <User size={11} />}{TYPE_LABEL[c.targetType]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.keywords.slice(0, 3).map(kw => (
                        <span key={kw} className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--body-bg)', color: 'var(--text-muted)' }}>{kw}</span>
                      ))}
                      {c.keywords.length > 3 && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>+{c.keywords.length - 3}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select value={c.status} disabled={statusMut.isPending} aria-label="Statut de la campagne"
                      onChange={e => statusMut.mutate({ id: c.id, status: e.target.value as Status })}
                      className="text-xs px-2 py-1 rounded-lg border" style={inputStyle}>
                      {(Object.keys(STATUS_LABEL) as Status[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {c.reputationScore == null
                      ? <span className="text-xs" style={{ color: 'var(--text-muted)' }} title="Aucune mesure réelle">Non évalué</span>
                      : <span className="text-sm font-bold px-2 py-1 rounded-lg" style={{ background: SCORE_BG(c.reputationScore), color: SCORE_COLOR(c.reputationScore) }}>{c.reputationScore}/100</span>}
                  </td>
                  <td className="px-4 py-3">
                    {confirmDelete === c.id ? (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => deleteMut.mutate(c.id)} disabled={deleteMut.isPending}
                          className="text-xs px-2.5 py-1.5 rounded-lg text-white" style={{ background: '#DC2626' }}>
                          {deleteMut.isPending ? <Loader2 size={11} className="animate-spin" /> : 'Confirmer'}
                        </button>
                        <button onClick={() => setConfirmDelete(null)} className="text-xs px-2 py-1.5 rounded-lg border" style={{ borderColor: 'var(--card-border)', color: 'var(--text-muted)' }}>Annuler</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setModal({ mode: 'edit', campaign: c })} title="Modifier" aria-label="Modifier"
                          className="p-1.5 rounded-lg border" style={{ borderColor: 'var(--card-border)', color: 'var(--text-secondary)' }}><Pencil size={12} /></button>
                        <button onClick={() => setHistoryOf(c)} title="Historique" aria-label="Historique"
                          className="p-1.5 rounded-lg border" style={{ borderColor: 'var(--card-border)', color: 'var(--text-secondary)' }}><History size={12} /></button>
                        <button onClick={() => setConfirmDelete(c.id)} title="Supprimer définitivement" aria-label="Supprimer"
                          className="p-1.5 rounded-lg border" style={{ borderColor: 'var(--card-border)', color: '#DC2626' }}><Trash2 size={12} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto py-6" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl border shadow-2xl w-full max-w-lg mx-4 p-6 max-h-full overflow-auto" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{modal.mode === 'edit' ? 'Modifier la campagne' : 'Nouvelle campagne'}</h2>
              <button onClick={() => setModal(null)} aria-label="Fermer" style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <CampaignForm
              key={modal.mode === 'edit' ? modal.campaign.id : 'new'}
              initial={modal.mode === 'edit' ? fromCampaign(modal.campaign) : EMPTY_FORM}
              editing={modal.mode === 'edit'}
              pending={createMut.isPending || updateMut.isPending}
              onCancel={() => setModal(null)}
              onSubmit={f => modal.mode === 'edit' ? updateMut.mutate({ id: modal.campaign.id, f }) : createMut.mutate(f)}
            />
          </div>
        </div>
      )}

      {historyOf && <HistoryPanel campaign={historyOf} onClose={() => setHistoryOf(null)} />}
    </div>
  );
}
