import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { ArrowLeft, CheckCircle, AlertCircle, Play, Pause, Settings, Activity, Loader2, Save, RefreshCw, Zap, Clock, BarChart2 } from 'lucide-react';
import { toast } from 'sonner';

const PLUGIN_DATA: Record<string, any> = {
  'linkedin-enricher': {
    name: 'LinkedIn Enricher', icon: '💼', version: '2.1.0', status: 'active', category: 'enrichment',
    description: 'Enrichit automatiquement les profils prospects avec données LinkedIn — poste, entreprise, ancienneté, réseau.',
    author: 'GrowthOS Labs', executions: 1247, lastRun: 'il y a 5 min', errors: 3,
    config: [
      { key: 'api_key', label: 'Clé API LinkedIn', type: 'password', value: '••••••••••••••••' },
      { key: 'rate_limit', label: 'Limite par heure', type: 'number', value: '100' },
      { key: 'auto_enrich', label: 'Enrichissement automatique', type: 'toggle', value: true },
      { key: 'fields', label: 'Champs à enrichir', type: 'text', value: 'title,company,connections' },
    ],
    logs: [
      { time: '14:22', msg: 'Sophie Martin — enrichie (poste, entreprise, 342 connexions)', ok: true },
      { time: '14:18', msg: 'Emma Leroy — enrichie (poste, ancienneté)', ok: true },
      { time: '13:45', msg: 'Paul Dupont — profil non trouvé (timeout)', ok: false },
      { time: '13:20', msg: '15 prospects enrichis en batch', ok: true },
    ],
  },
  'ai-email-composer': {
    name: 'AI Email Composer', icon: '🤖', version: '1.3.2', status: 'active', category: 'ai',
    description: 'Génère des emails de prospection personnalisés avec GPT-4o — ton, longueur et contexte adaptés à chaque prospect.',
    author: 'GrowthOS Labs', executions: 3204, lastRun: 'il y a 2 min', errors: 0,
    config: [
      { key: 'openai_key', label: 'Clé API OpenAI', type: 'password', value: '••••••••••••••••' },
      { key: 'model', label: 'Modèle', type: 'select', value: 'gpt-4o', options: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
      { key: 'tone', label: 'Ton par défaut', type: 'select', value: 'professionnel', options: ['professionnel', 'amical', 'formel', 'décontracté'] },
      { key: 'max_tokens', label: 'Longueur max (tokens)', type: 'number', value: '300' },
    ],
    logs: [
      { time: '15:01', msg: 'Email généré pour Sophie Martin (487 tokens, ton professionnel)', ok: true },
      { time: '14:55', msg: 'Batch 12 emails — génération terminée en 8.2s', ok: true },
      { time: '14:30', msg: 'Email personnalisé pour GrowthCo — séquence J+3', ok: true },
    ],
  },
  'slack-notify': {
    name: 'Slack Notifications', icon: '💬', version: '1.2.0', status: 'active', category: 'notifications',
    description: 'Notifications en temps réel dans vos channels Slack — nouveaux signaux, deals gagnés, alertes.',
    author: 'GrowthOS Community', executions: 2103, lastRun: 'il y a 30 min', errors: 1,
    config: [
      { key: 'webhook_url', label: 'Webhook URL Slack', type: 'password', value: 'https://hooks.slack.com/••••' },
      { key: 'channel', label: 'Channel par défaut', type: 'text', value: '#growth-alerts' },
      { key: 'on_deal_won', label: 'Notif. deal gagné', type: 'toggle', value: true },
      { key: 'on_signal', label: 'Notif. nouveau signal', type: 'toggle', value: true },
    ],
    logs: [
      { time: '14:30', msg: 'Notification envoyée — Deal gagné : GrowthCo 9 600€', ok: true },
      { time: '13:15', msg: 'Notification envoyée — 3 nouveaux signaux chauds', ok: true },
      { time: '11:45', msg: 'Erreur webhook — channel #sales introuvable', ok: false },
    ],
  },
};

const DEFAULT_PLUGIN = (name: string) => ({
  name, icon: '🧩', version: '1.0.0', status: 'active', category: 'other',
  description: 'Plugin installé dans GrowthOS.', author: 'Éditeur tiers',
  executions: 0, lastRun: 'jamais', errors: 0, config: [], logs: [],
});

export default function PluginDetailPage() {
  const params = useParams<{ name: string }>();
  const [, navigate] = useLocation();
  const slug = params.name || '';
  const rawPlugin = PLUGIN_DATA[slug] || DEFAULT_PLUGIN(slug);
  const [plugin, setPlugin] = useState(rawPlugin);
  const [tab, setTab] = useState<'overview' | 'config' | 'logs'>('overview');
  const [config, setConfig] = useState<Record<string, any>>(
    Object.fromEntries((rawPlugin.config || []).map((c: any) => [c.key, c.value]))
  );
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  const saveConfig = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 900));
    setSaving(false);
    toast.success('Configuration sauvegardée');
  };

  const toggleStatus = async () => {
    setToggling(true);
    await new Promise(r => setTimeout(r, 600));
    setPlugin((p: any) => ({ ...p, status: p.status === 'active' ? 'inactive' : 'active' }));
    setToggling(false);
    toast.success(plugin.status === 'active' ? 'Plugin désactivé' : 'Plugin activé');
  };

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: 'var(--body-bg)' }}>
      {/* Back */}
      <button onClick={() => navigate('/plugins')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', marginBottom: 20, padding: 0 }}>
        <ArrowLeft size={14} />Retour aux plugins
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--card-bg)', border: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>{plugin.icon}</div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{plugin.name}</h1>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 9999, background: 'var(--body-bg)', color: 'var(--text-muted)', border: '1px solid var(--card-border)' }}>v{plugin.version}</span>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 9999, background: plugin.status === 'active' ? '#ECFDF5' : '#F3F4F6', color: plugin.status === 'active' ? '#059669' : '#6B7280', fontWeight: 600 }}>
              {plugin.status === 'active' ? '● Actif' : '○ Inactif'}
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 8px' }}>{plugin.description}</p>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Par {plugin.author} · Catégorie : {plugin.category}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={toggleStatus} disabled={toggling}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {toggling ? <Loader2 size={13} className="animate-spin" /> : plugin.status === 'active' ? <Pause size={13} /> : <Play size={13} />}
            {plugin.status === 'active' ? 'Désactiver' : 'Activer'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { l: 'Exécutions', v: plugin.executions.toLocaleString(), icon: <Zap size={15} />, c: 'text-blue-600 bg-blue-50' },
          { l: 'Dernière exéc.', v: plugin.lastRun, icon: <Clock size={15} />, c: 'text-green-600 bg-green-50' },
          { l: 'Erreurs', v: plugin.errors, icon: <AlertCircle size={15} />, c: plugin.errors > 0 ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50' },
        ].map((s, i) => (
          <div key={i} style={{ padding: '14px 16px', borderRadius: 14, background: 'var(--card-bg)', border: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.c} flex-shrink-0`}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{s.v}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.l}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--card-border)', marginBottom: 20 }}>
        {([['overview', 'Vue d\'ensemble'], ['config', 'Configuration'], ['logs', 'Journaux']] as const).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '10px 20px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: tab === t ? 'var(--color-primary)' : 'var(--text-muted)', borderBottom: tab === t ? '2px solid var(--color-primary)' : '2px solid transparent' }}>{l}</button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: 'var(--card-bg)', borderRadius: 14, border: '1px solid var(--card-border)', padding: 18 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>Informations</h3>
            {[
              { l: 'Nom', v: plugin.name },
              { l: 'Version', v: plugin.version },
              { l: 'Auteur', v: plugin.author },
              { l: 'Catégorie', v: plugin.category },
              { l: 'Statut', v: plugin.status === 'active' ? '● Actif' : '○ Inactif' },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--card-border)', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>{r.l}</span>
                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{r.v}</span>
              </div>
            ))}
          </div>
          <div style={{ background: 'var(--card-bg)', borderRadius: 14, border: '1px solid var(--card-border)', padding: 18 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>Activité récente</h3>
            {(plugin.logs || []).slice(0, 4).map((log: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                {log.ok ? <CheckCircle size={13} color="#059669" style={{ marginTop: 1 }} /> : <AlertCircle size={13} color="#DC2626" style={{ marginTop: 1 }} />}
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{log.msg}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{log.time}</div>
                </div>
              </div>
            ))}
            {(plugin.logs || []).length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucune activité</div>}
          </div>
        </div>
      )}

      {/* Config */}
      {tab === 'config' && (
        <div style={{ background: 'var(--card-bg)', borderRadius: 14, border: '1px solid var(--card-border)', padding: 24, maxWidth: 560 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 18 }}>Configuration du plugin</h3>
          {plugin.config.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Ce plugin ne nécessite aucune configuration.</div>
          ) : (
            <>
              {plugin.config.map((field: any) => (
                <div key={field.key} style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>{field.label}</label>
                  {field.type === 'toggle' ? (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                      <div onClick={() => setConfig(c => ({ ...c, [field.key]: !c[field.key] }))}
                        style={{ width: 44, height: 24, borderRadius: 12, background: config[field.key] ? 'var(--color-primary)' : '#D1D5DB', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}>
                        <div style={{ position: 'absolute', top: 3, left: config[field.key] ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,.2)' }} />
                      </div>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{config[field.key] ? 'Activé' : 'Désactivé'}</span>
                    </label>
                  ) : field.type === 'select' ? (
                    <select value={config[field.key]} onChange={e => setConfig(c => ({ ...c, [field.key]: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}>
                      {(field.options || []).map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <input type={field.type} value={config[field.key]} onChange={e => setConfig(c => ({ ...c, [field.key]: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                  )}
                </div>
              ))}
              <button onClick={saveConfig} disabled={saving}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? 'Sauvegarde…' : 'Sauvegarder'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Logs */}
      {tab === 'logs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(plugin.logs || []).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>Aucun journal disponible</div>
          ) : (
            (plugin.logs || []).map((log: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: 'var(--card-bg)', border: `1px solid ${log.ok ? 'var(--card-border)' : '#FECACA'}` }}>
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{log.time}</span>
                {log.ok ? <CheckCircle size={14} color="#059669" /> : <AlertCircle size={14} color="#DC2626" />}
                <span style={{ fontSize: 13, color: log.ok ? 'var(--text-primary)' : '#DC2626' }}>{log.msg}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
