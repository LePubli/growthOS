import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, ArrowRight, Bot, Building2, CheckCircle2, Database, KeyRound, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';

type MailMode = 'disabled' | 'smtp' | 'resend';
type CloudAiProvider = 'anthropic' | 'openai' | 'deepseek';
type PrimaryAiProvider = CloudAiProvider | 'disabled';
type SetupStatus = { databaseReady: boolean; needsBootstrap: boolean };

const CLOUD_AI_PROVIDERS: { id: CloudAiProvider; name: string; description: string }[] = [
  { id: 'anthropic', name: 'Claude (Anthropic)', description: 'Rédaction et analyse de contenus commerciaux' },
  { id: 'openai', name: 'OpenAI', description: 'Messages et automatisations IA' },
  { id: 'deepseek', name: 'DeepSeek', description: 'IA cloud pour la prospection et le SEO' },
];

const STEPS = [
  { title: 'Administrateur', subtitle: 'Initialisez votre espace en toute sécurité', icon: KeyRound },
  { title: 'Votre agence', subtitle: 'Personnalisez GrowthOS pour votre activité', icon: Building2 },
  { title: 'Email professionnel', subtitle: 'Connectez votre SMTP existant ou reportez cette étape', icon: Mail },
  { title: 'Intelligence artificielle', subtitle: 'Connectez Claude, OpenAI et DeepSeek séparément', icon: Bot },
  { title: 'Vérifications', subtitle: 'Confirmez les connexions avant de commencer', icon: ShieldCheck },
];

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '11px 12px', border: '1px solid var(--card-border)',
  borderRadius: 10, background: 'var(--body-bg)', color: 'var(--text-primary)',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
};

const sectionLabel: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6,
};

function Field({ label, value, onChange, placeholder, type = 'text', required = false }: {
  label: string; value: string; onChange: (value: string) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  return <label style={{ display: 'block' }}>
    <span style={sectionLabel}>{label}{required ? ' *' : ''}</span>
    <input style={fieldStyle} type={type} value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)} required={required} autoComplete="off" />
  </label>;
}

export default function OnboardingWizardPage() {
  const [, navigate] = useLocation();
  const { isAuthenticated, initializeSession, tenant, setTenant } = useAuthStore();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loadError, setLoadError] = useState('');
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [checkingSmtp, setCheckingSmtp] = useState(false);
  const [smtpVerified, setSmtpVerified] = useState(false);
  const [aiTests, setAiTests] = useState<Partial<Record<CloudAiProvider, boolean>>>({});
  const [aiTesting, setAiTesting] = useState<CloudAiProvider | null>(null);
  const [aiSaving, setAiSaving] = useState<CloudAiProvider | null>(null);

  const [setupToken, setSetupToken] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [companyName, setCompanyName] = useState('Le Publicitaire');
  const [website, setWebsite] = useState('');
  const [targetRegion, setTargetRegion] = useState('Hauts-de-France');
  const [offer, setOffer] = useState('sites-web-seo');
  const [dailyEmailLimit, setDailyEmailLimit] = useState(10);

  const [mailMode, setMailMode] = useState<MailMode>('disabled');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');

  const [primaryAiProvider, setPrimaryAiProvider] = useState<PrimaryAiProvider>('disabled');
  const [configuredAiProviders, setConfiguredAiProviders] = useState<CloudAiProvider[]>([]);
  const [aiKeys, setAiKeys] = useState<Record<CloudAiProvider, string>>({ anthropic: '', openai: '', deepseek: '' });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const current = await apiClient.get<SetupStatus>('/setup/status');
        if (cancelled) return;
        setStatus(current);
        setLoadError('');
        if (!current.needsBootstrap && useAuthStore.getState().isAuthenticated) {
          const config = await apiClient.get<any>('/setup/configuration');
          if (cancelled) return;
          setCompanyName(config.companyName ?? '');
          setWebsite(config.website ?? '');
          setTargetRegion(config.targetRegion ?? '');
          setOffer(config.offer ?? 'sites-web-seo');
          setDailyEmailLimit(config.dailyEmailLimit ?? 10);
          setMailMode(config.email?.mode ?? 'disabled');
          setSmtpHost(config.email?.host ?? '');
          setSmtpPort(String(config.email?.port ?? 587));
          setSmtpUsername(config.email?.username ?? '');
          setSmtpFrom(config.email?.from ?? '');
          setConfiguredAiProviders((config.aiProviders ?? []).filter((id: string) => CLOUD_AI_PROVIDERS.some(p => p.id === id)));
          setPrimaryAiProvider(CLOUD_AI_PROVIDERS.some(p => p.id === config.aiProvider) ? config.aiProvider : 'disabled');
          setStep(1);
        }
      } catch {
        if (!cancelled) setLoadError('Impossible de joindre la base de données ou le serveur API. Vérifiez les conteneurs.');
      }
    }
    load();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  async function advance() {
    setBusy(true);
    try {
      if (step === 0) {
        const result = await apiClient.post<any>('/setup/bootstrap', {
          setupToken, companyName, email: adminEmail, password: adminPassword,
          firstName: adminName,
        });
        initializeSession(result);
        setSetupToken('');
        setAdminPassword('');
        setStatus({ databaseReady: true, needsBootstrap: false });
        setStep(1);
        toast.success('Compte administrateur créé');
      } else if (step === 1) {
        if (companyName.trim().length < 2) throw new Error('Renseignez le nom de votre agence.');
        await apiClient.patch('/setup/configuration', {
          companyName, website, targetRegion, offer, dailyEmailLimit,
        });
        setStep(2);
        toast.success('Informations de l’agence enregistrées');
      } else if (step === 2) {
        await apiClient.patch('/setup/configuration', {
          companyName,
          email: mailMode === 'smtp'
            ? { mode: 'smtp', host: smtpHost, port: Number(smtpPort), secure: Number(smtpPort) === 465,
                username: smtpUsername, password: smtpPassword || undefined, from: smtpFrom }
            : { mode: mailMode },
        });
        setSmtpPassword('');
        setStep(3);
        toast.success('Configuration email enregistrée');
      } else if (step === 3) {
        if (primaryAiProvider !== 'disabled' && !configuredAiProviders.includes(primaryAiProvider)) {
          throw new Error('Enregistrez la clé du fournisseur principal avant de continuer.');
        }
        await apiClient.patch('/setup/configuration', { companyName, aiProvider: primaryAiProvider });
        setStep(4);
      } else {
        await apiClient.post('/setup/finish', {});
        if (tenant) setTenant({ ...tenant, settings: { ...tenant.settings, onboardingComplete: true } });
        toast.success('GrowthOS est configuré. Bienvenue !');
        navigate('/dashboard');
      }
    } catch (error: any) {
      toast.error(error?.message ?? 'Impossible de terminer cette étape');
    } finally { setBusy(false); }
  }

  async function checkSmtp() {
    setCheckingSmtp(true);
    try {
      // Save settings before verifying; passwords are never returned by the API.
      await apiClient.patch('/setup/configuration', {
        companyName,
        email: { mode: 'smtp', host: smtpHost, port: Number(smtpPort), secure: Number(smtpPort) === 465,
          username: smtpUsername, password: smtpPassword || undefined, from: smtpFrom },
      });
      const result = await apiClient.post<{ ok: boolean; message: string }>('/setup/smtp/verify', {});
      setSmtpVerified(Boolean(result.ok));
      toast.success(result.message);
    } catch (error: any) {
      setSmtpVerified(false);
      toast.error(error.message ?? 'Échec de la connexion SMTP');
    } finally { setCheckingSmtp(false); }
  }

  async function saveAiKey(provider: CloudAiProvider) {
    const apiKey = aiKeys[provider].trim();
    if (!apiKey) return;
    setAiSaving(provider);
    try {
      await apiClient.post('/admin/api-keys', { provider, apiKey });
      setConfiguredAiProviders(prev => [...new Set([...prev, provider])]);
      setAiKeys(prev => ({ ...prev, [provider]: '' }));
      setAiTests(prev => ({ ...prev, [provider]: false }));
      toast.success(`${CLOUD_AI_PROVIDERS.find(p => p.id === provider)?.name} : clé enregistrée et chiffrée`);
    } catch (error: any) {
      toast.error(error?.message ?? 'Impossible de sauvegarder la clé');
    } finally { setAiSaving(null); }
  }

  async function checkAi(provider: CloudAiProvider) {
    setAiTesting(provider);
    try {
      const apiKey = aiKeys[provider].trim();
      const result = await apiClient.post<{ ok: boolean; message: string }>(`/admin/api-keys/${provider}/test`,
        apiKey ? { apiKey } : {});
      setAiTests(prev => ({ ...prev, [provider]: Boolean(result.ok) }));
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } catch (error: any) {
      setAiTests(prev => ({ ...prev, [provider]: false }));
      toast.error(error?.message ?? 'Échec du test de connexion IA');
    } finally { setAiTesting(null); }
  }

  const requiresBootstrap = status?.needsBootstrap && !isAuthenticated;
  const activeStep = STEPS[step];
  const Icon = activeStep.icon;
  const canContinue = step !== 0 ||
    (setupToken.length >= 1 && companyName.trim().length >= 2 && adminEmail.includes('@') && adminPassword.length >= 12);

  return (
    <div style={{ minHeight: '100vh', padding: '38px 18px', background: 'var(--body-bg)', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 720 }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 800,
            letterSpacing: 1, color: 'var(--color-primary)', marginBottom: 12 }}>
            <Database size={18}/> GROWTHOS / INSTALLATION
          </div>
          <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>Assistant de configuration</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>Chaque étape est enregistrée. Vous pourrez revenir modifier vos paramètres.</p>
        </div>

        {!status && !loadError && <div style={{ textAlign: 'center', padding: 50 }}><Loader2 className="animate-spin" size={28}/></div>}
        {loadError && <div style={{ background: '#FEF2F2', color: '#B91C1C', padding: 20, borderRadius: 12 }}>{loadError}</div>}
        {status && !requiresBootstrap && !isAuthenticated && (
          <div style={{ background: 'var(--card-bg)', padding: 32, border: '1px solid var(--card-border)', borderRadius: 20, textAlign: 'center' }}>
            <ShieldCheck size={32} style={{ color: '#059669', marginBottom: 12 }}/>
            <h2 style={{ fontSize: 19, fontWeight: 800 }}>GrowthOS est déjà initialisé</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Connectez-vous comme administrateur pour modifier la configuration.</p>
            <button onClick={() => navigate('/login')} style={{ background: '#2563EB', border: 0, borderRadius: 10, color: 'white', padding: '12px 22px', cursor: 'pointer' }}>Se connecter</button>
          </div>
        )}

        {status && (requiresBootstrap || isAuthenticated) && <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 6, marginBottom: 18 }}>
            {STEPS.map((s, i) => (
              <div key={s.title} title={s.title} style={{ height: 7, borderRadius: 20, background: i <= step ? '#2563EB' : 'var(--card-border)', transition: 'background .2s' }}/>
            ))}
          </div>
          <div style={{ padding: '30px clamp(20px, 5vw, 42px)', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 22, boxShadow: '0 12px 40px rgba(0,0,0,.05)' }}>
            <div style={{ display: 'flex', gap: 15, alignItems: 'center', marginBottom: 28 }}>
              <div style={{ width: 55, height: 55, flexShrink: 0, borderRadius: 16, background: '#EFF6FF', color: '#2563EB', display: 'grid', placeItems: 'center' }}><Icon size={26}/></div>
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#2563EB', fontWeight: 800, letterSpacing: 1 }}>Étape {step + 1} sur {STEPS.length}</div>
                <h2 style={{ fontSize: 21, margin: '3px 0', color: 'var(--text-primary)', fontWeight: 800 }}>{activeStep.title}</h2>
                <p style={{ fontSize: 13, margin: 0, color: 'var(--text-muted)' }}>{activeStep.subtitle}</p>
              </div>
            </div>

            {step === 0 && <div style={{ display: 'grid', gap: 15 }}>
              <div style={{ padding: 12, borderRadius: 10, background: '#FFF7ED', color: '#9A3412', fontSize: 13 }}>
                Copiez ici le <strong>SETUP_TOKEN</strong> créé au lancement des conteneurs. Ce code n'est utilisé qu'une fois.
              </div>
              <Field label="Code d'installation" value={setupToken} onChange={setSetupToken} type="password" required />
              <Field label="Nom de votre agence" value={companyName} onChange={setCompanyName} required />
              <Field label="Prénom de l'administrateur" value={adminName} onChange={setAdminName} />
              <Field label="Email administrateur" value={adminEmail} onChange={setAdminEmail} type="email" required />
              <Field label="Mot de passe administrateur (12 caractères minimum)" value={adminPassword} onChange={setAdminPassword} type="password" required />
            </div>}

            {step === 1 && <div style={{ display: 'grid', gap: 15 }}>
              <Field label="Nom de votre agence" value={companyName} onChange={setCompanyName} required />
              <Field label="Site de votre agence" value={website} onChange={setWebsite} placeholder="https://www.mon-agence.fr" type="url" />
              <Field label="Région de prospection" value={targetRegion} onChange={setTargetRegion} placeholder="Hauts-de-France" />
              <label><span style={sectionLabel}>Offre à vendre</span>
                <select style={fieldStyle} value={offer} onChange={e => setOffer(e.target.value)}>
                  <option value="sites-web-seo">Création de sites internet + SEO</option>
                  <option value="sites-web">Création de sites internet</option>
                  <option value="seo">Référencement naturel SEO</option>
                </select>
              </label>
              <label><span style={sectionLabel}>Plafond de prospection email par jour (0 à 50)</span>
                <input type="number" min={0} max={50} style={fieldStyle} value={dailyEmailLimit}
                  onChange={e => setDailyEmailLimit(Math.min(50, Math.max(0, Number(e.target.value))))}/>
              </label>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>Ce plafond est enregistré comme préférence ; l'envoi automatique sera activé uniquement après installation du moteur de séquences et de ses contrôles de conformité.</p>
            </div>}

            {step === 2 && <div style={{ display: 'grid', gap: 15 }}>
              <label><span style={sectionLabel}>Mode d'envoi</span>
                <select value={mailMode} style={fieldStyle} onChange={e => { setMailMode(e.target.value as MailMode); setSmtpVerified(false); }}>
                  <option value="disabled">Configurer plus tard (aucun envoi)</option>
                  <option value="smtp">Serveur SMTP de mes emails professionnels</option>
                  <option value="resend">Resend (clé d'API configurée côté serveur)</option>
                </select>
              </label>
              {mailMode === 'smtp' && <>
                <Field label="Serveur SMTP" value={smtpHost} onChange={setSmtpHost} placeholder="smtp.mon-hebergeur.fr" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                  <Field label="Port (587 ou 465)" value={smtpPort} onChange={setSmtpPort} type="number" />
                  <Field label="Utilisateur SMTP" value={smtpUsername} onChange={setSmtpUsername} placeholder="contact@mon-agence.fr" />
                </div>
                <Field label="Mot de passe SMTP (conservé chiffré côté serveur)" value={smtpPassword} onChange={setSmtpPassword} type="password" />
                <Field label="Adresse d'expédition" value={smtpFrom} onChange={setSmtpFrom} placeholder="contact@mon-agence.fr" type="email" />
                <button onClick={checkSmtp} disabled={checkingSmtp || !smtpHost || !smtpUsername || !smtpFrom}
                  style={{ padding: 12, borderRadius: 10, border: '1px solid #2563EB', color: '#2563EB', background: '#EFF6FF', cursor: 'pointer', fontWeight: 700 }}>
                  {checkingSmtp ? 'Vérification en cours…' : smtpVerified ? '✓ SMTP vérifié — recommencer' : 'Tester la connexion SMTP'}
                </button>
              </>}
              {mailMode === 'resend' && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Définissez RESEND_API_KEY et EMAIL_FROM dans les variables de l'API, puis redémarrez le conteneur.</p>}
              {mailMode === 'disabled' && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Aucun email ne partira tant qu'aucun fournisseur ne sera configuré.</p>}
            </div>}

            {step === 3 && <div style={{ display: 'grid', gap: 15 }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>Tu peux enregistrer les trois fournisseurs. Chaque clé reste chiffrée sur le serveur ; elles ne sont pas affichées de nouveau dans le navigateur.</p>
              {CLOUD_AI_PROVIDERS.map(provider => {
                const configured = configuredAiProviders.includes(provider.id);
                return <div key={provider.id} style={{ padding: 16, border: '1px solid var(--card-border)', borderRadius: 12, display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div>
                      <strong style={{ fontSize: 15, color: 'var(--text-primary)' }}>{provider.name}</strong>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{provider.description}</div>
                    </div>
                    <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: configured ? '#047857' : 'var(--text-muted)' }}>
                      {configured ? '✓ Enregistrée' : 'Non configurée'}
                    </span>
                  </div>
                  <Field label={configured ? 'Remplacer la clé API (facultatif)' : 'Clé API'} value={aiKeys[provider.id]}
                    onChange={value => { setAiKeys(prev => ({ ...prev, [provider.id]: value })); setAiTests(prev => ({ ...prev, [provider.id]: false })); }}
                    placeholder={configured ? 'Clé déjà enregistrée' : 'Colle ta clé API'} type="password" />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button onClick={() => saveAiKey(provider.id)} disabled={!aiKeys[provider.id].trim() || aiSaving !== null}
                      style={{ padding: '9px 12px', borderRadius: 9, border: 'none', color: '#fff', background: '#2563EB', cursor: 'pointer', fontWeight: 700, opacity: !aiKeys[provider.id].trim() ? .5 : 1 }}>
                      {aiSaving === provider.id ? 'Enregistrement…' : configured ? 'Remplacer la clé' : 'Enregistrer la clé'}
                    </button>
                    <button onClick={() => checkAi(provider.id)} disabled={aiTesting !== null || (!configured && !aiKeys[provider.id].trim())}
                      style={{ padding: '9px 12px', borderRadius: 9, border: '1px solid #2563EB', color: '#2563EB', background: '#EFF6FF', cursor: 'pointer', fontWeight: 700 }}>
                      {aiTesting === provider.id ? 'Test en cours…' : aiTests[provider.id] ? '✓ Connexion vérifiée' : 'Tester la connexion'}
                    </button>
                  </div>
                </div>;
              })}
              <label><span style={sectionLabel}>Fournisseur IA principal de GrowthOS</span>
                <select style={fieldStyle} value={primaryAiProvider} onChange={e => setPrimaryAiProvider(e.target.value as PrimaryAiProvider)}>
                  <option value="disabled">Aucun pour l'instant (zéro appel automatique)</option>
                  {CLOUD_AI_PROVIDERS.map(p => <option key={p.id} value={p.id} disabled={!configuredAiProviders.includes(p.id)}>{p.name}{!configuredAiProviders.includes(p.id) ? ' — clé manquante' : ''}</option>)}
                </select>
              </label>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>Le test consulte uniquement la liste des modèles disponibles : aucune génération de texte facturée. Les générations IA que tu déclencheras ensuite peuvent être payantes selon le fournisseur.</p>
              <div style={{ padding: 12, background: '#F1F5F9', color: '#475569', borderRadius: 10, fontSize: 12 }}>
                <strong>Ollama en veille.</strong> Aucun conteneur local n'est nécessaire. Tu pourras le reconnecter plus tard depuis l'administration des clés API.
              </div>
            </div>}

            {step === 4 && <div style={{ display: 'grid', gap: 12 }}>
              {[
                { label: 'Base de données', passed: status.databaseReady, note: 'Connexion API vérifiée' },
                { label: 'Espace administrateur', passed: isAuthenticated, note: 'Compte sécurisé créé' },
                { label: 'Email professionnel', passed: smtpVerified, note: mailMode === 'disabled' ? 'À configurer' : smtpVerified ? 'Serveur SMTP testé' : 'Non vérifié' },
                { label: 'IA', passed: primaryAiProvider !== 'disabled' && aiTests[primaryAiProvider] === true,
                  note: primaryAiProvider === 'disabled' ? 'En veille — aucun fournisseur principal' : `${CLOUD_AI_PROVIDERS.find(p => p.id === primaryAiProvider)?.name} — ${aiTests[primaryAiProvider] ? 'connexion testée' : 'clé enregistrée, test facultatif'}` },
              ].map(item => <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: 'var(--body-bg)', border: '1px solid var(--card-border)', borderRadius: 12 }}>
                <CheckCircle2 size={20} style={{ color: item.passed ? '#059669' : '#9CA3AF' }}/>
                <div><div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.note}</div></div>
              </div>)}
              <p style={{ padding: 12, borderRadius: 10, background: '#EFF6FF', color: '#1D4ED8', fontSize: 12 }}>
                Le CRM peut démarrer sans email ou IA. Les fonctions de collecte et les relances automatiques restent désactivées tant qu'elles n'ont pas été validées séparément.
              </p>
            </div>}

            <div style={{ marginTop: 28, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <button onClick={() => setStep(s => Math.max(status.needsBootstrap ? 0 : 1, s - 1))}
                disabled={busy || step === 0 || (step === 1 && status.needsBootstrap)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid var(--card-border)', background: 'var(--body-bg)', borderRadius: 10, padding: '11px 17px', cursor: 'pointer', color: 'var(--text-secondary)', opacity: step <= 1 ? .45 : 1 }}>
                <ArrowLeft size={15}/> Retour
              </button>
              <button onClick={advance} disabled={busy || !canContinue}
                style={{ display: 'flex', alignItems: 'center', gap: 8, border: 0, background: '#2563EB', color: 'white', borderRadius: 10, padding: '11px 21px', fontWeight: 800, cursor: 'pointer', opacity: busy || !canContinue ? .5 : 1 }}>
                {busy ? <Loader2 size={16} className="animate-spin"/> : null}
                {step === 4 ? 'Terminer la configuration' : 'Enregistrer et continuer'}
                {step !== 4 && <ArrowRight size={15}/>}
              </button>
            </div>
          </div>
        </>}
      </div>
    </div>
  );
}
