import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Eye, EyeOff, CheckCircle, Loader2, ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter — 49€/mois',
  pro: 'Pro — 149€/mois',
  enterprise: 'Enterprise — 499€/mois',
};

export default function RegisterPage() {
  const [, navigate] = useLocation();
  const { login } = useAuthStore();

  // Récupérer le plan depuis l'URL
  const params = new URLSearchParams(window.location.search);
  const defaultPlan = (params.get('plan') ?? 'starter') as 'starter' | 'pro' | 'enterprise';
  const defaultRef = params.get('ref') ?? '';

  const [form, setForm] = useState({
    companyName: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    planSlug: defaultPlan,
    referralCode: defaultRef,
  });

  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Redirect si déjà connecté
  const { isAuthenticated } = useAuthStore();
  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard');
  }, [isAuthenticated]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const validate = () => {
    if (!form.companyName.trim()) return 'Nom d\'entreprise requis';
    if (!form.email.trim()) return 'Email requis';
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(form.email)) return 'Email invalide';
    if (form.password.length < 8) return 'Mot de passe trop court (min 8 caractères)';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/v1/auth/register-public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Erreur lors de la création du compte');
        return;
      }

      setSuccess(true);

      // Login automatique
      if (data.accessToken && data.user && data.tenant) {
        login(data.accessToken, data.user, data.tenant);
        setTimeout(() => navigate('/onboarding'), 800);
      }
    } catch {
      setError('Erreur réseau — réessayez dans quelques instants');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-gray-950/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center font-bold text-sm">G</div>
            <span className="font-bold text-lg">GrowthOS</span>
          </Link>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            Déjà un compte ?{' '}
            <Link href="/login" className="text-purple-400 hover:text-purple-300 font-medium transition-colors">
              Se connecter
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center pt-16 px-6 py-12">
        <div className="w-full max-w-md">
          {/* Success state */}
          {success ? (
            <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-8 text-center">
              <CheckCircle size={48} className="text-green-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Compte créé !</h2>
              <p className="text-gray-400 text-sm">Redirection vers l'onboarding…</p>
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold mb-2">Créer votre compte</h1>
                <p className="text-gray-400 text-sm">14 jours gratuits · Sans carte bancaire</p>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg px-4 py-3 mb-6">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Nom entreprise */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Nom de l'entreprise <span className="text-red-400">*</span>
                  </label>
                  <input
                    name="companyName"
                    type="text"
                    value={form.companyName}
                    onChange={handleChange}
                    placeholder="Acme Corp"
                    autoComplete="organization"
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                    required
                  />
                </div>

                {/* Prénom / Nom */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Prénom</label>
                    <input
                      name="firstName"
                      type="text"
                      value={form.firstName}
                      onChange={handleChange}
                      placeholder="Jean"
                      autoComplete="given-name"
                      className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Nom</label>
                    <input
                      name="lastName"
                      type="text"
                      value={form.lastName}
                      onChange={handleChange}
                      placeholder="Dupont"
                      autoComplete="family-name"
                      className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Email professionnel <span className="text-red-400">*</span>
                  </label>
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="jean@acme.fr"
                    autoComplete="email"
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                    required
                  />
                </div>

                {/* Mot de passe */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Mot de passe <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      name="password"
                      type={showPass ? 'text' : 'password'}
                      value={form.password}
                      onChange={handleChange}
                      placeholder="Min. 8 caractères"
                      autoComplete="new-password"
                      className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-2.5 pr-10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Plan */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Plan</label>
                  <select
                    name="planSlug"
                    value={form.planSlug}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                  >
                    {Object.entries(PLAN_LABELS).map(([k, v]) => (
                      <option key={k} value={k} className="bg-gray-900">{v}</option>
                    ))}
                  </select>
                </div>

                {/* Code parrainage */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Code parrainage <span className="text-gray-500">(optionnel)</span>
                  </label>
                  <input
                    name="referralCode"
                    type="text"
                    value={form.referralCode}
                    onChange={handleChange}
                    placeholder="EX: GROWTHOS-XXXX"
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors uppercase"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-60 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-purple-600/20 mt-2"
                >
                  {loading ? (
                    <><Loader2 size={16} className="animate-spin" /> Création en cours…</>
                  ) : (
                    <>Créer mon compte <ArrowRight size={16} /></>
                  )}
                </button>
              </form>

              <p className="text-center text-xs text-gray-500 mt-6">
                En créant un compte, vous acceptez nos{' '}
                <span className="underline cursor-pointer hover:text-gray-300">CGU</span>
                {' '}et notre{' '}
                <span className="underline cursor-pointer hover:text-gray-300">politique de confidentialité</span>.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
