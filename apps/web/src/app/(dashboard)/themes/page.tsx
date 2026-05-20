'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Download, Trash2, Palette, Check, RefreshCw, Plus } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { useRef } from 'react';

interface Theme {
  id: string; name: string; slug: string; displayName: string;
  description: string; author: string; version: string;
  previewColor: string; previewBg: string;
  isBuiltin: boolean; isPublic: boolean;
}

interface TenantTheme {
  themeId: string; isActive: boolean;
  theme: Theme;
}

export default function ThemesPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({ name: '', slug: '', desc: '', accent: '#017E84', bg: '#F9F9F9' });

  const { data: themes, isLoading } = useQuery<Theme[]>({
    queryKey: ['themes'],
    queryFn: () => apiClient.get('/themes'),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/themes/${id}/activate`, {}),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['themes'] });
      // Rafraîchit le ThemeProvider
      if ((window as any).__refreshTheme) (window as any).__refreshTheme();
      toast.success('Thème activé — changement appliqué');
    },
    onError: () => toast.error('Erreur activation'),
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return apiClient.upload('/themes/import', fd);
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['themes'] });
      toast.success(`Thème "${data.name}" importé`);
    },
    onError: () => toast.error('Fichier invalide'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/themes/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['themes'] }); toast.success('Thème supprimé'); },
    onError: (e: any) => toast.error(e.message),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiClient.post('/themes', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['themes'] }); setShowCreate(false); toast.success('Thème créé'); },
    onError: (e: any) => toast.error(e.message),
  });

  const handleExport = async (id: string, slug: string) => {
    const data = await apiClient.get(`/themes/${id}/export`);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${slug}.theme.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const activeTheme = themes?.find((t: any) => t.isActive);

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 24, background: 'var(--bg-app)' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Thèmes</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Personnalisez l'apparence — changement instantané sans rechargement
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }}
            onChange={e => e.target.files?.[0] && importMutation.mutate(e.target.files[0])} />
          <button onClick={() => fileRef.current?.click()} className="o-btn o-btn-secondary o-btn-sm">
            <Upload size={13} /> Importer
          </button>
          <button onClick={() => setShowCreate(true)} className="o-btn o-btn-primary o-btn-sm">
            <Plus size={13} /> Nouveau thème
          </button>
        </div>
      </div>

      {/* Thème actif */}
      {activeTheme && (
        <div style={{ background: 'rgba(1,126,132,.06)', border: '1px solid rgba(1,126,132,.2)', borderRadius: 8, padding: '14px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: (activeTheme as any).previewColor || '#017E84', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
              Thème actif : {(activeTheme as any).displayName || (activeTheme as any).name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{(activeTheme as any).description}</div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <span className="o-badge o-badge-success">✓ Actif</span>
          </div>
        </div>
      )}

      {/* Grid thèmes */}
      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="o-skeleton" style={{ height: 220, borderRadius: 8 }} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {themes?.map((theme: any) => (
            <div key={theme.id}
              style={{ background: 'var(--bg-card)', border: `2px solid ${theme.isActive ? 'var(--color-primary)' : 'var(--border-color)'}`, borderRadius: 10, overflow: 'hidden', transition: 'all .15s', boxShadow: theme.isActive ? '0 0 0 4px rgba(1,126,132,.1)' : 'var(--shadow-card)' }}>

              {/* Preview */}
              <div style={{ height: 110, background: theme.previewBg || '#F9F9F9', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                {/* Mini-UI preview */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                  <div style={{ width: 36, height: 80, borderRadius: 6, background: theme.previewColor || '#2C3E50', display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 4px', opacity: 0.9 }}>
                    {[0,1,2,3].map(i => <div key={i} style={{ height: 5, borderRadius: 2, background: i === 0 ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.3)', width: i === 0 ? '100%' : '75%' }} />)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[0,1].map(i => (
                      <div key={i} style={{ width: 90, height: 34, borderRadius: 5, background: 'rgba(255,255,255,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: i === 0 ? 55 : 40, height: 5, borderRadius: 2, background: i === 0 ? theme.previewColor : 'rgba(0,0,0,.1)' }} />
                      </div>
                    ))}
                  </div>
                </div>

                {theme.isActive && (
                  <div style={{ position: 'absolute', top: 8, right: 8, background: 'var(--color-primary)', color: '#fff', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Check size={10} /> Actif
                  </div>
                )}
                {theme.isBuiltin && !theme.isActive && (
                  <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,.5)', color: '#fff', borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 600 }}>
                    Builtin
                  </div>
                )}
                <div style={{ position: 'absolute', bottom: 8, right: 8, width: 22, height: 22, borderRadius: '50%', background: theme.previewColor, border: '3px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)' }} />
              </div>

              {/* Info */}
              <div style={{ padding: '14px 16px' }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 2 }}>
                  {theme.displayName || theme.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                  {theme.author} · v{theme.version}
                </div>
                {theme.description && (
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {theme.description}
                  </p>
                )}

                <div style={{ display: 'flex', gap: 6 }}>
                  {!theme.isActive ? (
                    <button onClick={() => activateMutation.mutate(theme.id)}
                      disabled={activateMutation.isPending}
                      className="o-btn o-btn-primary o-btn-sm" style={{ flex: 1 }}>
                      {activateMutation.isPending ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Palette size={12} />}
                      Activer
                    </button>
                  ) : (
                    <div style={{ flex: 1, padding: '5px 10px', borderRadius: 5, background: 'rgba(40,167,69,.1)', color: '#28A745', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <Check size={12} /> Thème actif
                    </div>
                  )}
                  <button onClick={() => handleExport(theme.id, theme.slug)}
                    className="o-btn o-btn-secondary o-btn-sm" style={{ padding: '5px 8px' }} title="Exporter">
                    <Download size={13} />
                  </button>
                  {!theme.isBuiltin && !theme.isActive && (
                    <button onClick={() => { if (confirm(`Supprimer "${theme.name}" ?`)) deleteMutation.mutate(theme.id); }}
                      style={{ padding: '5px 8px', borderRadius: 5, background: 'rgba(220,53,69,.06)', border: '1px solid rgba(220,53,69,.2)', color: '#DC3545', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Supprimer">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal créer thème */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: 12, padding: 24, width: 460, maxWidth: '95vw', boxShadow: 'var(--shadow-lg)', animation: 'popIn .15s ease' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 20px', color: 'var(--text-primary)' }}>
              <Palette size={16} style={{ verticalAlign: 'middle', marginRight: 8 }} />
              Créer un thème personnalisé
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="o-form-group" style={{ margin: 0 }}>
                <label className="o-form-label required">Nom du thème</label>
                <input className="o-form-control" value={createForm.name}
                  onChange={e => setCreateForm(f => ({ ...f, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-') }))}
                  placeholder="Mon Thème Custom" />
              </div>
              <div className="o-form-group" style={{ margin: 0 }}>
                <label className="o-form-label required">Slug</label>
                <input className="o-form-control" value={createForm.slug}
                  onChange={e => setCreateForm(f => ({ ...f, slug: e.target.value }))}
                  placeholder="mon-theme-custom" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="o-form-group" style={{ margin: 0 }}>
                  <label className="o-form-label">Couleur principale</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="color" value={createForm.accent} onChange={e => setCreateForm(f => ({ ...f, accent: e.target.value }))}
                      style={{ width: 36, height: 34, borderRadius: 5, border: '1px solid var(--border-color)', cursor: 'pointer', padding: 2 }} />
                    <input className="o-form-control" value={createForm.accent} onChange={e => setCreateForm(f => ({ ...f, accent: e.target.value }))} style={{ flex: 1 }} />
                  </div>
                </div>
                <div className="o-form-group" style={{ margin: 0 }}>
                  <label className="o-form-label">Couleur fond</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="color" value={createForm.bg} onChange={e => setCreateForm(f => ({ ...f, bg: e.target.value }))}
                      style={{ width: 36, height: 34, borderRadius: 5, border: '1px solid var(--border-color)', cursor: 'pointer', padding: 2 }} />
                    <input className="o-form-control" value={createForm.bg} onChange={e => setCreateForm(f => ({ ...f, bg: e.target.value }))} style={{ flex: 1 }} />
                  </div>
                </div>
              </div>

              {/* Preview live */}
              <div style={{ height: 60, borderRadius: 8, background: createForm.bg, border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 46, borderRadius: 5, background: createForm.accent, opacity: .85 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ width: 90, height: 16, borderRadius: 4, background: 'rgba(255,255,255,.8)' }} />
                  <div style={{ width: 70, height: 12, borderRadius: 4, background: 'rgba(255,255,255,.5)' }} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowCreate(false)} className="o-btn o-btn-secondary o-btn-sm">Annuler</button>
              <button
                disabled={!createForm.name || !createForm.slug || createMutation.isPending}
                onClick={() => createMutation.mutate({
                  name: createForm.name, slug: createForm.slug,
                  displayName: createForm.name, description: createForm.desc,
                  previewColor: createForm.accent, previewBg: createForm.bg,
                  tokens: {
                    colors: {
                      primary: createForm.accent, bgApp: createForm.bg,
                      bgSidebar: createForm.accent, bgCard: '#FFFFFF',
                      textPrimary: '#212529', textSidebar: '#FFFFFF',
                    },
                  },
                })}
                className="o-btn o-btn-primary o-btn-sm"
              >
                {createMutation.isPending ? 'Création...' : 'Créer le thème'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes popIn { from{opacity:0;transform:scale(.96)} to{opacity:1;transform:scale(1)} }
      `}</style>
    </div>
  );
}
