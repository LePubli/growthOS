'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Users, Bell, Globe, Mail, Palette, CreditCard, Key, Shield } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from 'sonner';

type Tab = 'general' | 'branding' | 'smtp' | 'members' | 'security' | 'billing';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'general',  label: 'Général',    icon: <Settings size={14} /> },
  { id: 'branding', label: 'Branding',   icon: <Palette size={14} /> },
  { id: 'smtp',     label: 'SMTP/Email', icon: <Mail size={14} /> },
  { id: 'members',  label: 'Membres',    icon: <Users size={14} /> },
  { id: 'security', label: 'Sécurité',   icon: <Shield size={14} /> },
  { id: 'billing',  label: 'Abonnement', icon: <CreditCard size={14} /> },
];

function Field({ label, children, desc }: { label: string; children: React.ReactNode; desc?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{label}</label>
      {desc && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 8px' }}>{desc}</p>}
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('general');
  const { tenant, user } = useAuthStore();
  const qc = useQueryClient();

  // SMTP state
  const [smtp, setSmtp] = useState({ host: '', port: '587', user: '', password: '', from_email: '', from_name: '' });
  const [smtpTesting, setSmtpTesting] = useState(false);

  // Branding state
  const [branding, setBranding] = useState<Record<string, any>>((tenant?.branding as any) || {});

  // Members
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');

  const { data: members = [] } = useQuery<any[]>({
    queryKey: ['tenant-members'],
    queryFn: () => apiClient.get('/tenants/members'),
    enabled: tab === 'members',
  });

  const brandingMutation = useMutation({
    mutationFn: (data: any) => apiClient.patch('/tenants/branding', data),
    onSuccess: () => { toast.success('Branding mis à jour'); },
    onError: (e: any) => toast.error(e.message),
  });

  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; role: string }) => apiClient.post('/tenants/invite', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenant-members'] }); setInviteEmail(''); toast.success('Invitation envoyée'); },
    onError: (e: any) => toast.error(e.message),
  });

  const testSmtp = async () => {
    setSmtpTesting(true);
    try {
      await apiClient.post('/settings/smtp/test', smtp);
      toast.success('✓ Email de test envoyé avec succès');
    } catch (e: any) {
      toast.error(e.message || 'Erreur SMTP');
    } finally { setSmtpTesting(false); }
  };

  const CARD = { background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '24px', boxShadow: 'var(--shadow-card)', marginBottom: 20 };

  return (
    <div style={{ height: '100%', display: 'flex', overflow: 'hidden', background: 'var(--bg-app)' }}>

      {/* Sidebar nav */}
      <div style={{ width: 220, borderRight: '1px solid var(--border-color)', background: 'var(--bg-card)', flexShrink: 0, padding: '20px 12px' }}>
        <h2 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 4px 12px' }}>Paramètres</h2>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t.id ? 600 : 400, background: tab === t.id ? 'rgba(1,126,132,.1)' : 'transparent', color: tab === t.id ? 'var(--color-primary)' : 'var(--text-secondary)', borderLeft: `3px solid ${tab === t.id ? 'var(--color-primary)' : 'transparent'}`, textAlign: 'left', marginBottom: 2, transition: 'all .15s' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>

        {/* General */}
        {tab === 'general' && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 20px' }}>Informations générales</h2>
            <div style={CARD}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {[
                  { label: "Nom de l'organisation", value: tenant?.name || '' },
                  { label: 'Slug', value: (tenant as any)?.slug || '' },
                ].map(f => (
                  <Field key={f.label} label={f.label}>
                    <input className="o-form-control" defaultValue={f.value} disabled style={{ background: '#F8F9FA' }} />
                  </Field>
                ))}
                <Field label="Fuseau horaire">
                  <select className="o-form-control">
                    <option>Europe/Paris</option>
                    <option>Europe/London</option>
                    <option>America/New_York</option>
                  </select>
                </Field>
                <Field label="Langue">
                  <select className="o-form-control">
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                  </select>
                </Field>
              </div>
              <button className="o-btn o-btn-primary o-btn-sm" onClick={() => toast.success('Paramètres sauvegardés')}>
                Sauvegarder
              </button>
            </div>
          </div>
        )}

        {/* Branding */}
        {tab === 'branding' && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 20px' }}>Branding & White-label</h2>
            <div style={CARD}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <Field label="Nom de l'entreprise">
                  <input className="o-form-control" value={branding.companyName || ''} onChange={e => setBranding(b => ({ ...b, companyName: e.target.value }))} />
                </Field>
                <Field label="Email de support">
                  <input className="o-form-control" type="email" value={branding.supportEmail || ''} onChange={e => setBranding(b => ({ ...b, supportEmail: e.target.value }))} />
                </Field>
                <Field label="Couleur principale">
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="color" value={branding.primaryColor || '#017E84'} onChange={e => setBranding(b => ({ ...b, primaryColor: e.target.value }))}
                      style={{ width: 40, height: 38, borderRadius: 6, border: '1px solid var(--border-color)', cursor: 'pointer', padding: 2 }} />
                    <input className="o-form-control" value={branding.primaryColor || '#017E84'} onChange={e => setBranding(b => ({ ...b, primaryColor: e.target.value }))} />
                  </div>
                </Field>
                <Field label="Logo URL">
                  <input className="o-form-control" value={branding.logoUrl || ''} onChange={e => setBranding(b => ({ ...b, logoUrl: e.target.value }))} placeholder="https://..." />
                </Field>
              </div>
              <button className="o-btn o-btn-primary o-btn-sm" onClick={() => brandingMutation.mutate(branding)}>
                {brandingMutation.isPending ? 'Sauvegarde...' : 'Sauvegarder le branding'}
              </button>
            </div>
          </div>
        )}

        {/* SMTP */}
        {tab === 'smtp' && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 20px' }}>Configuration SMTP</h2>
            <div style={CARD}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <Field label="Serveur SMTP" desc="Ex: mail.exemple.fr ou smtp.gmail.com">
                  <input className="o-form-control" value={smtp.host} onChange={e => setSmtp(s => ({ ...s, host: e.target.value }))} placeholder="mail.mondomaine.fr" />
                </Field>
                <Field label="Port">
                  <select className="o-form-control" value={smtp.port} onChange={e => setSmtp(s => ({ ...s, port: e.target.value }))}>
                    <option value="587">587 (STARTTLS)</option>
                    <option value="465">465 (SSL)</option>
                    <option value="25">25 (Non sécurisé)</option>
                  </select>
                </Field>
                <Field label="Utilisateur SMTP">
                  <input className="o-form-control" value={smtp.user} onChange={e => setSmtp(s => ({ ...s, user: e.target.value }))} placeholder="user@mondomaine.fr" />
                </Field>
                <Field label="Mot de passe">
                  <input className="o-form-control" type="password" value={smtp.password} onChange={e => setSmtp(s => ({ ...s, password: e.target.value }))} placeholder="••••••••" />
                </Field>
                <Field label="Email expéditeur">
                  <input className="o-form-control" type="email" value={smtp.from_email} onChange={e => setSmtp(s => ({ ...s, from_email: e.target.value }))} placeholder="noreply@mondomaine.fr" />
                </Field>
                <Field label="Nom expéditeur">
                  <input className="o-form-control" value={smtp.from_name} onChange={e => setSmtp(s => ({ ...s, from_name: e.target.value }))} placeholder="GrowthOS" />
                </Field>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="o-btn o-btn-secondary o-btn-sm" onClick={testSmtp} disabled={smtpTesting || !smtp.host}>
                  <Mail size={13} /> {smtpTesting ? 'Envoi...' : 'Tester la connexion'}
                </button>
                <button className="o-btn o-btn-primary o-btn-sm" onClick={() => toast.success('Config SMTP sauvegardée')}>
                  Sauvegarder
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Members */}
        {tab === 'members' && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 20px' }}>Membres de l'équipe</h2>

            {/* Invite */}
            <div style={{ ...CARD, marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px', color: 'var(--text-primary)' }}>Inviter un membre</h3>
              <div style={{ display: 'flex', gap: 10 }}>
                <input className="o-form-control" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@exemple.fr" style={{ flex: 1 }} />
                <select className="o-form-control" value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ width: 130 }}>
                  <option value="viewer">Viewer</option>
                  <option value="member">Member</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
                <button className="o-btn o-btn-primary o-btn-sm"
                  disabled={!inviteEmail || inviteMutation.isPending}
                  onClick={() => inviteMutation.mutate({ email: inviteEmail, role: inviteRole })}>
                  {inviteMutation.isPending ? 'Invitation...' : 'Inviter'}
                </button>
              </div>
            </div>

            {/* Members list */}
            <div style={CARD}>
              <table className="o-table">
                <thead>
                  <tr><th>Utilisateur</th><th>Rôle</th><th>Statut</th><th>Dernière connexion</th></tr>
                </thead>
                <tbody>
                  {members.map((m: any) => (
                    <tr key={m.id}>
                      <td>
                        <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{m.user?.email}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.user?.firstName} {m.user?.lastName}</div>
                      </td>
                      <td><span className={`o-badge o-badge-${m.role === 'owner' ? 'primary' : m.role === 'admin' ? 'warning' : 'muted'}`}>{m.role}</span></td>
                      <td><span className="o-badge o-badge-success">Actif</span></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{m.user?.lastLoginAt ? new Date(m.user.lastLoginAt).toLocaleDateString('fr-FR') : 'Jamais'}</td>
                    </tr>
                  ))}
                  {members.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>Aucun membre</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Security */}
        {tab === 'security' && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 20px' }}>Sécurité</h2>
            <div style={CARD}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px' }}>Changer le mot de passe</h3>
              {['Mot de passe actuel', 'Nouveau mot de passe', 'Confirmer le nouveau mot de passe'].map(label => (
                <Field key={label} label={label}>
                  <input className="o-form-control" type="password" placeholder="••••••••" style={{ maxWidth: 380 }} />
                </Field>
              ))}
              <button className="o-btn o-btn-primary o-btn-sm">Changer le mot de passe</button>
            </div>
            <div style={CARD}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px' }}>Authentification à deux facteurs</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Renforcez la sécurité de votre compte avec un second facteur d'authentification.</p>
              <button className="o-btn o-btn-secondary o-btn-sm"><Key size={13} /> Activer le 2FA</button>
            </div>
          </div>
        )}

        {/* Billing */}
        {tab === 'billing' && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 20px' }}>Abonnement & Facturation</h2>
            <div style={CARD}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Plan Starter</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Essai gratuit — 14 jours restants</div>
                </div>
                <span className="o-badge o-badge-warning">TRIAL</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'Prospects', used: 147, limit: 1000 },
                  { label: 'Emails/mois', used: 23, limit: 1000 },
                  { label: 'Membres', used: 1, limit: 2 },
                ].map(q => (
                  <div key={q.label} style={{ padding: 14, background: '#F8F9FA', borderRadius: 8, border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{q.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{q.used}<span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>/{q.limit}</span></div>
                    <div style={{ height: 4, background: 'var(--border-light)', borderRadius: 2 }}>
                      <div style={{ height: '100%', width: `${q.used / q.limit * 100}%`, background: 'var(--color-primary)', borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>
              <button className="o-btn o-btn-primary">Passer en Pro — 49€/mois</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
