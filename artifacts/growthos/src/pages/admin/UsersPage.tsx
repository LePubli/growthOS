import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Plus, Pencil, Trash2, Shield, ShieldCheck, RotateCcw,
  ChevronDown, X, Check, Loader2, UserX, UserCheck, Key,
} from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';

/* ─── Types ─── */
interface RBACRole { id: string; name: string; description: string; permissions: string[]; isSystem: boolean; userCount?: number; }
interface User {
  id: string; email: string; firstName?: string; lastName?: string;
  role: string; isActive: boolean; rbacRoles: RBACRole[];
  createdAt: string; lastActivity?: string;
}

/* ─── Helpers ─── */
const ROLE_COLORS: Record<string, string> = {
  admin: '#7C3AED', manager: '#2563EB', commercial: '#059669',
  member: '#6B7280', client: '#D97706', viewer: '#9CA3AF',
};
const VALID_ROLES = ['admin', 'manager', 'commercial', 'member', 'client', 'viewer'];

function RolePill({ role }: { role: string }) {
  const color = ROLE_COLORS[role] ?? '#6B7280';
  return (
    <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: color + '20', color }}>
      {role}
    </span>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12,
      color: active ? '#059669' : '#9CA3AF' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: active ? '#059669' : '#9CA3AF', display: 'inline-block' }} />
      {active ? 'Actif' : 'Inactif'}
    </span>
  );
}

/* ─── Modal Création/Édition Utilisateur ─── */
function UserModal({ user, roles, onClose }: { user?: User; roles: RBACRole[]; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!user;
  const [form, setForm] = useState({
    email: user?.email ?? '',
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    role: user?.role ?? 'commercial',
    password: '',
  });

  const mutation = useMutation({
    mutationFn: (data: typeof form) => isEdit
      ? apiClient.patch(`/admin/users/${user!.id}`, { firstName: data.firstName, lastName: data.lastName, role: data.role, ...(data.password ? { password: data.password } : {}) })
      : apiClient.post('/admin/users', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(isEdit ? 'Utilisateur modifié' : 'Utilisateur créé');
      onClose();
    },
    onError: (e: any) => toast.error(e?.error ?? 'Erreur'),
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 32, width: 480, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {isEdit ? 'Modifier l\'utilisateur' : 'Créer un utilisateur'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!isEdit && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Email *</label>
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="jean@entreprise.fr" type="email"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Prénom</label>
              <input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                placeholder="Jean"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Nom</label>
              <input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                placeholder="Dupont"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Rôle</label>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 14 }}>
              {VALID_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              {isEdit ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe *'}
            </label>
            <input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              type="password" placeholder="Min. 8 caractères"
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'none', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer' }}>
            Annuler
          </button>
          <button
            onClick={() => mutation.mutate(form)}
            disabled={mutation.isPending || (!isEdit && (!form.email || !form.password))}
            style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {isEdit ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Modal RBAC Rôles ─── */
function RoleModal({ role, permissions, onClose }: { role?: RBACRole; permissions: string[]; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!role;
  const [form, setForm] = useState({
    name: role?.name ?? '',
    description: role?.description ?? '',
    permissions: new Set<string>(role?.permissions ?? []),
  });

  const mutation = useMutation({
    mutationFn: (data: { name: string; description: string; permissions: string[] }) =>
      isEdit ? apiClient.patch(`/admin/roles/${role!.id}`, data) : apiClient.post('/admin/roles', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-roles'] }); toast.success(isEdit ? 'Rôle modifié' : 'Rôle créé'); onClose(); },
    onError: (e: any) => toast.error(e?.error ?? 'Erreur'),
  });

  const togglePerm = (p: string) => setForm(f => {
    const s = new Set(f.permissions);
    s.has(p) ? s.delete(p) : s.add(p);
    return { ...f, permissions: s };
  });

  const grouped = permissions.reduce<Record<string, string[]>>((acc, p) => {
    const mod = p.split(':')[0];
    if (!acc[mod]) acc[mod] = [];
    acc[mod].push(p);
    return acc;
  }, {});

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 32, width: 600, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {isEdit ? 'Modifier le rôle' : 'Créer un rôle'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nom du rôle"
            disabled={role?.isSystem}
            style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 14 }} />
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description"
            style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 14 }} />
        </div>

        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>PERMISSIONS ({form.permissions.size} sélectionnées)</p>
        {Object.entries(grouped).map(([mod, perms]) => (
          <div key={mod} style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>{mod}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {perms.map(p => {
                const active = form.permissions.has(p);
                return (
                  <button key={p} onClick={() => togglePerm(p)}
                    style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${active ? 'var(--color-primary)' : 'var(--card-border)'}`,
                      background: active ? 'var(--color-primary)' + '20' : 'transparent',
                      color: active ? 'var(--color-primary)' : 'var(--text-secondary)', fontSize: 11, cursor: 'pointer', fontWeight: active ? 600 : 400 }}>
                    {p.split(':')[1]}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'none', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer' }}>Annuler</button>
          <button
            onClick={() => mutation.mutate({ name: form.name, description: form.description, permissions: [...form.permissions] })}
            disabled={mutation.isPending || !form.name}
            style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            {mutation.isPending ? <Loader2 size={14} /> : <Check size={14} />}
            {isEdit ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Page principale ─── */
export default function UsersPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'users' | 'roles'>('users');
  const [userModal, setUserModal] = useState<{ open: boolean; user?: User }>({ open: false });
  const [roleModal, setRoleModal] = useState<{ open: boolean; role?: RBACRole }>({ open: false });
  const [resetModal, setResetModal] = useState<{ open: boolean; userId?: string }>({ open: false });
  const [newPwd, setNewPwd] = useState('');

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['admin-users'],
    queryFn: () => apiClient.get('/admin/users') as Promise<User[]>,
    staleTime: 30_000,
  });

  const { data: roles = [], isLoading: rolesLoading } = useQuery<RBACRole[]>({
    queryKey: ['admin-roles'],
    queryFn: () => apiClient.get('/admin/roles') as Promise<RBACRole[]>,
    staleTime: 30_000,
  });

  const { data: permsData = [] } = useQuery<{ name: string }[]>({
    queryKey: ['admin-permissions'],
    queryFn: () => apiClient.get('/admin/permissions') as Promise<{ name: string }[]>,
    staleTime: 60_000,
  });
  const allPermissions = permsData.map(p => p.name);

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch(`/admin/users/${id}`, { isActive }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('Statut mis à jour'); },
    onError: (e: any) => toast.error(e?.error ?? 'Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('Utilisateur supprimé'); },
    onError: (e: any) => toast.error(e?.error ?? 'Impossible de supprimer'),
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/roles/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-roles'] }); toast.success('Rôle supprimé'); },
    onError: (e: any) => toast.error(e?.error ?? 'Erreur'),
  });

  const resetPwdMutation = useMutation({
    mutationFn: ({ id, pwd }: { id: string; pwd: string }) =>
      apiClient.post(`/admin/users/${id}/reset-password`, { newPassword: pwd }),
    onSuccess: () => { toast.success('Mot de passe réinitialisé'); setResetModal({ open: false }); setNewPwd(''); },
    onError: (e: any) => toast.error(e?.error ?? 'Erreur'),
  });

  const cardStyle = {
    background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--card-border)',
    padding: 16, marginBottom: 1,
  };

  return (
    <div style={{ padding: 28, maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users size={22} /> Gestion des utilisateurs
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            {users.length} utilisateur{users.length !== 1 ? 's' : ''} · {roles.length} rôles
          </p>
        </div>
        <button onClick={() => tab === 'users' ? setUserModal({ open: true }) : setRoleModal({ open: true })}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
          <Plus size={16} /> {tab === 'users' ? 'Nouvel utilisateur' : 'Nouveau rôle'}
        </button>
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--card-bg)', borderRadius: 10, padding: 4, border: '1px solid var(--card-border)', width: 'fit-content' }}>
        {(['users', 'roles'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '7px 18px', borderRadius: 7, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: tab === t ? 'var(--color-primary)' : 'transparent',
              color: tab === t ? '#fff' : 'var(--text-secondary)' }}>
            {t === 'users' ? <><Users size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Utilisateurs</> : <><Shield size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Rôles</>}
          </button>
        ))}
      </div>

      {/* ── Onglet Utilisateurs ── */}
      {tab === 'users' && (
        <div>
          {usersLoading ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}><Loader2 size={28} className="animate-spin" /></div>
          ) : users.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
              <Users size={40} style={{ margin: '0 auto 12px', display: 'block', color: 'var(--card-border)' }} />
              <p>Aucun utilisateur</p>
            </div>
          ) : (
            <div style={{ background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--card-border)', overflow: 'hidden' }}>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 200px', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--card-border)', background: 'var(--body-bg)' }}>
                {['Utilisateur', 'Rôle', 'Statut', 'Dernière activité', 'Actions'].map(h => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</span>
                ))}
              </div>

              {users.map((u, i) => (
                <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 200px', gap: 12, padding: '14px 20px', alignItems: 'center', borderBottom: i < users.length - 1 ? '1px solid var(--card-border)' : 'none' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                      {u.firstName || u.lastName ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : '—'}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{u.email}</p>
                  </div>
                  <div><RolePill role={u.role} /></div>
                  <div><StatusDot active={u.isActive} /></div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {u.lastActivity ? new Date(u.lastActivity).toLocaleDateString('fr-FR') : 'Jamais'}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button onClick={() => setUserModal({ open: true, user: u })} title="Modifier"
                      style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--card-border)', background: 'var(--body-bg)', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => toggleActiveMutation.mutate({ id: u.id, isActive: !u.isActive })}
                      title={u.isActive ? 'Désactiver' : 'Activer'}
                      style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid ${u.isActive ? '#FCA5A5' : '#6EE7B7'}`, background: u.isActive ? '#FEF2F2' : '#ECFDF5', cursor: 'pointer', color: u.isActive ? '#DC2626' : '#059669' }}>
                      {u.isActive ? <UserX size={13} /> : <UserCheck size={13} />}
                    </button>
                    <button onClick={() => { setResetModal({ open: true, userId: u.id }); setNewPwd(''); }} title="Réinitialiser MDP"
                      style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #DBEAFE', background: '#EFF6FF', cursor: 'pointer', color: '#2563EB' }}>
                      <Key size={13} />
                    </button>
                    <button onClick={() => { if (confirm(`Supprimer ${u.email} ?`)) deleteMutation.mutate(u.id); }}
                      title="Supprimer"
                      style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #FCA5A5', background: '#FEF2F2', cursor: 'pointer', color: '#DC2626' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Onglet Rôles ── */}
      {tab === 'roles' && (
        <div>
          {rolesLoading ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}><Loader2 size={28} className="animate-spin" /></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {roles.map(role => (
                <div key={role.id} style={{ background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--card-border)', padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{role.name}</span>
                        {role.isSystem && (
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: '#7C3AED20', color: '#7C3AED', textTransform: 'uppercase' }}>Système</span>
                        )}
                      </div>
                      <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{role.description || '—'}</p>
                    </div>
                    {!role.isSystem && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setRoleModal({ open: true, role })}
                          style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--card-border)', background: 'var(--body-bg)', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => { if (confirm(`Supprimer le rôle "${role.name}" ?`)) deleteRoleMutation.mutate(role.id); }}
                          style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #FCA5A5', background: '#FEF2F2', cursor: 'pointer', color: '#DC2626' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                    <span>{role.permissions.length} permissions</span>
                    <span>{role.userCount ?? 0} utilisateur{(role.userCount ?? 0) !== 1 ? 's' : ''}</span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {role.permissions.slice(0, 8).map(p => (
                      <span key={p} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'var(--body-bg)', color: 'var(--text-muted)', border: '1px solid var(--card-border)' }}>{p}</span>
                    ))}
                    {role.permissions.length > 8 && (
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'var(--body-bg)', color: 'var(--text-muted)' }}>+{role.permissions.length - 8}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modales ── */}
      {userModal.open && (
        <UserModal user={userModal.user} roles={roles} onClose={() => setUserModal({ open: false })} />
      )}
      {roleModal.open && (
        <RoleModal role={roleModal.role} permissions={allPermissions} onClose={() => setRoleModal({ open: false })} />
      )}
      {resetModal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 32, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              <Key size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />Réinitialiser le mot de passe
            </h3>
            <input value={newPwd} onChange={e => setNewPwd(e.target.value)} type="password" placeholder="Nouveau mot de passe (min. 8 car.)"
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box', marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setResetModal({ open: false })} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>Annuler</button>
              <button onClick={() => resetPwdMutation.mutate({ id: resetModal.userId!, pwd: newPwd })}
                disabled={newPwd.length < 8 || resetPwdMutation.isPending}
                style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                {resetPwdMutation.isPending ? 'En cours…' : 'Réinitialiser'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
