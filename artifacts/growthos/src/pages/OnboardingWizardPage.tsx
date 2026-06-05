import { useState } from 'react';
import { CheckCircle2, ArrowRight, ArrowLeft, Building2, Users, Database, Mail, BarChart2, Sparkles, Loader2 } from 'lucide-react';
import { useLocation } from 'wouter';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

const STEPS = [
  {
    id: 1, icon: <Building2 size={28} />, title: 'Bienvenue dans GrowthOS',
    subtitle: 'Configurez votre espace de travail en 5 minutes',
    color: '#3B82F6', bg: '#EFF6FF',
  },
  {
    id: 2, icon: <Database size={28} />, title: 'Importer vos contacts',
    subtitle: 'Ajoutez vos premiers prospects pour démarrer',
    color: '#8B5CF6', bg: '#F5F3FF',
  },
  {
    id: 3, icon: <Sparkles size={28} />, title: 'Enrichissement automatique',
    subtitle: 'Activez les sources de données pour enrichir vos prospects',
    color: '#10B981', bg: '#ECFDF5',
  },
  {
    id: 4, icon: <Mail size={28} />, title: 'Votre première séquence',
    subtitle: 'Créez une séquence email pour relancer vos prospects',
    color: '#F59E0B', bg: '#FFFBEB',
  },
  {
    id: 5, icon: <BarChart2 size={28} />, title: 'Vous êtes prêt !',
    subtitle: 'Découvrez votre dashboard et commencez à croître',
    color: '#10B981', bg: '#ECFDF5',
  },
];

const CHECKLIST = [
  { id: 'profile', label: 'Profil entreprise configuré', done: true },
  { id: 'prospects', label: 'Premiers prospects importés', done: false },
  { id: 'enrichment', label: 'Enrichissement activé', done: false },
  { id: 'sequence', label: 'Séquence email créée', done: false },
  { id: 'signal', label: 'Signaux d\'intention configurés', done: false },
];

export default function OnboardingWizardPage() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1 form
  const [company, setCompany] = useState('');
  const [industry, setIndustry] = useState('SaaS');
  const [teamSize, setTeamSize] = useState('1-5');

  // Step 2 form
  const [importChoice, setImportChoice] = useState<'demo' | 'manual' | 'csv'>('demo');

  // Step 3 form
  const [enrichSources, setEnrichSources] = useState<string[]>(['linkedin', 'company-db']);

  // Step 4
  const [seqName, setSeqName] = useState('Séquence de bienvenue');

  const goNext = async () => {
    if (step === 2 && importChoice === 'demo') {
      setLoading(true);
      try {
        await apiClient.post('/prospects', {
          firstName: 'Sophie', lastName: 'Martin', email: 'sophie.martin@techcorp.fr',
          company: 'TechCorp France', jobTitle: 'Directrice Marketing', status: 'new', score: 82,
        }).catch(() => {});
        await apiClient.post('/prospects', {
          firstName: 'Thomas', lastName: 'Durand', email: 'thomas.durand@scale-up.io',
          company: 'Scale-Up.io', jobTitle: 'CEO', status: 'contacted', score: 71,
        }).catch(() => {});
        toast.success('3 prospects de démonstration ajoutés');
      } catch {}
      finally { setLoading(false); }
    }
    if (step === 4 && seqName) {
      await apiClient.post('/sequences', {
        name: seqName,
        description: 'Créée via le wizard d\'onboarding',
        status: 'draft',
        steps: [
          { type: 'email', delay: 0, subject: 'Bienvenue {{firstName}}', body: 'Bonjour {{firstName}}, …' },
          { type: 'delay', days: 3 },
          { type: 'email', delay: 3, subject: 'Suivi — {{company}}', body: 'Bonjour à nouveau, …' },
        ],
      }).catch(() => {});
    }
    if (step < 5) setStep(s => s + 1);
    else navigate('/dashboard');
  };

  const currentStep = STEPS[step - 1];
  const progress = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--body-bg)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 640 }}>

        {/* Progress */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Étape {step} sur {STEPS.length}</span>
          <div style={{ flex: 1, margin: '0 16px', height: 6, borderRadius: 9999, background: 'var(--card-border)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: currentStep.color, borderRadius: 9999, transition: 'width .4s ease' }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: currentStep.color }}>{Math.round(progress)}%</span>
        </div>

        {/* Card */}
        <div style={{ background: 'var(--card-bg)', borderRadius: 24, border: '1px solid var(--card-border)', padding: '36px 40px', boxShadow: '0 8px 32px rgba(0,0,0,.06)' }}>

          {/* Step header */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 32 }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: currentStep.bg, color: currentStep.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              {currentStep.icon}
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px' }}>{currentStep.title}</h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>{currentStep.subtitle}</p>
          </div>

          {/* Step content */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Nom de votre entreprise *</label>
                <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Acme Corp"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--card-border)', borderRadius: 12, fontSize: 14, background: 'var(--body-bg)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Secteur d'activité</label>
                  <select value={industry} onChange={e => setIndustry(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--card-border)', borderRadius: 12, fontSize: 14, background: 'var(--body-bg)', color: 'var(--text-primary)', outline: 'none' }}>
                    {['SaaS', 'E-commerce', 'Finance', 'Santé', 'Industrie', 'Services', 'Autre'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Taille d'équipe</label>
                  <select value={teamSize} onChange={e => setTeamSize(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--card-border)', borderRadius: 12, fontSize: 14, background: 'var(--body-bg)', color: 'var(--text-primary)', outline: 'none' }}>
                    {['1-5', '6-15', '16-50', '51-200', '200+'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {([
                { v: 'demo', label: '🚀 Données de démonstration', desc: 'On ajoute 3 prospects exemples pour que vous puissiez tester immédiatement' },
                { v: 'manual', label: '✏️ Saisie manuelle', desc: 'Ajoutez vos premiers prospects un par un via le formulaire' },
                { v: 'csv', label: '📂 Import CSV', desc: 'Importez un fichier CSV avec vos contacts existants' },
              ] as const).map(opt => (
                <label key={opt.v} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderRadius: 12, border: `2px solid ${importChoice === opt.v ? 'var(--color-primary)' : 'var(--card-border)'}`, cursor: 'pointer', background: importChoice === opt.v ? `color-mix(in srgb, var(--color-primary) 5%, transparent)` : 'var(--body-bg)' }}>
                  <input type="radio" value={opt.v} checked={importChoice === opt.v} onChange={() => setImportChoice(opt.v)} style={{ marginTop: 2 }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 2 }}>{opt.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {step === 3 && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>Sélectionnez les sources d'enrichissement à activer :</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { id: 'linkedin', label: 'LinkedIn', desc: 'Profils professionnels et données d\'emploi' },
                  { id: 'company-db', label: 'Base entreprises', desc: 'Effectif, CA, secteur, localisation' },
                  { id: 'technographics', label: 'Technographies', desc: 'Stack technique utilisé par la cible' },
                  { id: 'signals', label: 'Signaux d\'intention', desc: 'Levées de fonds, recrutements, actualités' },
                ].map(src => (
                  <label key={src.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${enrichSources.includes(src.id) ? 'var(--color-primary)' : 'var(--card-border)'}`, cursor: 'pointer', background: 'var(--body-bg)' }}>
                    <input type="checkbox" checked={enrichSources.includes(src.id)}
                      onChange={e => setEnrichSources(s => e.target.checked ? [...s, src.id] : s.filter(x => x !== src.id))} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{src.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{src.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Nom de votre première séquence</label>
                <input value={seqName} onChange={e => setSeqName(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--card-border)', borderRadius: 12, fontSize: 14, background: 'var(--body-bg)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--body-bg)', border: '1px solid var(--card-border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10 }}>Structure auto-générée :</div>
                {[
                  { step: 'J+0', icon: '📧', text: 'Email d\'introduction personnalisé' },
                  { step: 'J+3', icon: '⏰', text: 'Délai d\'attente — 3 jours' },
                  { step: 'J+3', icon: '📧', text: 'Email de suivi avec preuve sociale' },
                ].map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: i < 2 ? 8 : 0, fontSize: 13, color: 'var(--text-primary)' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', minWidth: 28 }}>{s.step}</span>
                    <span>{s.icon}</span>
                    <span>{s.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {CHECKLIST.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'var(--body-bg)', border: '1px solid var(--card-border)' }}>
                    {item.done
                      ? <CheckCircle2 size={18} style={{ color: '#10B981', flexShrink: 0 }} />
                      : <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--card-border)', flexShrink: 0 }} />
                    }
                    <span style={{ fontSize: 13, color: item.done ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: item.done ? 600 : 400 }}>{item.label}</span>
                  </div>
                ))}
              </div>
              <div style={{ padding: '14px 16px', borderRadius: 12, background: '#ECFDF5', border: '1px solid #A7F3D0', textAlign: 'center' }}>
                <Sparkles size={20} style={{ color: '#10B981', margin: '0 auto 6px' }} />
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#059669' }}>GrowthOS est configuré et prêt à booster votre croissance !</p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
            {step > 1 && (
              <button onClick={() => setStep(s => s - 1)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '11px 18px', borderRadius: 12, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>
                <ArrowLeft size={14} />Retour
              </button>
            )}
            <button onClick={goNext} disabled={loading || (step === 1 && !company.trim())}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px 18px', borderRadius: 12, border: 'none', background: currentStep.color, color: '#fff', fontSize: 14, cursor: 'pointer', fontWeight: 700, opacity: (loading || (step === 1 && !company.trim())) ? 0.6 : 1 }}>
              {loading ? <Loader2 size={15} className="animate-spin" /> : null}
              {step === 5 ? 'Accéder au Dashboard' : 'Continuer'}
              {step !== 5 && !loading && <ArrowRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
