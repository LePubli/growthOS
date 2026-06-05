import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, Plus, Trash2, CheckCircle, AlertCircle, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';

export default function SSOConfigPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<string>('');
  const [form, setForm] = useState({ provider: '', ssoUrl: '', entityId: '', certificate: '', isActive: false });

  const { data: configs = [] } = useQuery<any[]>({
    queryKey: ['sso-configs'],
    queryFn: () => apiClient.get('/sso/config') as Promise<any[]>,
    staleTime: 30_000,
  });
  const { data: providers = [] } = useQuery<any[]>({
    queryKey: ['sso-providers'],
    queryFn: () => apiClient.get('/sso/providers') as Promise<any[]>,
    staleTime: 3_600_000,
  });

  const saveMut = useMutation({
    mutationFn: (data: any) => apiClient.post('/sso/config', data) as Promise<any>,
    onSuccess: () => {
      toast.success('Configuration SSO sauvegardée');
      qc.invalidateQueries({ queryKey: ['sso-configs'] });
      setShowForm(false);
      setForm({ provider: '', ssoUrl: '', entityId: '', certificate: '', isActive: false });
    },
  });

  const testMut = useMutation({
    mutationFn: (id: string) => apiClient.post(`/sso/config/${id}/test`, {}) as Promise<any>,
    onSuccess: (d) => {
      if (d.success) toast.success(`✓ Connexion SSO réussie (${d.statusCode})`);
      else toast.error(`Échec : ${d.message}`);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/sso/config/${id}`) as Promise<any>,
    onSuccess: () => { toast.success('Configuration supprimée'); qc.invalidateQueries({ queryKey: ['sso-configs'] }); },
  });

  const selectedProvider = providers.find(p => p.id === form.provider);

  const fillFromProvider = (provider: any) => {
    setForm(f => ({ ...f, provider: provider.id, entityId: provider.defaultEntityId, ssoUrl: '' }));
  };

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Lock size={20} style={{ color: '#8B5CF6' }} /> SSO & SAML 2.0
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Authentification unique via Azure AD, Okta, Google Workspace…</p>
        </div>
        <button onClick={() => setShowForm(s => !s)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, border: 'none', background: '#8B5CF6', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          <Plus size={14} />Ajouter un provider
        </button>
      </div>

      {/* Provider cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        {providers.map(p => {
          const configured = configs.find(c => c.provider === p.id);
          return (
            <div key={p.id} style={{ background: 'var(--card-bg)', border: `2px solid ${configured?.is_active ? '#8B5CF6' : 'var(--card-border)'}`, borderRadius: 12, padding: 16, cursor: 'pointer', textAlign: 'center', transition: 'all .2s' }}
              onClick={() => { setShowForm(true); fillFromProvider(p); }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{p.logo}</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{p.name}</div>
              {configured ? (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 11, color: configured.is_active ? '#059669' : '#F59E0B' }}>
                  {configured.is_active ? <CheckCircle size={11} /> : <AlertCircle size={11} />}
                  {configured.is_active ? 'Actif' : 'Configuré'}
                </div>
              ) : (
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>Non configuré</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add/edit form */}
      {showForm && (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: 24, marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 20 }}>Configuration SSO</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Provider *</label>
              <select value={form.provider} onChange={e => { const p = providers.find(x => x.id === e.target.value); if (p) fillFromProvider(p); }}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}>
                <option value="">Choisir un provider…</option>
                {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>SSO URL (IdP) *</label>
              <input value={form.ssoUrl} onChange={e => setForm(f => ({ ...f, ssoUrl: e.target.value }))}
                placeholder="https://login.microsoftonline.com/..."
                style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Entity ID</label>
              <input value={form.entityId} onChange={e => setForm(f => ({ ...f, entityId: e.target.value }))}
                placeholder={selectedProvider?.defaultEntityId ?? 'https://...'}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 24 }}>
              <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} style={{ width: 16, height: 16 }} />
              <label htmlFor="isActive" style={{ fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>Activer ce SSO</label>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Certificat X.509 (optionnel)</label>
              <textarea value={form.certificate} onChange={e => setForm(f => ({ ...f, certificate: e.target.value }))}
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                rows={4}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 12, outline: 'none', fontFamily: 'monospace', resize: 'vertical' }} />
            </div>
          </div>

          {selectedProvider && (
            <div style={{ marginTop: 16, background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: '#5B21B6', marginBottom: 6, fontWeight: 600 }}>Mapping d'attributs par défaut ({selectedProvider.name})</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {Object.entries(selectedProvider.attrMapping ?? {}).map(([k, v]) => (
                  <div key={k} style={{ fontSize: 11, background: '#EDE9FE', padding: '3px 10px', borderRadius: 6, color: '#5B21B6' }}>
                    <strong>{k}</strong> → {String(v)}
                  </div>
                ))}
              </div>
              <a href={selectedProvider.docsUrl} target="_blank" rel="noreferrer"
                style={{ fontSize: 11, color: '#7C3AED', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, textDecoration: 'none' }}>
                <ExternalLink size={10} />Documentation {selectedProvider.name}
              </a>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button onClick={() => saveMut.mutate(form)} disabled={!form.provider || !form.ssoUrl || saveMut.isPending}
              style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: '#8B5CF6', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: !form.provider || !form.ssoUrl ? .5 : 1 }}>
              {saveMut.isPending ? 'Sauvegarde…' : 'Sauvegarder'}
            </button>
            <button onClick={() => setShowForm(false)}
              style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Existing configs */}
      {configs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
          <Lock size={32} style={{ display: 'block', margin: '0 auto 12px', opacity: .3 }} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>Aucun SSO configuré</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Ajoutez un provider pour permettre l'authentification SSO</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {configs.map(c => (
            <div key={c.id} style={{ background: 'var(--card-bg)', border: `1px solid ${c.is_active ? '#8B5CF6' : 'var(--card-border)'}`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🔑</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{c.provider}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.sso_url}</div>
              </div>
              <span style={{ padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: c.is_active ? '#D1FAE5' : '#FEF3C7', color: c.is_active ? '#059669' : '#92400E' }}>
                {c.is_active ? 'Actif' : 'Inactif'}
              </span>
              <button onClick={() => testMut.mutate(c.id)} disabled={testMut.isPending}
                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
                Tester
              </button>
              <button onClick={() => { if (confirm('Supprimer cette config SSO ?')) deleteMut.mutate(c.id); }}
                style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Info box */}
      <div style={{ marginTop: 24, background: '#F0FDF4', border: '1px solid #D1FAE5', borderRadius: 12, padding: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#065F46', marginBottom: 8 }}>ℹ️ Configuration côté GrowthOS</div>
        <div style={{ fontSize: 12, color: '#065F46', lineHeight: 1.6 }}>
          <strong>Callback URL :</strong> <code>{window.location.origin}/api/v1/sso/{'{provider}'}/callback</code><br/>
          <strong>Entity ID :</strong> <code>{window.location.origin}/api/v1/sso/metadata</code><br/>
          <strong>ACS URL :</strong> <code>{window.location.origin}/api/v1/sso/{'{provider}'}/acs</code>
        </div>
      </div>
    </div>
  );
}
