import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  KeyRound, Plus, Trash2, TestTube, Check, X, Loader2,
  Eye, EyeOff, CheckCircle, XCircle, AlertCircle,
  Globe, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';

/* ─── Types ─── */
interface ProviderDef {
  id: string; name: string; icon: string; description: string;
  hasSecret?: boolean; hasEndpoint?: boolean;
}
interface ProviderKey {
  id: string; provider: string; apiKeyMasked: string; hasSecret: boolean;
  endpointUrl?: string; isActive: boolean; lastUsedAt?: string; createdAt: string;
}
interface ProviderWithKey extends ProviderDef {
  configured: boolean; key: ProviderKey | null;
}

type TestStatus = 'idle' | 'testing' | 'ok' | 'error';
interface TestResult { ok: boolean; message: string; latencyMs?: number; }

/* ─── Modal Configurer ─── */
function ConfigModal({
  provider, existingKey, onClose,
}: { provider: ProviderDef; existingKey: ProviderKey | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [endpointUrl, setEndpointUrl] = useState(existingKey?.endpointUrl ?? '');
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const saveMutation = useMutation({
    mutationFn: () => apiClient.post('/admin/api-keys', {
      provider: provider.id,
      apiKey: apiKey.trim(),
      apiSecret: apiSecret.trim() || undefined,
      endpointUrl: endpointUrl.trim() || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-api-keys'] });
      toast.success(`Clé ${provider.name} configurée`);
      onClose();
    },
    onError: (e: any) => toast.error(e?.error ?? e?.message ?? 'Erreur'),
  });

  const handleTest = async () => {
    const keyToTest = apiKey.trim() || undefined;
    setTestStatus('testing');
    setTestResult(null);
    try {
      const result = await apiClient.post(`/admin/api-keys/${provider.id}/test`, {
        apiKey: keyToTest, endpointUrl: endpointUrl.trim() || undefined,
      }) as TestResult;
      setTestResult(result);
      setTestStatus(result.ok ? 'ok' : 'error');
    } catch (e: any) {
      setTestResult({ ok: false, message: e?.error ?? 'Erreur de connexion' });
      setTestStatus('error');
    }
  };

  const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid var(--card-border)', background: 'var(--body-bg)',
    color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' as const,
  };
  const isOllama = provider.id === 'ollama';
  const canSave = isOllama ? (endpointUrl.trim().length > 0 || apiKey.trim().length > 0) : apiKey.trim().length > 0;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 32, width: 500, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>{provider.icon}</span>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{provider.name}</h2>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{provider.description}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>

        {existingKey && (
          <div style={{ padding: '8px 14px', borderRadius: 8, background: '#F0FDF4', border: '1px solid #BBF7D0', marginBottom: 16, fontSize: 13, color: '#059669', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle size={14} /> Clé configurée : <code>{existingKey.apiKeyMasked}</code>
            {existingKey.lastUsedAt && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6B7280' }}>Utilisée {new Date(existingKey.lastUsedAt).toLocaleDateString('fr-FR')}</span>}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!isOllama && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Clé API {!existingKey && '*'}
                {existingKey && <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>(laisser vide pour ne pas changer)</span>}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder={existingKey ? '••••••••••••••••' : 'sk-...'}
                  style={{ ...inputStyle, paddingRight: 38 }}
                  autoComplete="off"
                />
                <button onClick={() => setShowKey(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          )}

          {provider.hasSecret && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Secret / Client Secret
                {existingKey?.hasSecret && <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>(déjà configuré)</span>}
              </label>
              <input type="password" value={apiSecret} onChange={e => setApiSecret(e.target.value)} placeholder="••••••••••" style={inputStyle} autoComplete="off" />
            </div>
          )}

          {(provider.hasEndpoint || isOllama) && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                URL de l'endpoint {isOllama && '*'}
              </label>
              <input value={endpointUrl} onChange={e => setEndpointUrl(e.target.value)} placeholder="http://localhost:11434" style={inputStyle} />
              {isOllama && <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>URL de votre instance Ollama locale ou distante</p>}
            </div>
          )}

          {/* Test status */}
          {testResult && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, fontSize: 13,
              background: testResult.ok ? '#F0FDF4' : '#FEF2F2',
              border: `1px solid ${testResult.ok ? '#BBF7D0' : '#FECACA'}`,
              color: testResult.ok ? '#059669' : '#DC2626',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {testResult.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
              <span>{testResult.message}</span>
              {testResult.latencyMs && <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.7 }}>{testResult.latencyMs}ms</span>}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 22, justifyContent: 'space-between' }}>
          <button onClick={handleTest} disabled={testStatus === 'testing' || (!canSave && !existingKey)}
            style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            {testStatus === 'testing' ? <Loader2 size={13} className="animate-spin" /> : <TestTube size={13} />}
            Tester
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>
              Annuler
            </button>
            <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || (!canSave && !existingKey)}
              style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              {saveMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Carte provider ─── */
function ProviderCard({ provider, onConfigure, onDelete, onTest }: {
  provider: ProviderWithKey;
  onConfigure: () => void;
  onDelete: () => void;
  onTest: () => void;
}) {
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const handleTest = async () => {
    setTestStatus('testing');
    setTestResult(null);
    try {
      const result = await apiClient.post(`/admin/api-keys/${provider.id}/test`, {}) as TestResult;
      setTestResult(result);
      setTestStatus(result.ok ? 'ok' : 'error');
    } catch (e: any) {
      setTestResult({ ok: false, message: e?.error ?? 'Erreur' });
      setTestStatus('error');
    }
  };

  return (
    <div style={{
      background: 'var(--card-bg)', borderRadius: 14,
      border: `1.5px solid ${provider.configured ? '#BBF7D0' : 'var(--card-border)'}`,
      padding: 20, display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 26 }}>{provider.icon}</span>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{provider.name}</h3>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>{provider.description}</p>
          </div>
        </div>
        <span style={{
          padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, flexShrink: 0,
          background: provider.configured ? '#D1FAE5' : 'var(--body-bg)',
          color: provider.configured ? '#059669' : 'var(--text-muted)',
        }}>
          {provider.configured ? '✓ Configurée' : 'Non config.'}
        </span>
      </div>

      {/* Clé masquée */}
      {provider.key && (
        <div style={{ padding: '6px 10px', borderRadius: 8, background: 'var(--body-bg)', fontSize: 12 }}>
          <code style={{ color: 'var(--text-secondary)' }}>{provider.key.apiKeyMasked}</code>
          {provider.key.endpointUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
              <Globe size={10} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{provider.key.endpointUrl}</span>
            </div>
          )}
        </div>
      )}

      {/* Test result */}
      {testResult && (
        <div style={{
          padding: '6px 10px', borderRadius: 8, fontSize: 12,
          background: testResult.ok ? '#F0FDF4' : '#FEF2F2',
          color: testResult.ok ? '#059669' : '#DC2626',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {testResult.ok ? <CheckCircle size={12} /> : <XCircle size={12} />}
          {testResult.message}
          {testResult.latencyMs && <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.7 }}>{testResult.latencyMs}ms</span>}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
        <button onClick={onConfigure}
          style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <KeyRound size={12} />{provider.configured ? 'Modifier' : 'Configurer'}
        </button>
        {provider.configured && (
          <>
            <button onClick={handleTest} disabled={testStatus === 'testing'}
              style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', cursor: 'pointer', color: 'var(--color-primary)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
              {testStatus === 'testing' ? <Loader2 size={12} className="animate-spin" /> : <TestTube size={12} />}
              Tester
            </button>
            <button onClick={onDelete}
              style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #FCA5A5', background: '#FEF2F2', cursor: 'pointer', color: '#DC2626' }}>
              <Trash2 size={12} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Page principale ─── */
export default function ApiKeysPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<{ provider: ProviderDef } | null>(null);

  const { data, isLoading } = useQuery<{ providers: ProviderWithKey[]; keys: ProviderKey[] }>({
    queryKey: ['admin-api-keys'],
    queryFn: () => apiClient.get('/admin/api-keys') as Promise<{ providers: ProviderWithKey[]; keys: ProviderKey[] }>,
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (provider: string) => apiClient.delete(`/admin/api-keys/${provider}`),
    onSuccess: (_d, provider) => {
      qc.invalidateQueries({ queryKey: ['admin-api-keys'] });
      toast.success(`Clé ${provider} supprimée`);
    },
    onError: (e: any) => toast.error(e?.error ?? 'Erreur'),
  });

  const providers = data?.providers ?? [];
  const configured = providers.filter(p => p.configured).length;

  const CATEGORIES = [
    { label: 'IA & LLM', ids: ['openai', 'anthropic', 'gemini', 'mistral', 'ollama'] },
    { label: 'Enrichissement & Prospection', ids: ['hunter', 'clearbit', 'dropcontact', 'apollo', 'crunchbase', 'linkedin'] },
    { label: 'SEO & Réputation', ids: ['serpapi'] },
  ];

  return (
    <div style={{ padding: 28, maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <KeyRound size={22} /> Clés API Providers IA
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            {configured}/{providers.length} providers configurés · Chiffrement AES-256
          </p>
        </div>
        {/* Stats bar */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#059669' }}>{configured}</p>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>Configurées</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-muted)' }}>{providers.length - configured}</p>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>Manquantes</p>
          </div>
        </div>
      </div>

      {/* Notice sécurité */}
      <div style={{ padding: '10px 16px', borderRadius: 10, background: '#EFF6FF', border: '1px solid #BFDBFE', marginBottom: 24, fontSize: 13, color: '#1D4ED8', display: 'flex', alignItems: 'center', gap: 8 }}>
        <AlertCircle size={14} />
        <span>Les clés API sont chiffrées en AES-256-CBC en base de données. Elles ne sont jamais retournées en clair dans les réponses.</span>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-muted)' }}><Loader2 size={28} className="animate-spin" /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {CATEGORIES.map(cat => {
            const catProviders = providers.filter(p => cat.ids.includes(p.id));
            if (!catProviders.length) return null;
            return (
              <div key={cat.label}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Zap size={14} style={{ color: 'var(--color-primary)' }} />
                  <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cat.label}</h2>
                  <div style={{ flex: 1, height: 1, background: 'var(--card-border)' }} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {catProviders.filter(p => p.configured).length}/{catProviders.length}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                  {catProviders.map(provider => (
                    <ProviderCard
                      key={provider.id}
                      provider={provider}
                      onConfigure={() => setModal({ provider })}
                      onDelete={() => { if (confirm(`Supprimer la clé ${provider.name} ?`)) deleteMutation.mutate(provider.id); }}
                      onTest={() => {}}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <ConfigModal
          provider={modal.provider}
          existingKey={providers.find(p => p.id === modal.provider.id)?.key ?? null}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
