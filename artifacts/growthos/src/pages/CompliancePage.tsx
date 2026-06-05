import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ShieldCheck, Download, Trash2, AlertTriangle, FileText, Database, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';

export default function CompliancePage() {
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const { data: retention } = useQuery({
    queryKey: ['data-retention'],
    queryFn: () => apiClient.get('/compliance/data-retention') as Promise<any>,
    staleTime: 60_000,
  });
  const { data: consents } = useQuery({
    queryKey: ['consent-logs'],
    queryFn: () => apiClient.get('/compliance/consent-logs') as Promise<any[]>,
    staleTime: 60_000,
  });

  const exportMut = useMutation({
    mutationFn: () => fetch('/api/v1/compliance/export-data', { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' } }).then(r => r.blob()),
    onSuccess: (blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `growthos-data-export-${Date.now()}.json`;
      a.click();
      toast.success('Export téléchargé');
    },
    onError: () => toast.error('Erreur lors de l\'export'),
  });

  const deleteMut = useMutation({
    mutationFn: () => apiClient.post('/compliance/delete-data', { confirm: 'DELETE_MY_DATA' }) as Promise<any>,
    onSuccess: () => {
      toast.success('Données personnelles supprimées');
      setShowDeleteModal(false);
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  });

  const consentMut = useMutation({
    mutationFn: (data: { consentType: string; granted: boolean }) =>
      apiClient.post('/compliance/consent', data) as Promise<any>,
    onSuccess: () => toast.success('Consentement enregistré'),
  });

  const CONSENTS = [
    { type: 'marketing', label: 'Communications marketing', desc: 'Recevoir des emails promotionnels et newsletters' },
    { type: 'analytics', label: 'Analyse d\'usage', desc: 'Permettre l\'analyse anonymisée de votre usage de GrowthOS' },
    { type: 'data_sharing', label: 'Partage de données agrégées', desc: 'Contribuer aux benchmarks sectoriels anonymisés' },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldCheck size={22} style={{ color: '#059669' }} /> Conformité RGPD
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Gérez vos droits RGPD : accès, portabilité et suppression de vos données</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Inventory */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Database size={16} style={{ color: '#3B82F6' }} />Inventaire des données
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { key: 'prospects', label: 'Prospects créés', icon: '👤', color: '#8B5CF6' },
                { key: 'activities', label: 'Activités enregistrées', icon: '📋', color: '#3B82F6' },
                { key: 'signals', label: 'Signaux captés', icon: '📡', color: '#F59E0B' },
                { key: 'audit_logs', label: 'Logs d\'audit', icon: '🔍', color: '#10B981' },
              ].map(({ key, label, icon, color }) => {
                const d = retention?.[key];
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--body-bg)', borderRadius: 10 }}>
                    <span style={{ fontSize: 20 }}>{icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
                      {d?.oldest && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Depuis le {new Date(d.oldest).toLocaleDateString('fr-FR')}</div>}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color }}>{d ? Number(d.count).toLocaleString() : '—'}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Consent management */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={16} style={{ color: '#059669' }} />Gestion des consentements
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {CONSENTS.map(c => {
                const existing = (consents ?? []).find((x: any) => x.consent_type === c.type);
                const granted = existing?.granted ?? false;
                return (
                  <div key={c.type} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 14px', background: 'var(--body-bg)', borderRadius: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{c.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{c.desc}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => consentMut.mutate({ consentType: c.type, granted: true })}
                        style={{ padding: '5px 12px', borderRadius: 7, border: 'none', background: granted ? '#D1FAE5' : 'var(--card-bg)', color: granted ? '#059669' : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: granted ? '1.5px solid #059669' : '1px solid var(--card-border)' as any }}>
                        ✓ Accepter
                      </button>
                      <button onClick={() => consentMut.mutate({ consentType: c.type, granted: false })}
                        style={{ padding: '5px 12px', borderRadius: 7, border: 'none', background: !granted && existing ? '#FEF2F2' : 'var(--card-bg)', color: !granted && existing ? '#DC2626' : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: !granted && existing ? '1.5px solid #DC2626' : '1px solid var(--card-border)' as any }}>
                        ✕ Refuser
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Consent history */}
          {(consents ?? []).length > 0 && (
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={14} />Historique des consentements
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(consents ?? []).slice(0, 10).map((c: any) => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--body-bg)', borderRadius: 8 }}>
                    <span style={{ fontSize: 14 }}>{c.granted ? '✅' : '❌'}</span>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{c.consent_type}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleDateString('fr-FR')}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column — actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={16} style={{ color: '#3B82F6' }} />Droit à la portabilité
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
              Téléchargez toutes vos données personnelles en format JSON lisible.
            </p>
            <button onClick={() => exportMut.mutate()} disabled={exportMut.isPending}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', borderRadius: 10, border: 'none', background: '#EFF6FF', color: '#2563EB', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              <Download size={14} />{exportMut.isPending ? 'Export…' : 'Exporter mes données'}
            </button>
          </div>

          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 14, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#92400E', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} />Rétention des données
            </div>
            <p style={{ fontSize: 12, color: '#78350F', marginBottom: 12, lineHeight: 1.5 }}>
              Par défaut, vos données sont conservées 3 ans. Conformément au RGPD, vous pouvez demander leur suppression.
            </p>
            <div style={{ fontSize: 11, color: '#92400E', background: '#FEF3C7', padding: '8px 10px', borderRadius: 8, marginBottom: 12 }}>
              ⚠️ Les prospects et deals partagés avec votre équipe ne seront pas supprimés.
            </div>
          </div>

          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 14, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#991B1B', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Trash2 size={16} />Droit à l'oubli
            </div>
            <p style={{ fontSize: 12, color: '#7F1D1D', marginBottom: 16, lineHeight: 1.5 }}>
              Supprime vos activités personnelles, tâches, logs d'audit et consentements. Action irréversible.
            </p>
            <button onClick={() => setShowDeleteModal(true)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', borderRadius: 10, border: 'none', background: '#FEE2E2', color: '#DC2626', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              <Trash2 size={14} />Supprimer mes données
            </button>
          </div>

          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 8 }}>📋 Vos droits RGPD</div>
            {['Accès à vos données', 'Rectification', 'Effacement', 'Portabilité', 'Opposition', 'Limitation du traitement'].map(r => (
              <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                <CheckCircle size={12} style={{ color: '#059669', flexShrink: 0 }} />{r}
              </div>
            ))}
            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>
              Contact DPO : <a href="mailto:privacy@growthos.fr" style={{ color: '#2563EB' }}>privacy@growthos.fr</a>
            </div>
          </div>
        </div>
      </div>

      {/* Delete modal */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 28, maxWidth: 440, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#DC2626', marginBottom: 8 }}>⚠️ Supprimer mes données</div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
              Cette action est <strong>irréversible</strong>. Tapez <code>DELETE_MY_DATA</code> pour confirmer.
            </p>
            <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="DELETE_MY_DATA"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1.5px solid #FECACA', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowDeleteModal(false)}
                style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Annuler
              </button>
              <button disabled={deleteConfirm !== 'DELETE_MY_DATA' || deleteMut.isPending} onClick={() => deleteMut.mutate()}
                style={{ flex: 1, padding: '10px', borderRadius: 9, border: 'none', background: deleteConfirm === 'DELETE_MY_DATA' ? '#DC2626' : '#FCA5A5', color: '#fff', fontSize: 13, fontWeight: 700, cursor: deleteConfirm === 'DELETE_MY_DATA' ? 'pointer' : 'not-allowed' }}>
                {deleteMut.isPending ? 'Suppression…' : 'Confirmer la suppression'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
