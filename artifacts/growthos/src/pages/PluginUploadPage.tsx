import { useState, useRef, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Upload, Package, Trash2, Play, Square, Download, CheckCircle, AlertCircle, Clock, FileArchive, Code, RefreshCw, Link, HelpCircle, X } from 'lucide-react';
import apiClient from '@/lib/api-client';

interface UploadedPlugin {
  id: string;
  slug: string;
  name: string;
  version: string;
  description: string | null;
  author: string;
  manifest: {
    routes?: { path: string; label: string; icon?: string }[];
    extends?: string;
    permissions?: string[];
  };
  state: 'uploaded' | 'installed' | 'active' | 'error';
  extends: string | null;
  error_msg: string | null;
  created_at: string;
  activated_at: string | null;
}

const STATE_CONFIG: Record<UploadedPlugin['state'], { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  uploaded:  { label: 'Uploadé',   color: '#6B7280', bg: '#F9FAFB', icon: <Upload size={11} /> },
  installed: { label: 'Installé',  color: '#2563EB', bg: '#EFF6FF', icon: <Package size={11} /> },
  active:    { label: 'Actif',     color: '#059669', bg: '#ECFDF5', icon: <CheckCircle size={11} /> },
  error:     { label: 'Erreur',    color: '#DC2626', bg: '#FEF2F2', icon: <AlertCircle size={11} /> },
};

function StateBadge({ state }: { state: UploadedPlugin['state'] }) {
  const c = STATE_CONFIG[state];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: c.bg, color: c.color, border: `1px solid ${c.color}33`,
    }}>
      {c.icon}{c.label}
    </span>
  );
}

function FormatDocModal({ onClose }: { onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ['plugin-format-doc'],
    queryFn: () => apiClient.get('/plugin-marketplace/format-doc') as Promise<any>,
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}>
      <div style={{ background: 'var(--card-bg)', borderRadius: 18, width: '100%', maxWidth: 600, padding: 24, maxHeight: '85vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Format d'un plugin uploadable</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>
        {data ? (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>{data.description}</p>
            <div style={{ fontFamily: 'monospace', fontSize: 12, background: 'var(--body-bg)', borderRadius: 10, padding: 14, marginBottom: 14, whiteSpace: 'pre', color: 'var(--text-secondary)' }}>
              {data.zipStructure?.join('\n')}
            </div>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Schéma manifest.json</p>
            <div style={{ fontFamily: 'monospace', fontSize: 11, background: 'var(--body-bg)', borderRadius: 10, padding: 14, marginBottom: 14, whiteSpace: 'pre', color: 'var(--text-secondary)', overflowX: 'auto' }}>
              {JSON.stringify(data.manifestSchema, null, 2)}
            </div>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Exemple Hello World</p>
            <div style={{ fontFamily: 'monospace', fontSize: 11, background: 'var(--body-bg)', borderRadius: 10, padding: 14, whiteSpace: 'pre', color: 'var(--text-secondary)', overflowX: 'auto' }}>
              {JSON.stringify(data.example, null, 2)}
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>Chargement…</div>
        )}
      </div>
    </div>
  );
}

export default function PluginUploadPage() {
  const qc = useQueryClient();
  const [dragging, setDragging] = useState(false);
  const [uploadSlug, setUploadSlug] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showFormatDoc, setShowFormatDoc] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['uploaded-plugins'],
    queryFn: () => apiClient.get('/plugin-marketplace') as Promise<{ plugins: UploadedPlugin[] }>,
    refetchInterval: 10_000,
  });

  const plugins = data?.plugins ?? [];

  const uploadMutation = useMutation({
    mutationFn: async ({ file, slug }: { file: File; slug: string }) => {
      const form = new FormData();
      form.append('file', file);
      form.append('slug', slug);
      return apiClient.postForm('/plugin-marketplace/upload', form);
    },
    onSuccess: (_, { slug }) => {
      toast.success(`Plugin "${slug}" uploadé avec succès`);
      setSelectedFile(null); setUploadSlug('');
      qc.invalidateQueries({ queryKey: ['uploaded-plugins'] });
    },
    onError: (err: any) => toast.error(`Échec de l'upload : ${err?.message ?? 'Erreur inconnue'}`),
  });

  const actionMutation = useMutation({
    mutationFn: ({ action, slug }: { action: string; slug: string }) => {
      if (action === 'delete') return apiClient.delete(`/plugin-marketplace/${slug}`);
      return apiClient.post(`/plugin-marketplace/${action}/${slug}`, {});
    },
    onSuccess: (_, { action, slug }) => {
      const labels: Record<string, string> = { install: 'installé', activate: 'activé', deactivate: 'désactivé', delete: 'supprimé' };
      toast.success(`Plugin "${slug}" ${labels[action] ?? action}`);
      qc.invalidateQueries({ queryKey: ['uploaded-plugins'] });
      qc.invalidateQueries({ queryKey: ['plugins'] });
    },
    onError: (err: any, { action }) => toast.error(`Échec (${action}) : ${err?.message ?? 'Erreur inconnue'}`),
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith('.zip')) setSelectedFile(file);
    else toast.error('Seuls les fichiers .zip sont acceptés');
  }, []);

  const handleUpload = () => {
    if (!selectedFile) return toast.error('Sélectionnez un fichier ZIP');
    if (!uploadSlug.trim()) return toast.error('Entrez un slug pour le plugin');
    uploadMutation.mutate({ file: selectedFile, slug: uploadSlug.trim() });
  };

  const action = (a: string, slug: string) => actionMutation.mutate({ action: a, slug });
  const isPending = (a: string, slug: string) => actionMutation.isPending && (actionMutation.variables as any)?.action === a && (actionMutation.variables as any)?.slug === slug;

  return (
    <div style={{ minHeight: '100vh', padding: 24, background: 'var(--body-bg)' }}>
      {showFormatDoc && <FormatDocModal onClose={() => setShowFormatDoc(false)} />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Upload Plugins</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '2px 0 0' }}>Chargez vos propres plugins au format ZIP — installation & activation instantanée</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowFormatDoc(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
            <HelpCircle size={14} />Format doc
          </button>
          <button onClick={() => refetch()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
            <RefreshCw size={14} />Rafraîchir
          </button>
        </div>
      </div>

      {/* Upload zone */}
      <div style={{ background: 'var(--card-bg)', border: `2px dashed ${dragging ? 'var(--color-primary)' : 'var(--card-border)'}`, borderRadius: 16, padding: '28px 24px', marginBottom: 20, transition: 'border-color .15s' }}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: dragging ? '#EEF2FF' : 'var(--body-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .15s' }}>
            <FileArchive size={28} style={{ color: dragging ? 'var(--color-primary)' : 'var(--text-muted)' }} />
          </div>
          {selectedFile ? (
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                📦 {selectedFile.name} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>({(selectedFile.size / 1024).toFixed(0)} KB)</span>
              </p>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Glissez votre fichier .zip ici</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>ou cliquez pour sélectionner</p>
            </div>
          )}
          <input ref={fileRef} type="file" accept=".zip" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) setSelectedFile(f); }} />
          <button onClick={() => fileRef.current?.click()} style={{ padding: '7px 18px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
            {selectedFile ? 'Changer de fichier' : 'Parcourir…'}
          </button>
        </div>

        {selectedFile && (
          <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <input
              value={uploadSlug}
              onChange={e => setUploadSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="slug-du-plugin (ex: crm-maps-pro)"
              style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', width: 260 }}
            />
            <button
              onClick={handleUpload}
              disabled={uploadMutation.isPending || !uploadSlug.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: uploadMutation.isPending ? .6 : 1 }}>
              {uploadMutation.isPending ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />Upload…</> : <><Upload size={13} />Uploader</>}
            </button>
          </div>
        )}
      </div>

      {/* Plugins table */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Plugins installés ({plugins.length})</span>
        </div>

        {isLoading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Chargement…</div>
        ) : plugins.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <Package size={36} style={{ margin: '0 auto 12px', display: 'block', opacity: .2 }} />
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Aucun plugin uploadé. Commencez par glisser un fichier .zip ci-dessus.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                  {['Plugin','Version','Auteur','État','Routes UI','Étend','Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plugins.map((p, i) => (
                  <tr key={p.id} style={{ borderBottom: i < plugins.length - 1 ? '1px solid var(--card-border)' : 'none', background: p.state === 'error' ? '#FEF2F2' : 'transparent' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{p.slug}</div>
                      {p.error_msg && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3, maxWidth: 280 }} title={p.error_msg}>⚠ {p.error_msg.slice(0, 80)}{p.error_msg.length > 80 ? '…' : ''}</div>}
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>v{p.version}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{p.author}</td>
                    <td style={{ padding: '12px 16px' }}><StateBadge state={p.state} /></td>
                    <td style={{ padding: '12px 16px' }}>
                      {(p.manifest.routes ?? []).length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {(p.manifest.routes ?? []).map(r => (
                            <span key={r.path} style={{ fontSize: 10, padding: '1px 7px', borderRadius: 6, background: 'var(--body-bg)', border: '1px solid var(--card-border)', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              {r.path}
                            </span>
                          ))}
                        </div>
                      ) : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {p.extends ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#7C3AED', background: '#EDE9FE', padding: '2px 8px', borderRadius: 8 }}>
                          <Link size={10} />Étend : {p.extends}
                        </span>
                      ) : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {p.state === 'uploaded' && (
                          <ActionBtn icon={<Download size={11} />} label="Installer" loading={isPending('install', p.slug)} onClick={() => action('install', p.slug)} color="#2563EB" />
                        )}
                        {p.state === 'installed' && (
                          <ActionBtn icon={<Play size={11} />} label="Activer" loading={isPending('activate', p.slug)} onClick={() => action('activate', p.slug)} color="#059669" />
                        )}
                        {p.state === 'active' && (
                          <ActionBtn icon={<Square size={11} />} label="Désactiver" loading={isPending('deactivate', p.slug)} onClick={() => action('deactivate', p.slug)} color="#D97706" />
                        )}
                        {p.state === 'error' && (
                          <>
                            <ActionBtn icon={<Download size={11} />} label="Réinstaller" loading={isPending('install', p.slug)} onClick={() => action('install', p.slug)} color="#2563EB" />
                          </>
                        )}
                        <ActionBtn icon={<Trash2 size={11} />} label="Supprimer" loading={isPending('delete', p.slug)} onClick={() => { if (confirm(`Supprimer "${p.name}" ?`)) action('delete', p.slug); }} color="#DC2626" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 12, background: 'var(--card-bg)', border: '1px solid var(--card-border)', fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
        <Code size={13} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>Workflow : <b>Upload ZIP</b> → <b>Installer</b> → <b>Activer</b>. Une fois activé, les routes UI du plugin apparaissent automatiquement dans la sidebar. Consultez le <button onClick={() => setShowFormatDoc(true)} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: 12, padding: 0, fontWeight: 600 }}>format doc</button> pour créer votre premier plugin.</span>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ActionBtn({ icon, label, loading, onClick, color }: { icon: React.ReactNode; label: string; loading: boolean; onClick: () => void; color: string }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
        borderRadius: 7, border: `1px solid ${color}44`,
        background: `${color}10`, color,
        fontSize: 11, fontWeight: 600, cursor: loading ? 'default' : 'pointer',
        opacity: loading ? .6 : 1, whiteSpace: 'nowrap',
      }}>
      {loading ? <RefreshCw size={10} style={{ animation: 'spin 1s linear infinite' }} /> : icon}
      {label}
    </button>
  );
}
