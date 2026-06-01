import { useState } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Clock, Loader2, Settings, Zap, Database, ChevronRight, Play } from 'lucide-react';
import { toast } from 'sonner';

const INTEGRATIONS = [
  {
    id: 'hubspot',
    name: 'HubSpot CRM',
    icon: '🟠',
    description: 'Synchronisation contacts, deals et activités avec HubSpot',
    status: 'connected',
    lastSync: 'il y a 5 min',
    synced: 1247,
    errors: 0,
    fields: ['Contacts', 'Deals', 'Activités', 'Notes'],
    direction: 'bidirectional',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    icon: '☁️',
    description: 'Sync Salesforce Leads, Contacts, Opportunities',
    status: 'error',
    lastSync: 'il y a 2h',
    synced: 342,
    errors: 12,
    fields: ['Leads', 'Contacts', 'Opportunities'],
    direction: 'push',
  },
  {
    id: 'pipedrive',
    name: 'Pipedrive',
    icon: '🟢',
    description: 'Import/export des deals et contacts Pipedrive',
    status: 'idle',
    lastSync: 'jamais',
    synced: 0,
    errors: 0,
    fields: ['Contacts', 'Deals'],
    direction: 'pull',
  },
  {
    id: 'zoho',
    name: 'Zoho CRM',
    icon: '🔵',
    description: 'Synchronisation Zoho CRM — leads, comptes et contacts',
    status: 'idle',
    lastSync: 'jamais',
    synced: 0,
    errors: 0,
    fields: ['Leads', 'Accounts', 'Contacts'],
    direction: 'bidirectional',
  },
];

const SYNC_LOGS = [
  { time: '14:23', action: 'HubSpot → GrowthOS', detail: '14 nouveaux contacts importés', ok: true },
  { time: '14:18', action: 'GrowthOS → HubSpot', detail: '3 deals mis à jour', ok: true },
  { time: '13:45', action: 'Salesforce → GrowthOS', detail: 'Erreur authentification — token expiré', ok: false },
  { time: '12:10', action: 'HubSpot → GrowthOS', detail: '8 activités synchronisées', ok: true },
  { time: '11:34', action: 'GrowthOS → HubSpot', detail: '1 nouveau prospect créé', ok: true },
  { time: '11:20', action: 'Salesforce → GrowthOS', detail: 'Connexion échouée (timeout)', ok: false },
];

const FIELD_MAPPINGS: Record<string, Array<{ from: string; to: string; active: boolean }>> = {
  hubspot: [
    { from: 'firstname + lastname', to: 'Prénom + Nom', active: true },
    { from: 'email', to: 'Email', active: true },
    { from: 'company', to: 'Entreprise', active: true },
    { from: 'phone', to: 'Téléphone', active: true },
    { from: 'dealname', to: 'Titre deal', active: true },
    { from: 'amount', to: 'Valeur (€)', active: true },
    { from: 'dealstage', to: 'Étape pipeline', active: false },
  ],
};

const STATUS_CONFIG = {
  connected: { label: 'Connecté', color: '#059669', bg: '#ECFDF5', icon: <CheckCircle size={13} /> },
  error: { label: 'Erreur', color: '#DC2626', bg: '#FEF2F2', icon: <AlertCircle size={13} /> },
  idle: { label: 'Non configuré', color: '#6B7280', bg: '#F3F4F6', icon: <Clock size={13} /> },
  syncing: { label: 'En cours…', color: '#2563EB', bg: '#EFF6FF', icon: <Loader2 size={13} className="animate-spin" /> },
};

const DIR_LABELS: Record<string, string> = { bidirectional: '⇄ Bidirectionnel', push: '→ GrowthOS → CRM', pull: '← CRM → GrowthOS' };

export default function CRMSyncPage() {
  const [integrations, setIntegrations] = useState(INTEGRATIONS);
  const [selected, setSelected] = useState<string | null>('hubspot');
  const [syncing, setSyncing] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'logs' | 'mapping'>('overview');

  const triggerSync = async (id: string) => {
    setSyncing(id);
    setIntegrations(is => is.map(i => i.id === id ? { ...i, status: 'syncing' } : i));
    await new Promise(r => setTimeout(r, 2200));
    setSyncing(null);
    setIntegrations(is => is.map(i => i.id === id ? { ...i, status: 'connected', lastSync: 'à l\'instant', synced: i.synced + Math.floor(Math.random() * 20) } : i));
    toast.success(`Sync ${INTEGRATIONS.find(i => i.id === id)?.name} terminée`);
  };

  const connectNew = async (id: string) => {
    toast.info(`Redirection vers l'autorisation ${INTEGRATIONS.find(i => i.id === id)?.name}…`);
    await new Promise(r => setTimeout(r, 800));
    setIntegrations(is => is.map(i => i.id === id ? { ...i, status: 'connected', lastSync: 'à l\'instant' } : i));
    toast.success('Intégration connectée avec succès !');
  };

  const sel = integrations.find(i => i.id === selected);
  const totalSynced = integrations.reduce((s, i) => s + i.synced, 0);
  const totalErrors = integrations.reduce((s, i) => s + i.errors, 0);
  const connected = integrations.filter(i => i.status === 'connected').length;

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: 'var(--body-bg)' }}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>CRM Sync</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Synchronisation bidirectionnelle avec vos CRM externes</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { l: 'Connectés', v: connected, icon: <Database size={16} />, c: 'text-green-600 bg-green-50' },
          { l: 'Enregistrements sync.', v: totalSynced.toLocaleString(), icon: <RefreshCw size={16} />, c: 'text-blue-600 bg-blue-50' },
          { l: 'Erreurs de sync', v: totalErrors, icon: <AlertCircle size={16} />, c: totalErrors > 0 ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50' },
        ].map((k, i) => (
          <div key={i} className="rounded-2xl border p-4 flex items-center gap-3" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${k.c}`}>{k.icon}</div>
            <div>
              <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{k.v}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{k.l}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16 }}>
        {/* Left — CRM list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {integrations.map(intg => {
            const st = STATUS_CONFIG[intg.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.idle;
            return (
              <div key={intg.id} onClick={() => setSelected(intg.id)}
                style={{ padding: '14px 16px', borderRadius: 14, border: `1px solid ${selected === intg.id ? 'var(--color-primary)' : 'var(--card-border)'}`, background: 'var(--card-bg)', cursor: 'pointer', transition: 'all 0.15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--body-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{intg.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{intg.name}</div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: st.color, background: st.bg, padding: '2px 7px', borderRadius: 9999 }}>
                      {st.icon}{st.label}
                    </span>
                  </div>
                  <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                </div>
                {intg.synced > 0 && (
                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>{intg.synced.toLocaleString()} enregistrements · {intg.lastSync}</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right — Detail */}
        {sel && (
          <div style={{ background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--card-border)', overflow: 'hidden' }}>
            {/* Detail header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--body-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>{sel.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{sel.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sel.description}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{DIR_LABELS[sel.direction]}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {sel.status === 'idle' ? (
                  <button onClick={() => connectNew(sel.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    <Zap size={13} />Connecter
                  </button>
                ) : (
                  <button onClick={() => triggerSync(sel.id)} disabled={syncing === sel.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: syncing === sel.id ? 0.7 : 1 }}>
                    {syncing === sel.id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    {syncing === sel.id ? 'Sync…' : 'Sync maintenant'}
                  </button>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--card-border)' }}>
              {(['overview', 'logs', 'mapping'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{ padding: '12px 20px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: tab === t ? 'var(--color-primary)' : 'var(--text-muted)', borderBottom: tab === t ? '2px solid var(--color-primary)' : '2px solid transparent' }}>
                  {t === 'overview' ? 'Vue d\'ensemble' : t === 'logs' ? 'Journaux' : 'Mapping champs'}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ padding: 24 }}>
              {tab === 'overview' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                    {[
                      { l: 'Dernière sync', v: sel.lastSync },
                      { l: 'Enregistrements', v: sel.synced.toLocaleString() },
                      { l: 'Erreurs', v: sel.errors },
                      { l: 'Direction', v: DIR_LABELS[sel.direction] },
                    ].map((m, i) => (
                      <div key={i} style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--body-bg)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{m.l}</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{m.v}</div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Données synchronisées</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {sel.fields.map(f => (
                        <span key={f} style={{ padding: '5px 12px', borderRadius: 9999, background: 'var(--color-primary)', color: '#fff', fontSize: 12, fontWeight: 500 }}>{f}</span>
                      ))}
                    </div>
                  </div>
                  {sel.status === 'error' && (
                    <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 12, background: '#FEF2F2', border: '1px solid #FECACA' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#DC2626', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                        <AlertCircle size={14} />Erreur de synchronisation
                      </div>
                      <div style={{ fontSize: 12, color: '#7F1D1D' }}>Token d'authentification expiré. Reconnectez Salesforce pour reprendre la synchronisation.</div>
                      <button onClick={() => connectNew(sel.id)} style={{ marginTop: 10, padding: '7px 14px', borderRadius: 8, border: 'none', background: '#DC2626', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        Reconnecter
                      </button>
                    </div>
                  )}
                </div>
              )}

              {tab === 'logs' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {SYNC_LOGS.map((log, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, background: 'var(--body-bg)', border: `1px solid ${log.ok ? 'var(--card-border)' : '#FECACA'}` }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{log.time}</span>
                      {log.ok ? <CheckCircle size={14} color="#059669" /> : <AlertCircle size={14} color="#DC2626" />}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{log.action}</div>
                        <div style={{ fontSize: 11, color: log.ok ? 'var(--text-muted)' : '#DC2626' }}>{log.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tab === 'mapping' && (
                <div>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Correspondance des champs entre {sel.name} et GrowthOS</p>
                  {(FIELD_MAPPINGS[sel.id] || FIELD_MAPPINGS.hubspot).map((m, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, background: m.active ? 'var(--body-bg)' : 'transparent', border: '1px solid var(--card-border)', marginBottom: 8, opacity: m.active ? 1 : 0.5 }}>
                      <div style={{ flex: 1, fontSize: 13, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{m.from}</div>
                      <RefreshCw size={12} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{m.to}</div>
                      <div style={{ width: 32, height: 18, borderRadius: 9999, background: m.active ? 'var(--color-primary)' : 'var(--card-border)', position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
                        <div style={{ position: 'absolute', top: 2, left: m.active ? 14 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
