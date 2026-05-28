'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const { login, register } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: '', password: '', firstName: '', lastName: '', companyName: '',
  });

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await register(form);
      }
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Erreur d\'authentification');
    } finally { setLoading(false); }
  };

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, background: 'linear-gradient(135deg, #017E84, #714B67)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 24, margin: '0 auto 16px' }}>G</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>GrowthOS</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>Plateforme B2B Growth Intelligence</p>
        </div>

        {/* Card */}
        <div className="o-card">
          {/* Tabs */}
          <div style={{ display: 'flex', background: 'var(--bg-app)', borderRadius: 6, padding: 4, marginBottom: 24, gap: 4 }}>
            {(['login', 'register'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                style={{ flex: 1, padding: '7px', borderRadius: 4, border: 'none', cursor: 'pointer', fontWeight: mode === m ? 600 : 400, fontSize: 14, background: mode === m ? '#fff' : 'transparent', color: mode === m ? 'var(--color-primary)' : 'var(--text-secondary)', transition: 'all .15s', boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,.1)' : 'none' }}>
                {m === 'login' ? 'Connexion' : 'Inscription'}
              </button>
            ))}
          </div>

          <form onSubmit={handle}>
            {mode === 'register' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div className="o-form-group" style={{ margin: 0 }}>
                    <label className="o-form-label">Prénom</label>
                    <input className="o-form-control" value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="Jean" />
                  </div>
                  <div className="o-form-group" style={{ margin: 0 }}>
                    <label className="o-form-label">Nom</label>
                    <input className="o-form-control" value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Dupont" />
                  </div>
                </div>
                <div className="o-form-group">
                  <label className="o-form-label">Entreprise</label>
                  <input className="o-form-control" value={form.companyName} onChange={e => set('companyName', e.target.value)} placeholder="Acme SAS" />
                </div>
              </>
            )}

            <div className="o-form-group">
              <label className="o-form-label required">Email</label>
              <input type="email" className="o-form-control" value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@acme.fr" required />
            </div>

            <div className="o-form-group" style={{ marginBottom: 24 }}>
              <label className="o-form-label required">Mot de passe</label>
              <input type="password" className="o-form-control" value={form.password} onChange={e => set('password', e.target.value)} placeholder={mode === 'register' ? 'Minimum 8 caractères' : '••••••••'} required minLength={8} />
            </div>

            <button type="submit" disabled={loading} className="o-btn o-btn-primary" style={{ width: '100%', padding: '10px', fontSize: 14, justifyContent: 'center' }}>
              {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
            </button>
          </form>

          {mode === 'login' && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <a href="#" style={{ fontSize: 13, color: 'var(--color-primary)' }}>Mot de passe oublié ?</a>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: 'var(--text-muted)' }}>
          © 2026 GrowthOS · Tous droits réservés
        </p>
      </div>
    </div>
  );
}
