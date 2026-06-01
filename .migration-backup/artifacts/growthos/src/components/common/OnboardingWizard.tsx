import { useState, useEffect } from 'react';
import { CheckCircle, X, Upload, Mail, Zap, Users, ChevronRight, ArrowRight } from 'lucide-react';
import { useLocation } from 'wouter';

const STEPS = [
  {
    id: 'import',
    title: 'Importez vos premiers contacts',
    desc: 'Démarrez avec vos prospects existants — CSV, LinkedIn ou saisie manuelle.',
    icon: <Upload size={28} />,
    color: '#3B82F6',
    cta: 'Importer des contacts',
    href: '/import',
    tip: 'Astuce : téléchargez notre modèle CSV pour importer 100 contacts en 30 secondes.',
  },
  {
    id: 'sequence',
    title: 'Créez votre première séquence email',
    desc: 'Automatisez votre prospection avec une séquence de 3 emails personnalisés.',
    icon: <Mail size={28} />,
    color: '#7C3AED',
    cta: 'Créer une séquence',
    href: '/sequences',
    tip: 'Les séquences de 3 emails ont un taux de réponse 40% plus élevé qu\'un email unique.',
  },
  {
    id: 'signal',
    title: 'Activez vos signaux d\'intention',
    desc: 'GrowthOS détecte quand vos prospects changent de poste, lèvent des fonds ou recrutent.',
    icon: <Zap size={28} />,
    color: '#F59E0B',
    cta: 'Voir les signaux',
    href: '/signals',
    tip: 'Les signaux permettent d\'appeler au bon moment — taux de conversion x3.',
  },
  {
    id: 'team',
    title: 'Invitez votre équipe',
    desc: 'Partagez le pipeline, les comptes et les analyses avec vos collègues.',
    icon: <Users size={28} />,
    color: '#059669',
    cta: 'Inviter l\'équipe',
    href: '/settings/team',
    tip: 'Les équipes de 3+ commerciaux signent 2x plus vite grâce au partage de contexte.',
  },
];

const STORAGE_KEY = 'growthos_onboarding_done';
const STEP_KEY = 'growthos_onboarding_step';

export function OnboardingWizard() {
  const [, navigate] = useLocation();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    const savedStep = parseInt(localStorage.getItem(STEP_KEY) || '0', 10);
    if (!done) {
      setStep(savedStep);
      setVisible(true);
    }
  }, []);

  const completeStep = () => {
    const s = STEPS[step];
    const newCompleted = new Set([...completed, s.id]);
    setCompleted(newCompleted);
    if (step < STEPS.length - 1) {
      const next = step + 1;
      setStep(next);
      localStorage.setItem(STEP_KEY, String(next));
    } else {
      finish();
    }
  };

  const goToPage = () => {
    const href = STEPS[step].href;
    completeStep();
    navigate(href);
  };

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    localStorage.removeItem(STEP_KEY);
    setVisible(false);
  };

  const skip = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  const current = STEPS[step];
  const pct = ((step) / STEPS.length) * 100;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--card-bg)', borderRadius: 24, width: '100%', maxWidth: 520, boxShadow: '0 24px 80px rgba(0,0,0,.25)', overflow: 'hidden' }}>
        {/* Progress bar */}
        <div style={{ height: 4, background: 'var(--card-border)' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: current.color, transition: 'width 0.4s ease' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px 0' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Étape {step + 1} sur {STEPS.length}
          </div>
          <button onClick={skip} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
            <X size={14} />Passer
          </button>
        </div>

        {/* Step content */}
        <div style={{ padding: '24px 24px 20px', textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: `${current.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', color: current.color }}>
            {current.icon}
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>{current.title}</h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>{current.desc}</p>

          {/* Tip */}
          <div style={{ padding: '12px 16px', borderRadius: 12, background: `${current.color}0d`, border: `1px solid ${current.color}30`, fontSize: 13, color: 'var(--text-secondary)', textAlign: 'left', marginBottom: 24, lineHeight: 1.5 }}>
            💡 {current.tip}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={completeStep}
              style={{ flex: 1, padding: '11px', borderRadius: 12, border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer' }}>
              Plus tard
            </button>
            <button onClick={goToPage}
              style={{ flex: 2, padding: '11px', borderRadius: 12, border: 'none', background: current.color, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {current.cta} <ArrowRight size={15} />
            </button>
          </div>
        </div>

        {/* Step dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '0 24px 20px' }}>
          {STEPS.map((s, i) => (
            <button key={s.id} onClick={() => { setStep(i); localStorage.setItem(STEP_KEY, String(i)); }}
              style={{ width: i === step ? 24 : 8, height: 8, borderRadius: 9999, border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: completed.has(s.id) ? '#059669' : i === step ? current.color : 'var(--card-border)' }} />
          ))}
        </div>

        {/* Step checklist */}
        <div style={{ borderTop: '1px solid var(--card-border)', padding: '14px 24px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {STEPS.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
              {completed.has(s.id)
                ? <CheckCircle size={14} color="#059669" />
                : <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${i === step ? s.color : 'var(--card-border)'}`, flexShrink: 0 }} />}
              <span style={{ color: completed.has(s.id) ? '#059669' : i === step ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: i === step ? 600 : 400 }}>{s.title.split(' ').slice(0, 3).join(' ')}…</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Small "Get started" banner shown at bottom of dashboard after onboarding dismissed */
export function OnboardingBanner({ onReopen }: { onReopen: () => void }) {
  const isDone = localStorage.getItem(STORAGE_KEY);
  if (!isDone) return null;
  const progress = 1; // Could track per-step completion
  return (
    <button onClick={onReopen}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 14, background: 'var(--card-bg)', border: '1px solid var(--card-border)', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Guide de démarrage GrowthOS</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>4 étapes pour booster votre prospection</div>
      </div>
      <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
    </button>
  );
}
