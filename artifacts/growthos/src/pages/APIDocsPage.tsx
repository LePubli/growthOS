import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { Code2, Copy, ExternalLink, ChevronDown, ChevronRight, Key, BookOpen, Zap, Globe } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';

const METHOD_COLORS: Record<string, { bg: string; text: string }> = {
  get:    { bg: '#D1FAE5', text: '#065F46' },
  post:   { bg: '#DBEAFE', text: '#1E40AF' },
  patch:  { bg: '#FEF3C7', text: '#92400E' },
  put:    { bg: '#FEF3C7', text: '#92400E' },
  delete: { bg: '#FEE2E2', text: '#991B1B' },
};

const TAG_ICONS: Record<string, string> = {
  Auth: '🔐', Prospects: '👤', Pipeline: '💼', Signals: '📡',
  Tasks: '✅', Activities: '📋', Sequences: '📧', Reporting: '📊',
  'API Keys': '🔑', Webhooks: '🔗', Compliance: '🛡️', SSO: '🔒',
};

export default function APIDocsPage() {
  const { token } = useAuthStore();
  const [openTags, setOpenTags] = useState<Set<string>>(new Set(['Prospects', 'Pipeline']));
  const [tryItPath, setTryItPath] = useState('');
  const [tryItMethod, setTryItMethod] = useState('GET');
  const [tryItBody, setTryItBody] = useState('');
  const [tryItResult, setTryItResult] = useState('');
  const [tryItLoading, setTryItLoading] = useState(false);

  const { data: spec } = useQuery({
    queryKey: ['openapi-spec'],
    queryFn: () => apiClient.get('/api-docs/openapi.json') as Promise<any>,
    staleTime: 3_600_000,
  });
  const { data: stats } = useQuery({
    queryKey: ['api-docs-stats'],
    queryFn: () => apiClient.get('/api-docs/stats') as Promise<any>,
    staleTime: 3_600_000,
  });
  const { data: apiKeys = [] } = useQuery<any[]>({
    queryKey: ['api-keys'],
    queryFn: () => apiClient.get('/api-keys') as Promise<any[]>,
    staleTime: 30_000,
  });

  const toggleTag = (tag: string) => {
    setOpenTags(s => { const n = new Set(s); n.has(tag) ? n.delete(tag) : n.add(tag); return n; });
  };

  const copyCode = (text: string) => { navigator.clipboard.writeText(text); toast.success('Copié !'); };

  const runTryIt = async () => {
    if (!tryItPath) return;
    setTryItLoading(true);
    try {
      const url = `/api/v1${tryItPath.startsWith('/') ? tryItPath : '/' + tryItPath}`;
      const opts: RequestInit = {
        method: tryItMethod,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      };
      if (['POST', 'PATCH', 'PUT'].includes(tryItMethod) && tryItBody) opts.body = tryItBody;
      const r = await fetch(url, opts);
      const text = await r.text();
      let pretty = text;
      try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch {}
      setTryItResult(`HTTP ${r.status} ${r.statusText}\n\n${pretty}`);
    } catch (e: any) {
      setTryItResult(`Erreur : ${e.message}`);
    }
    setTryItLoading(false);
  };

  const paths = spec?.paths ?? {};
  const tagMap: Record<string, Array<{ path: string; method: string; op: any }>> = {};
  Object.entries(paths).forEach(([path, methods]: [string, any]) => {
    Object.entries(methods).forEach(([method, op]: [string, any]) => {
      const tags: string[] = op.tags ?? ['Other'];
      tags.forEach(tag => {
        if (!tagMap[tag]) tagMap[tag] = [];
        tagMap[tag].push({ path, method, op });
      });
    });
  });

  const curlExample = (path: string, method: string) =>
    `curl -X ${method.toUpperCase()} \\
  "${window.location.origin}/api/v1${path}" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json"`;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--body-bg)' }}>
      {/* Left nav */}
      <div style={{ width: 220, flexShrink: 0, background: 'var(--card-bg)', borderRight: '1px solid var(--card-border)', overflowY: 'auto', padding: '20px 0' }}>
        <div style={{ padding: '0 16px 16px', borderBottom: '1px solid var(--card-border)', marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={16} style={{ color: '#3B82F6' }} />API Reference
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>v{spec?.info?.version ?? '1.0.0'} · REST / JSON</div>
        </div>
        {Object.keys(tagMap).map(tag => (
          <button key={tag} onClick={() => toggleTag(tag)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px', background: openTags.has(tag) ? '#EFF6FF' : 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: openTags.has(tag) ? 700 : 500, color: openTags.has(tag) ? '#2563EB' : 'var(--text-secondary)' }}>
            <span>{TAG_ICONS[tag] ?? '📌'}</span>
            <span style={{ flex: 1 }}>{tag}</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{tagMap[tag].length}</span>
          </button>
        ))}
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--card-border)', background: 'var(--card-bg)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-primary)' }}>GrowthOS API</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Base URL : <code style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>{window.location.origin}/api/v1</code></div>
          </div>
          {stats && (
            <div style={{ display: 'flex', gap: 16 }}>
              {[{ label: 'Endpoints', value: stats.endpoints }, { label: 'Clés API', value: apiKeys.length }, { label: 'Tags', value: stats.tags?.length }].map(k => (
                <div key={k.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{k.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{k.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Endpoints list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            {/* Try It panel */}
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><Zap size={14} style={{ color: '#F59E0B' }} />Tester en direct</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <select value={tryItMethod} onChange={e => setTryItMethod(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 700, outline: 'none', width: 90 }}>
                  {['GET','POST','PATCH','PUT','DELETE'].map(m => <option key={m}>{m}</option>)}
                </select>
                <input value={tryItPath} onChange={e => setTryItPath(e.target.value)}
                  placeholder="/prospects?limit=10"
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
                <button onClick={runTryIt} disabled={tryItLoading}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3B82F6', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {tryItLoading ? '…' : 'Envoyer'}
                </button>
              </div>
              {['POST','PATCH','PUT'].includes(tryItMethod) && (
                <textarea value={tryItBody} onChange={e => setTryItBody(e.target.value)}
                  placeholder='{"key": "value"}'
                  rows={3}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'monospace', outline: 'none', resize: 'vertical', marginBottom: 8 }} />
              )}
              {tryItResult && (
                <pre style={{ background: '#0F172A', color: '#94A3B8', padding: 14, borderRadius: 8, fontSize: 11, overflowX: 'auto', maxHeight: 200, margin: 0 }}>{tryItResult}</pre>
              )}
            </div>

            {/* Authentication note */}
            <div style={{ background: '#FFF7ED', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Key size={14} style={{ color: '#F59E0B', flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 12, color: '#78350F', lineHeight: 1.6 }}>
                <strong>Authentification :</strong> Toutes les routes (sauf <code>/auth/login</code>) nécessitent un header <code>Authorization: Bearer YOUR_JWT_TOKEN</code>. Obtenez un token via <code>POST /auth/login</code>.
                {apiKeys.length > 0 && <span> Vous avez <strong>{apiKeys.length}</strong> clé(s) API configurée(s).</span>}
              </div>
            </div>

            {/* Endpoints by tag */}
            {Object.entries(tagMap).map(([tag, endpoints]) => (
              <div key={tag} style={{ marginBottom: 20 }}>
                <button onClick={() => toggleTag(tag)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', marginBottom: 8 }}>
                  <span style={{ fontSize: 16 }}>{TAG_ICONS[tag] ?? '📌'}</span>
                  <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>{tag}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--card-bg)', padding: '2px 8px', borderRadius: 8 }}>{endpoints.length} endpoints</span>
                  {openTags.has(tag) ? <ChevronDown size={14} style={{ color: 'var(--text-muted)', marginLeft: 'auto' }} /> : <ChevronRight size={14} style={{ color: 'var(--text-muted)', marginLeft: 'auto' }} />}
                </button>

                {openTags.has(tag) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {endpoints.map(({ path, method, op }) => {
                      const mc = METHOD_COLORS[method] ?? { bg: '#F3F4F6', text: '#374151' };
                      return (
                        <div key={`${method}${path}`} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                            <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800, background: mc.bg, color: mc.text, fontFamily: 'monospace' }}>{method.toUpperCase()}</span>
                            <code style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{path}</code>
                            <button onClick={() => { setTryItPath(path); setTryItMethod(method.toUpperCase()); }}
                              style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer' }}>
                              Tester
                            </button>
                            <button onClick={() => copyCode(curlExample(path, method))}
                              style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Copy size={10} />cURL
                            </button>
                          </div>
                          {op.summary && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{op.summary}</div>}
                          {op.parameters && op.parameters.length > 0 && (
                            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {op.parameters.map((p: any) => (
                                <span key={p.name} style={{ fontSize: 10, background: p.required ? '#FEF3C7' : 'var(--body-bg)', color: p.required ? '#92400E' : 'var(--text-muted)', padding: '2px 8px', borderRadius: 5, fontFamily: 'monospace', border: '1px solid var(--card-border)' }}>
                                  {p.in}: {p.name}{p.required ? ' *' : ''}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Right: SDK + auth info */}
          <div style={{ width: 280, flexShrink: 0, borderLeft: '1px solid var(--card-border)', overflowY: 'auto', padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 12 }}>Authentification JWT</div>
            <pre style={{ background: '#0F172A', color: '#7DD3FC', padding: 12, borderRadius: 8, fontSize: 11, overflowX: 'auto', marginBottom: 16 }}>{`POST /api/v1/auth/login
{
  "email": "admin@growthos.fr",
  "password": "••••••••"
}

→ { "token": "eyJ..." }`}</pre>

            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 12 }}>Exemple SDK (JS)</div>
            <div style={{ position: 'relative' }}>
              <pre style={{ background: '#0F172A', color: '#A7F3D0', padding: 12, borderRadius: 8, fontSize: 10, overflowX: 'auto', marginBottom: 4 }}>{`const res = await fetch(
  '/api/v1/prospects',
  {
    headers: {
      'Authorization':
        'Bearer ' + token
    }
  }
);
const { prospects } = await res.json();`}</pre>
              <button onClick={() => copyCode(`const res = await fetch('/api/v1/prospects', { headers: { 'Authorization': 'Bearer ' + token } });\nconst { prospects } = await res.json();`)}
                style={{ position: 'absolute', top: 8, right: 8, padding: '2px 6px', borderRadius: 4, border: 'none', background: 'rgba(255,255,255,.1)', color: '#94A3B8', fontSize: 10, cursor: 'pointer' }}>
                <Copy size={10} />
              </button>
            </div>

            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 12, marginTop: 16 }}>Codes de réponse</div>
            {[['200', '#D1FAE5', '#065F46', 'Succès'], ['201', '#D1FAE5', '#065F46', 'Créé'], ['400', '#FEF3C7', '#92400E', 'Paramètres invalides'], ['401', '#FEE2E2', '#991B1B', 'Non authentifié'], ['403', '#FEE2E2', '#991B1B', 'Accès refusé'], ['404', '#FEE2E2', '#991B1B', 'Introuvable'], ['500', '#FEE2E2', '#991B1B', 'Erreur serveur']].map(([code, bg, color, label]) => (
              <div key={code} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ background: bg, color, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}>{code}</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
              </div>
            ))}

            <div style={{ marginTop: 20, padding: 12, background: '#F0FDF4', borderRadius: 10, fontSize: 11, color: '#065F46' }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>📄 OpenAPI JSON</div>
              <a href="/api/v1/api-docs/openapi.json" target="_blank"
                style={{ color: '#2563EB', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ExternalLink size={10} />Télécharger le spec
              </a>
              <div style={{ marginTop: 4, fontSize: 10 }}>Compatible Postman, Insomnia, Swagger UI</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
