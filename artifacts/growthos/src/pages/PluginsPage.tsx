import { useState } from 'react';
import { useLocation } from 'wouter';
import {
  Puzzle, Play, Pause, Star, Search, Download, CheckCircle, Loader2,
  X, Package, Sparkles, TrendingUp, Bell, BarChart2,
  RefreshCw, Zap, Shield, AlertCircle, Activity, Cpu,
  ChevronRight, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRuntimePlugins, useEnablePlugin, useDisablePlugin, usePluginAudit, type RuntimePlugin, type AuditLog } from '@/hooks/use-plugins';

/* ─────────────── static marketplace data ─────────────── */

type Plugin = {
  id: string; name: string; slug: string; description: string;
  version: string; status: 'active' | 'inactive' | 'not_installed';
  category: string; rating: number; reviews: number; installs: number;
  icon: string; author: string; isNew?: boolean; isPro?: boolean;
  configFields?: { key: string; label: string; placeholder: string; type?: string }[];
  features?: string[];
};

const ALL_PLUGINS: Plugin[] = [
  { id:'1', name:'LinkedIn Enricher', slug:'linkedin-enricher', description:'Enrichit automatiquement les prospects avec données LinkedIn — poste, taille entreprise, activité récente.', version:'2.1.0', status:'active', category:'enrichment', rating:4.8, reviews:342, installs:12400, icon:'💼', author:'GrowthOS', features:['Enrichissement auto', 'Sync bidirectionnelle', 'Score LinkedIn'], configFields:[{key:'li_token',label:'Access Token',placeholder:'AQVJ...'},{key:'rate_limit',label:'Requêtes/jour',placeholder:'100'}] },
  { id:'2', name:'AI Email Composer', slug:'ai-email-composer', description:'Génère des emails ultra-personnalisés avec GPT-4 en un clic — contexte prospect + tone of voice configurable.', version:'1.3.2', status:'active', category:'ai', rating:4.9, reviews:891, installs:32000, icon:'🤖', author:'GrowthOS', isNew:true, features:['GPT-4 natif', 'Ton configurable', '50+ templates'], configFields:[{key:'openai_key',label:'OpenAI API Key',placeholder:'sk-...'},{key:'model',label:'Modèle',placeholder:'gpt-4-turbo'}] },
  { id:'3', name:'Hunter.io Integration', slug:'hunter-io', description:'Trouve et vérifie les emails professionnels via Hunter.io — 95% de précision sur les domaines B2B.', version:'1.0.5', status:'not_installed', category:'enrichment', rating:4.5, reviews:178, installs:8900, icon:'🎯', author:'Hunter.io', configFields:[{key:'api_key',label:'Clé API Hunter',placeholder:'xxxxxxxx'}] },
  { id:'4', name:'Clearbit Reveal', slug:'clearbit', description:'Identifie les visiteurs anonymes de votre site et les enrichit avec firmographics complets.', version:'3.0.1', status:'not_installed', category:'analytics', rating:4.7, reviews:256, installs:6500, icon:'🔍', author:'Clearbit', isPro:true, configFields:[{key:'api_key',label:'Clearbit API Key',placeholder:'sk_...'},{key:'webhook_url',label:'Webhook URL',placeholder:'https://...'}] },
  { id:'5', name:'Slack Notifications', slug:'slack-notify', description:'Alertes instantanées dans vos channels Slack — nouveau prospect, deal gagné, signal critique.', version:'1.2.0', status:'active', category:'notifications', rating:4.6, reviews:423, installs:21000, icon:'💬', author:'GrowthOS', features:['Alertes custom', 'Digest quotidien', 'Mention @équipe'], configFields:[{key:'webhook',label:'Webhook URL Slack',placeholder:'https://hooks.slack.com/services/...'},{key:'channel',label:'Channel',placeholder:'#commercial'}] },
  { id:'6', name:'Zapier Connector', slug:'zapier', description:'Connectez GrowthOS à 5000+ apps via Zapier — déclenchez des actions sur n\'importe quel événement.', version:'2.0.0', status:'not_installed', category:'automation', rating:4.4, reviews:312, installs:18000, icon:'⚡', author:'Zapier', configFields:[{key:'api_key',label:'Clé API Zapier',placeholder:'Générée dans votre compte Zapier'}] },
  { id:'7', name:'Salesforce Sync', slug:'salesforce-sync', description:'Synchronisation bidirectionnelle complète avec Salesforce CRM — deals, contacts, activités.', version:'1.5.2', status:'not_installed', category:'crm', rating:4.3, reviews:145, installs:4200, icon:'☁️', author:'GrowthOS', isPro:true, configFields:[{key:'sf_url',label:'Instance URL',placeholder:'https://myorg.salesforce.com'},{key:'token',label:'Access Token',placeholder:'00Dxxxxxx...'}] },
  { id:'8', name:'Email Verifier', slug:'email-verifier', description:'Vérifie en temps réel la validité des emails avant envoi — réduisez votre bounce rate à moins de 2%.', version:'1.1.0', status:'inactive', category:'enrichment', rating:4.6, reviews:89, installs:7300, icon:'✅', author:'GrowthOS', isNew:true, features:['SMTP check', 'MX validation', 'Disposable detection'], configFields:[{key:'api_key',label:'Verify API Key',placeholder:'vk_...'}] },
  { id:'9', name:'Google Analytics Bridge', slug:'ga-bridge', description:'Importe les données GA4 pour scorer vos prospects selon leur comportement sur votre site.', version:'1.0.1', status:'not_installed', category:'analytics', rating:4.2, reviews:67, installs:3100, icon:'📊', author:'GrowthOS', configFields:[{key:'measurement_id',label:'Measurement ID',placeholder:'G-XXXXXXXXXX'},{key:'api_secret',label:'API Secret',placeholder:'...'}] },
  { id:'10', name:'WhatsApp Business', slug:'whatsapp-biz', description:'Envoyez des messages WhatsApp depuis les séquences GrowthOS avec templates approuvés.', version:'1.0.0', status:'not_installed', category:'notifications', rating:4.1, reviews:44, installs:1800, icon:'📱', author:'GrowthOS', isNew:true, configFields:[{key:'phone_id',label:'Phone Number ID',placeholder:'1234567890'},{key:'token',label:'Access Token',placeholder:'EAA...'}] },
  { id:'11', name:'Lemlist Connect', slug:'lemlist', description:'Synchronise vos séquences et stats avec Lemlist — évitez la double saisie.', version:'2.2.1', status:'not_installed', category:'automation', rating:4.7, reviews:198, installs:9200, icon:'🌿', author:'Lemlist', configFields:[{key:'api_key',label:'Lemlist API Key',placeholder:'lm_...'}] },
  { id:'12', name:'AI Lead Scorer', slug:'ai-scorer', description:'Score IA basé sur 40 critères firmographiques et comportementaux — propensité d\'achat prédictive.', version:'1.2.0', status:'not_installed', category:'ai', rating:4.8, reviews:156, installs:5600, icon:'🧠', author:'GrowthOS', isPro:true, features:['40 critères', 'Mise à jour temps réel', 'Explainability'] },
];

const CATEGORIES = [
  { id:'all',          label:'Tous',             icon:<Package size={13}/> },
  { id:'enrichment',  label:'Enrichissement',   icon:<TrendingUp size={13}/> },
  { id:'ai',          label:'IA',               icon:<Sparkles size={13}/> },
  { id:'analytics',   label:'Analytics',        icon:<BarChart2 size={13}/> },
  { id:'crm',         label:'CRM',              icon:<RefreshCw size={13}/> },
  { id:'notifications',label:'Notifications',   icon:<Bell size={13}/> },
  { id:'automation',  label:'Automation',       icon:<Zap size={13}/> },
];

/* ─────────────── helpers ─────────────── */

function Stars({ rating, size = 11 }: { rating: number; size?: number }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={size} style={{ color: i <= Math.round(rating) ? '#F59E0B' : '#E5E7EB', fill: i <= Math.round(rating) ? '#F59E0B' : 'none' }} />
      ))}
    </span>
  );
}

const STATE_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  ACTIVE:     { bg: '#ECFDF5', color: '#059669', label: '● Actif' },
  DISABLED:   { bg: '#F3F4F6', color: '#6B7280', label: '○ Désactivé' },
  ERROR:      { bg: '#FEF2F2', color: '#DC2626', label: '✕ Erreur' },
  DISCOVERED: { bg: '#EFF6FF', color: '#2563EB', label: '◌ Découvert' },
  RESOLVING:  { bg: '#FFF7ED', color: '#D97706', label: '⟳ Résolution' },
};

/* ─────────────── install modal ─────────────── */
function InstallModal({ plugin, onClose, onInstall }: { plugin: Plugin; onClose: () => void; onInstall: () => void }) {
  const [config, setConfig] = useState<Record<string,string>>({});
  const [installing, setInstalling] = useState(false);
  const [step, setStep] = useState<'info' | 'config' | 'done'>('info');

  const set = (k: string, v: string) => setConfig(c => ({ ...c, [k]: v }));

  const install = async () => {
    if (plugin.configFields?.length && step === 'info') { setStep('config'); return; }
    setInstalling(true);
    await new Promise(r => setTimeout(r, 1200));
    setInstalling(false);
    setStep('done');
    setTimeout(() => { onInstall(); onClose(); }, 1000);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--card-bg)', borderRadius: 20, width: '100%', maxWidth: 460, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 24px', borderBottom: '1px solid var(--card-border)' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--body-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>{plugin.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <h2 style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', margin: 0 }}>{plugin.name}</h2>
              {plugin.isNew && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 9999, background: '#EDE9FE', color: '#7C3AED', fontWeight: 700 }}>NOUVEAU</span>}
              {plugin.isPro && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 9999, background: '#FEF3C7', color: '#D97706', fontWeight: 700 }}>PRO</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Stars rating={plugin.rating} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{plugin.rating} · {plugin.reviews} avis · {(plugin.installs/1000).toFixed(1)}k installs</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ padding: 24 }}>
          {step === 'done' ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <CheckCircle size={28} color="#059669" />
              </div>
              <h3 style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-primary)', marginBottom: 6 }}>Plugin installé !</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>{plugin.name} est maintenant actif</p>
            </div>
          ) : step === 'config' ? (
            <>
              <h3 style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 14 }}>Configuration</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {(plugin.configFields || []).map(f => (
                  <div key={f.key}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{f.label}</label>
                    <input type={f.type || 'text'} value={config[f.key] || ''} onChange={e => set(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--card-border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'var(--body-bg)', color: 'var(--text-primary)' }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setStep('info')} style={{ flex: 1, padding: 10, borderRadius: 12, border: '1px solid var(--card-border)', background: 'transparent', fontSize: 14, cursor: 'pointer', color: 'var(--text-muted)' }}>Retour</button>
                <button onClick={install} disabled={installing} style={{ flex: 2, padding: 10, borderRadius: 12, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: installing ? 0.7 : 1 }}>
                  {installing ? <><Loader2 size={14} className="animate-spin" />Installation...</> : <><CheckCircle size={14} />Installer</>}
                </button>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>{plugin.description}</p>
              {plugin.features && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Fonctionnalités</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {plugin.features.map(f => (
                      <span key={f} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '4px 10px', borderRadius: 9999, background: '#F5F3FF', color: '#6D28D9', fontWeight: 500 }}>
                        <CheckCircle size={11} />{f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, padding: '10px 14px', borderRadius: 10, background: 'var(--body-bg)', border: '1px solid var(--card-border)' }}>
                <Shield size={13} color="var(--text-muted)" />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Par <strong>{plugin.author}</strong> · v{plugin.version}</span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 12, border: '1px solid var(--card-border)', background: 'transparent', fontSize: 14, cursor: 'pointer', color: 'var(--text-muted)' }}>Annuler</button>
                <button onClick={install} style={{ flex: 2, padding: 10, borderRadius: 12, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Download size={14} />Installer{plugin.configFields?.length ? ' →' : ''}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────── runtime engine card ─────────────── */
function RuntimePluginCard({ plugin, onDetail }: { plugin: RuntimePlugin; onDetail: (p: RuntimePlugin) => void }) {
  const enable = useEnablePlugin();
  const disable = useDisablePlugin();
  const s = STATE_COLORS[plugin.state] || STATE_COLORS.DISABLED;
  const isActive = plugin.state === 'ACTIVE';
  const isDisabled = plugin.state === 'DISABLED';
  const busy = enable.isPending || disable.isPending;

  return (
    <div
      onClick={() => onDetail(plugin)}
      style={{ borderRadius: 16, border: `1.5px solid ${isActive ? 'var(--color-primary)' : 'var(--card-border)'}`, background: 'var(--card-bg)', overflow: 'hidden', cursor: 'pointer', transition: 'all .15s' }}>
      <div style={{ padding: '16px 16px 12px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--body-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0, position: 'relative' }}>
          <Cpu size={22} style={{ color: 'var(--text-muted)' }} />
          {isActive && <div style={{ position: 'absolute', bottom: -2, right: -2, width: 10, height: 10, borderRadius: '50%', background: '#22C55E', border: '2px solid var(--card-bg)' }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <h3 style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', margin: 0 }}>{plugin.name}</h3>
            <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 9999, background: s.bg, color: s.color, fontWeight: 600, whiteSpace: 'nowrap' }}>{s.label}</span>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 4px', fontFamily: 'monospace' }}>{plugin.id} · v{plugin.version}</p>
          {plugin.error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#DC2626', background: '#FEF2F2', padding: '4px 8px', borderRadius: 6, marginTop: 4 }}>
              <AlertCircle size={11} />{plugin.error}
            </div>
          )}
          {plugin.permissions.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
              {plugin.permissions.slice(0, 3).map(p => (
                <span key={p} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--body-bg)', color: 'var(--text-muted)', border: '1px solid var(--card-border)' }}>{p}</span>
              ))}
              {plugin.permissions.length > 3 && (
                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--body-bg)', color: 'var(--text-muted)' }}>+{plugin.permissions.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--body-bg)' }}>
        {plugin.activatedAt && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
            <Clock size={11} />
            {new Date(plugin.activatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <div style={{ flex: 1 }} />
        {(isActive || isDisabled) && (
          <button
            onClick={e => {
              e.stopPropagation();
              if (isActive) disable.mutate(plugin.id);
              else enable.mutate(plugin.id);
            }}
            disabled={busy}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: busy ? 'default' : 'pointer', background: isActive ? '#FEF3C7' : '#ECFDF5', color: isActive ? '#D97706' : '#059669', opacity: busy ? 0.6 : 1 }}>
            {busy ? <Loader2 size={11} className="animate-spin" /> : isActive ? <><Pause size={11} />Désactiver</> : <><Play size={11} />Activer</>}
          </button>
        )}
        <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
      </div>
    </div>
  );
}

/* ─────────────── runtime engine panel ─────────────── */
/* ─────────────── audit timeline ─────────────── */
const AUDIT_META: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  REGISTERED:          { icon: <Download size={13} />,    color: '#2563EB', bg: '#EFF6FF', label: 'Enregistré' },
  ENABLED:             { icon: <Play size={13} />,        color: '#059669', bg: '#ECFDF5', label: 'Activé' },
  DISABLED:            { icon: <Pause size={13} />,       color: '#D97706', bg: '#FFFBEB', label: 'Désactivé' },
  ACTIVATION_SUCCEEDED:{ icon: <CheckCircle size={13} />, color: '#059669', bg: '#ECFDF5', label: 'Activation OK' },
  ACTIVATION_FAILED:   { icon: <AlertCircle size={13} />, color: '#DC2626', bg: '#FEF2F2', label: 'Échec activation' },
};

function AuditTimeline() {
  const { data, isLoading, isError, refetch, isFetching } = usePluginAudit();
  const logs = data?.logs ?? [];

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={15} style={{ color: 'var(--color-primary)' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            Journal d'audit — {data?.total ?? 0} événement{(data?.total ?? 0) !== 1 ? 's' : ''}
          </span>
        </div>
        <button onClick={() => refetch()} disabled={isFetching}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
          <RefreshCw size={12} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} />
          Actualiser
        </button>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '48px 0', color: 'var(--text-muted)' }}>
          <Loader2 size={18} className="animate-spin" />
          <span style={{ fontSize: 14 }}>Chargement des logs…</span>
        </div>
      )}

      {isError && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '48px 0' }}>
          <AlertCircle size={28} style={{ color: '#DC2626' }} />
          <p style={{ fontSize: 14, color: '#DC2626', fontWeight: 600 }}>Impossible de charger l'audit</p>
          <button onClick={() => refetch()} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}>Réessayer</button>
        </div>
      )}

      {!isLoading && !isError && logs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <Activity size={36} style={{ margin: '0 auto 12px', color: 'var(--card-border)' }} />
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Aucun événement enregistré</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Les actions enable / disable / register apparaîtront ici.</p>
        </div>
      )}

      {!isLoading && !isError && logs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {logs.map((log: AuditLog, i: number) => {
            const meta = AUDIT_META[log.action] ?? AUDIT_META.ENABLED;
            const isLast = i === logs.length - 1;
            return (
              <div key={log.id} style={{ display: 'flex', gap: 0, position: 'relative' }}>
                {/* Timeline line */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32, flexShrink: 0 }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: meta.color, flexShrink: 0, zIndex: 1, border: `2px solid ${meta.color}22` }}>
                    {meta.icon}
                  </div>
                  {!isLast && <div style={{ width: 2, flex: 1, background: 'var(--card-border)', minHeight: 16 }} />}
                </div>

                {/* Content */}
                <div style={{ flex: 1, paddingLeft: 14, paddingBottom: isLast ? 0 : 16 }}>
                  <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 9999, background: meta.bg, color: meta.color, fontWeight: 700 }}>{meta.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{log.pluginName}</span>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{log.pluginId}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                        <Clock size={10} />{fmt(log.createdAt)}
                      </span>
                      {log.actorEmail && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>par <strong>{log.actorEmail}</strong></span>
                      )}
                      {(log.metadata as any)?.version && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>v{(log.metadata as any).version}</span>
                      )}
                    </div>

                    {/* Error detail */}
                    {(log.metadata as any)?.error && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 6, padding: '6px 10px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA' }}>
                        <AlertCircle size={11} color="#DC2626" style={{ marginTop: 1, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: '#DC2626' }}>{String((log.metadata as any).error)}</span>
                      </div>
                    )}

                    {/* Permissions badge row */}
                    {Array.isArray((log.metadata as any)?.permissions) && (log.metadata as any).permissions.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                        {((log.metadata as any).permissions as string[]).slice(0, 4).map((p: string) => (
                          <span key={p} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#F0FDF4', color: '#059669', border: '1px solid #BBF7D0', fontFamily: 'monospace' }}>{p}</span>
                        ))}
                        {((log.metadata as any).permissions as string[]).length > 4 && (
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', padding: '2px 4px' }}>+{((log.metadata as any).permissions as string[]).length - 4}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────────── runtime engine panel ─────────────── */
function RuntimeEnginePanel({ onDetail }: { onDetail: (p: RuntimePlugin) => void }) {
  const { data, isLoading, isError, refetch, isFetching } = useRuntimePlugins();
  const [tab, setTab] = useState<'plugins' | 'audit'>('plugins');
  const plugins = data?.plugins ?? [];
  const active = plugins.filter(p => p.state === 'ACTIVE');
  const disabled = plugins.filter(p => p.state === 'DISABLED');
  const errors = plugins.filter(p => p.state === 'ERROR');

  return (
    <div>
      {/* Runtime stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { l: 'Total', v: plugins.length, color: '#6D28D9', bg: '#F5F3FF' },
          { l: 'Actifs', v: active.length, color: '#059669', bg: '#ECFDF5' },
          { l: 'Désactivés', v: disabled.length, color: '#6B7280', bg: '#F3F4F6' },
          { l: 'Erreurs', v: errors.length, color: errors.length > 0 ? '#DC2626' : '#059669', bg: errors.length > 0 ? '#FEF2F2' : '#ECFDF5' },
        ].map(s => (
          <div key={s.l} style={{ borderRadius: 12, border: '1px solid var(--card-border)', background: 'var(--card-bg)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, color: s.color }}>{s.v}</div>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{s.l}</span>
          </div>
        ))}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--card-border)', marginBottom: 20 }}>
        {([
          ['plugins', <><Cpu size={13} />Plugins</>],
          ['audit',   <><Activity size={13} />Audit</>],
        ] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: tab === t ? 'var(--color-primary)' : 'var(--text-muted)', borderBottom: tab === t ? '2px solid var(--color-primary)' : '2px solid transparent' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Audit tab */}
      {tab === 'audit' && <AuditTimeline />}

      {/* Plugins tab */}
      {tab === 'plugins' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Cpu size={15} style={{ color: 'var(--color-primary)' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Plugins enregistrés au runtime</span>
            </div>
            <button onClick={() => refetch()} disabled={isFetching}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
              <RefreshCw size={12} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} />
              Actualiser
            </button>
          </div>

          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '48px 0', color: 'var(--text-muted)' }}>
              <Loader2 size={18} className="animate-spin" />
              <span style={{ fontSize: 14 }}>Connexion au Runtime Engine…</span>
            </div>
          )}

          {isError && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '48px 0' }}>
              <AlertCircle size={32} style={{ color: '#DC2626' }} />
              <p style={{ fontSize: 14, color: '#DC2626', fontWeight: 600 }}>Runtime Engine inaccessible</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>Vérifiez que l'API server est démarré et que vous êtes connecté.</p>
              <button onClick={() => refetch()} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}>Réessayer</button>
            </div>
          )}

          {!isLoading && !isError && plugins.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <Cpu size={36} style={{ margin: '0 auto 12px', color: 'var(--card-border)' }} />
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Aucun plugin enregistré dans le runtime</p>
            </div>
          )}

          {!isLoading && !isError && plugins.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(310px,1fr))', gap: 14 }}>
              {plugins.map(p => <RuntimePluginCard key={p.id} plugin={p} onDetail={onDetail} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─────────────── runtime detail drawer ─────────────── */
function RuntimeDetailDrawer({ plugin, onClose }: { plugin: RuntimePlugin; onClose: () => void }) {
  const enable = useEnablePlugin();
  const disable = useDisablePlugin();
  const s = STATE_COLORS[plugin.state] || STATE_COLORS.DISABLED;
  const isActive = plugin.state === 'ACTIVE';
  const isDisabled = plugin.state === 'DISABLED';
  const busy = enable.isPending || disable.isPending;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)' }} onClick={onClose} />
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 420, background: 'var(--card-bg)', boxShadow: '-4px 0 40px rgba(0,0,0,.15)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--body-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Cpu size={24} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <h2 style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', margin: 0 }}>{plugin.name}</h2>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 9999, background: s.bg, color: s.color, fontWeight: 600 }}>{s.label}</span>
            </div>
            <p style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-muted)', margin: 0 }}>{plugin.id} · v{plugin.version}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, flexShrink: 0 }}><X size={18} /></button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {plugin.error && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 14px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', marginBottom: 20 }}>
              <AlertCircle size={14} color="#DC2626" style={{ marginTop: 1, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#DC2626' }}>{plugin.error}</span>
            </div>
          )}

          {/* Metadata */}
          <div style={{ background: 'var(--body-bg)', borderRadius: 12, border: '1px solid var(--card-border)', marginBottom: 16, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--card-border)' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Informations</span>
            </div>
            {[
              { l: 'Identifiant', v: plugin.id, mono: true },
              { l: 'Version', v: `v${plugin.version}` },
              { l: 'État', v: s.label },
              { l: 'Activé le', v: plugin.activatedAt ? new Date(plugin.activatedAt).toLocaleString('fr-FR') : '—' },
              { l: 'UI Slots', v: plugin.uiSlots.length ? plugin.uiSlots.join(', ') : '—' },
              { l: 'Routes', v: plugin.routes.length ? `${plugin.routes.length} route(s)` : '—' },
            ].map(row => (
              <div key={row.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--card-border)', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>{row.l}</span>
                <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontFamily: row.mono ? 'monospace' : 'inherit', fontSize: row.mono ? 11 : 13 }}>{row.v}</span>
              </div>
            ))}
          </div>

          {/* Permissions */}
          {plugin.permissions.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Permissions</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {plugin.permissions.map(perm => (
                  <span key={perm} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '4px 10px', borderRadius: 6, background: '#F0FDF4', color: '#059669', border: '1px solid #BBF7D0', fontFamily: 'monospace' }}>
                    <Shield size={10} />{perm}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Routes */}
          {plugin.routes.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Routes injectées</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {plugin.routes.map(r => (
                  <div key={r.path} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'var(--body-bg)', border: '1px solid var(--card-border)' }}>
                    <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--color-primary)' }}>{r.path}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>→ {r.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {(isActive || isDisabled) && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--card-border)' }}>
            <button
              onClick={() => { isActive ? disable.mutate(plugin.id) : enable.mutate(plugin.id); onClose(); }}
              disabled={busy}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 0', borderRadius: 12, border: 'none', background: isActive ? '#FEF3C7' : 'var(--color-primary)', color: isActive ? '#D97706' : '#fff', fontSize: 14, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : isActive ? <><Pause size={14} />Désactiver le plugin</> : <><Play size={14} />Activer le plugin</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────── main ─────────────── */
export default function PluginsPage() {
  const [, navigate] = useLocation();
  const [plugins, setPlugins] = useState<Plugin[]>(ALL_PLUGINS);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [view, setView] = useState<'marketplace' | 'installed' | 'runtime'>('marketplace');
  const [installing, setInstalling] = useState<Plugin | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [runtimeDetail, setRuntimeDetail] = useState<RuntimePlugin | null>(null);

  const { data: runtimeData } = useRuntimePlugins();
  const runtimePlugins = runtimeData?.plugins ?? [];
  const runtimeActive = runtimePlugins.filter(p => p.state === 'ACTIVE').length;

  const installed = plugins.filter(p => p.status !== 'not_installed');
  const active = plugins.filter(p => p.status === 'active');

  const filtered = plugins.filter(p => {
    if (view === 'installed' && p.status === 'not_installed') return false;
    const q = search.toLowerCase();
    if (q && !`${p.name} ${p.description} ${p.category}`.toLowerCase().includes(q)) return false;
    if (category !== 'all' && p.category !== category) return false;
    return true;
  });

  const toggle = async (plugin: Plugin, e: React.MouseEvent) => {
    e.stopPropagation();
    setToggling(plugin.id);
    await new Promise(r => setTimeout(r, 600));
    setPlugins(ps => ps.map(p => p.id === plugin.id ? { ...p, status: p.status === 'active' ? 'inactive' : 'active' } : p));
    setToggling(null);
    toast.success(plugin.status === 'active' ? `${plugin.name} désactivé` : `${plugin.name} activé`);
  };

  const handleInstall = (plugin: Plugin) => {
    setPlugins(ps => ps.map(p => p.id === plugin.id ? { ...p, status: 'active' } : p));
    toast.success(`${plugin.name} installé avec succès !`);
  };

  return (
    <div style={{ minHeight: '100vh', padding: 24, background: 'var(--body-bg)' }}>
      {installing && <InstallModal plugin={installing} onClose={() => setInstalling(null)} onInstall={() => handleInstall(installing)} />}
      {runtimeDetail && <RuntimeDetailDrawer plugin={runtimeDetail} onClose={() => setRuntimeDetail(null)} />}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px' }}>Plugins</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            {active.length} actif{active.length > 1 ? 's' : ''} marketplace
            {runtimePlugins.length > 0 && ` · ${runtimeActive}/${runtimePlugins.length} runtime`}
          </p>
        </div>
        {/* View toggle */}
        <div style={{ display: 'flex', gap: 1, padding: 4, borderRadius: 12, background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
          {([
            ['marketplace', '🛒 Marketplace'],
            ['installed', `📦 Installés (${installed.length})`],
            ['runtime', `⚙️ Runtime${runtimePlugins.length > 0 ? ` (${runtimePlugins.length})` : ''}`],
          ] as const).map(([v, label]) => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: view === v ? 'var(--color-primary)' : 'transparent', color: view === v ? '#fff' : 'var(--text-muted)', transition: 'all .15s' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Runtime Engine view */}
      {view === 'runtime' && <RuntimeEnginePanel onDetail={setRuntimeDetail} />}

      {/* Marketplace / Installed views */}
      {view !== 'runtime' && (
        <>
          {/* Stats bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { l: 'Installés', v: installed.length, color: '#6D28D9', bg: '#F5F3FF' },
              { l: 'Actifs', v: active.length, color: '#059669', bg: '#ECFDF5' },
              { l: 'Inactifs', v: installed.filter(p => p.status === 'inactive').length, color: '#D97706', bg: '#FFFBEB' },
              { l: 'Disponibles', v: plugins.filter(p => p.status === 'not_installed').length, color: '#2563EB', bg: '#EFF6FF' },
            ].map(s => (
              <div key={s.l} style={{ borderRadius: 12, border: '1px solid var(--card-border)', background: 'var(--card-bg)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, color: s.color }}>{s.v}</div>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{s.l}</span>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un plugin…"
                style={{ width: '100%', paddingLeft: 36, paddingRight: 12, paddingTop: 10, paddingBottom: 10, borderRadius: 12, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {CATEGORIES.map(c => (
                <button key={c.id} onClick={() => setCategory(c.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: category === c.id ? 'var(--color-primary)' : 'var(--card-bg)', color: category === c.id ? '#fff' : 'var(--text-secondary)', boxShadow: category === c.id ? 'none' : '0 0 0 1px var(--card-border)' }}>
                  {c.icon}{c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(310px,1fr))', gap: 14 }}>
            {filtered.map(plugin => {
              const isInstalled = plugin.status !== 'not_installed';
              const isActive = plugin.status === 'active';
              return (
                <div key={plugin.id}
                  style={{ borderRadius: 16, border: `1.5px solid ${isActive ? 'var(--color-primary)' : 'var(--card-border)'}`, background: 'var(--card-bg)', overflow: 'hidden', transition: 'all .15s', cursor: 'pointer' }}
                  onClick={() => navigate(`/plugins/${plugin.slug}`)}>
                  <div style={{ padding: '16px 16px 12px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--body-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0, position: 'relative' }}>
                      {plugin.icon}
                      {isActive && <div style={{ position: 'absolute', bottom: -2, right: -2, width: 10, height: 10, borderRadius: '50%', background: '#22C55E', border: '2px solid var(--card-bg)' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <h3 style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', margin: 0 }}>{plugin.name}</h3>
                        {plugin.isNew && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 9999, background: '#EDE9FE', color: '#7C3AED', fontWeight: 700 }}>NOUVEAU</span>}
                        {plugin.isPro && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 9999, background: '#FEF3C7', color: '#D97706', fontWeight: 700 }}>PRO</span>}
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 6px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{plugin.description}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Stars rating={plugin.rating} />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{plugin.rating} ({plugin.reviews}) · {(plugin.installs / 1000).toFixed(1)}k</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: '10px 14px', borderTop: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--body-bg)' }}>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 9999, background: 'var(--card-bg)', color: 'var(--text-muted)', border: '1px solid var(--card-border)' }}>{plugin.category}</span>
                    <div style={{ flex: 1 }} />
                    {isInstalled ? (
                      <button onClick={e => toggle(plugin, e)} disabled={toggling === plugin.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: isActive ? '#FEF3C7' : '#ECFDF5', color: isActive ? '#D97706' : '#059669', opacity: toggling === plugin.id ? 0.6 : 1 }}>
                        {toggling === plugin.id ? <Loader2 size={11} className="animate-spin" /> : isActive ? <><Pause size={11} />Désactiver</> : <><Play size={11} />Activer</>}
                      </button>
                    ) : (
                      <button onClick={e => { e.stopPropagation(); setInstalling(plugin); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--color-primary)', color: '#fff' }}>
                        <Download size={11} />Installer
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '64px 0' }}>
              <Puzzle size={40} style={{ margin: '0 auto 12px', color: 'var(--card-border)' }} />
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Aucun plugin trouvé</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
