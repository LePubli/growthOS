import { useState, useEffect } from 'react';
import { Users, Plus, Mail, Trash2, Crown, Shield, User, Send, Loader2, ChevronDown, X, AlertCircle, RefreshCw } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';

const ROLES: Record<string,{label:string;color:string;bg:string;icon:React.ReactNode}> = {
  owner:  { label:'Owner',  color:'#6D28D9', bg:'#F5F3FF', icon:<Crown size={11}/> },
  admin:  { label:'Admin',  color:'#2563EB', bg:'#EFF6FF', icon:<Shield size={11}/> },
  member: { label:'Membre', color:'#374151', bg:'#F3F4F6', icon:<User size={11}/> },
};

type Member = { id:string; name?:string; firstName?:string; lastName?:string; email:string; role:string; status:string; createdAt?:string; joinedAt?:string };

function displayName(m: Member): string {
  const full = `${m.firstName||''} ${m.lastName||''}`.trim();
  return full || m.name || m.email.split('@')[0];
}

function RoleSelect({ value, onChange, disabled }: { value:string; onChange:(v:string)=>void; disabled?:boolean }) {
  return (
    <select value={value} onChange={e=>onChange(e.target.value)} disabled={disabled}
      style={{padding:'6px 8px',border:'1px solid var(--card-border)',borderRadius:8,fontSize:12,background:'var(--body-bg)',color:'var(--text-primary)',outline:'none',cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.5:1}}>
      <option value="member">Membre</option>
      <option value="admin">Admin</option>
    </select>
  );
}

export default function TeamPage() {
  const { user: me } = useAuthStore();
  const [team, setTeam] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [sending, setSending] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [removingId, setRemovingId] = useState<string|null>(null);
  const [changingRoleId, setChangingRoleId] = useState<string|null>(null);

  const fetchTeam = () => {
    setLoading(true);
    apiClient.get('/team').then((data: any) => {
      const list = Array.isArray(data) ? data : data?.data || [];
      setTeam(list);
    }).catch(() => {
      setTeam([{ id:'1', email:'admin@growthos.fr', firstName:'Admin', lastName:'', role:'owner', status:'active', createdAt: new Date().toISOString() }]);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchTeam(); }, []);

  const invite = async () => {
    if (!inviteEmail) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) { toast.error('Email invalide'); return; }
    setSending(true);
    try {
      const created = await apiClient.post('/team/invite', {
        email: inviteEmail,
        firstName: inviteFirstName || undefined,
        lastName: inviteLastName || undefined,
        role: inviteRole,
      });
      setTeam(t => [...t, created as Member]);
      setInviteEmail(''); setInviteFirstName(''); setInviteLastName(''); setInviteRole('member');
      setShowInviteForm(false);
      toast.success(`Invitation envoyée à ${inviteEmail}`);
    } catch {
      toast.error('Impossible d\'inviter cet utilisateur');
    } finally { setSending(false); }
  };

  const changeRole = async (id: string, role: string) => {
    setChangingRoleId(id);
    try {
      const updated = await apiClient.patch(`/team/${id}/role`, { role });
      setTeam(t => t.map(m => m.id === id ? { ...m, role } : m));
      toast.success('Rôle mis à jour');
    } catch {
      toast.error('Impossible de modifier le rôle');
    } finally { setChangingRoleId(null); }
  };

  const remove = async (id: string, email: string) => {
    if (!confirm(`Supprimer ${email} de l'équipe ?`)) return;
    setRemovingId(id);
    try {
      await apiClient.delete(`/team/${id}`);
      setTeam(t => t.filter(m => m.id !== id));
      toast.success('Membre retiré');
    } catch {
      toast.error('Impossible de supprimer ce membre');
    } finally { setRemovingId(null); }
  };

  const owners = team.filter(m => m.role === 'owner').length;
  const admins = team.filter(m => m.role === 'admin').length;
  const members = team.filter(m => m.role === 'member').length;

  return (
    <div className="min-h-screen p-6 max-w-3xl" style={{background:'var(--body-bg)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:700,color:'var(--text-primary)',margin:'0 0 2px'}}>Équipe</h1>
          <p style={{fontSize:13,color:'var(--text-muted)',margin:0}}>{team.length} membre{team.length>1?'s':''}</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={fetchTeam} style={{padding:'8px',borderRadius:10,border:'1px solid var(--card-border)',background:'var(--card-bg)',cursor:'pointer',display:'flex',alignItems:'center',color:'var(--text-muted)'}}>
            <RefreshCw size={14}/>
          </button>
          <button onClick={()=>setShowInviteForm(v=>!v)}
            style={{display:'flex',alignItems:'center',gap:6,padding:'8px 16px',border:'none',borderRadius:10,background:'var(--color-primary)',color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer'}}>
            <Plus size={14}/>{showInviteForm?'Annuler':'Inviter'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
        {[
          {l:'Propriétaires', v:owners, color:'#6D28D9', bg:'#F5F3FF'},
          {l:'Admins',        v:admins, color:'#2563EB', bg:'#EFF6FF'},
          {l:'Membres',       v:members,color:'#374151', bg:'#F3F4F6'},
        ].map((s,i)=>(
          <div key={i} style={{borderRadius:12,border:'1px solid var(--card-border)',background:'var(--card-bg)',padding:'12px 16px',display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:32,height:32,borderRadius:8,background:s.bg,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14,color:s.color}}>{s.v}</div>
            <span style={{fontSize:13,color:'var(--text-secondary)'}}>{s.l}</span>
          </div>
        ))}
      </div>

      {/* Invite form */}
      {showInviteForm && (
        <div style={{borderRadius:16,border:'1px solid var(--color-primary)',background:'var(--card-bg)',padding:20,marginBottom:16}}>
          <h2 style={{fontWeight:600,fontSize:15,color:'var(--text-primary)',marginBottom:14}}>Inviter un nouveau membre</h2>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
            <div>
              <label style={{display:'block',fontSize:12,fontWeight:500,color:'var(--text-secondary)',marginBottom:4}}>Prénom</label>
              <input value={inviteFirstName} onChange={e=>setInviteFirstName(e.target.value)} placeholder="Jean"
                style={{width:'100%',padding:'9px 12px',border:'1px solid var(--card-border)',borderRadius:10,fontSize:14,background:'var(--body-bg)',color:'var(--text-primary)',outline:'none',boxSizing:'border-box'}}/>
            </div>
            <div>
              <label style={{display:'block',fontSize:12,fontWeight:500,color:'var(--text-secondary)',marginBottom:4}}>Nom</label>
              <input value={inviteLastName} onChange={e=>setInviteLastName(e.target.value)} placeholder="Dupont"
                style={{width:'100%',padding:'9px 12px',border:'1px solid var(--card-border)',borderRadius:10,fontSize:14,background:'var(--body-bg)',color:'var(--text-primary)',outline:'none',boxSizing:'border-box'}}/>
            </div>
          </div>
          <div style={{display:'flex',gap:10}}>
            <div style={{position:'relative',flex:1}}>
              <Mail size={13} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)'}}/>
              <input value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&invite()}
                placeholder="email@exemple.com" type="email"
                style={{width:'100%',paddingLeft:34,paddingRight:12,paddingTop:9,paddingBottom:9,border:'1px solid var(--card-border)',borderRadius:10,fontSize:14,background:'var(--body-bg)',color:'var(--text-primary)',outline:'none',boxSizing:'border-box'}}/>
            </div>
            <select value={inviteRole} onChange={e=>setInviteRole(e.target.value)}
              style={{padding:'9px 12px',border:'1px solid var(--card-border)',borderRadius:10,fontSize:14,background:'var(--body-bg)',color:'var(--text-primary)',outline:'none'}}>
              <option value="member">Membre</option>
              <option value="admin">Admin</option>
            </select>
            <button onClick={invite} disabled={sending||!inviteEmail}
              style={{display:'flex',alignItems:'center',gap:6,padding:'9px 16px',borderRadius:10,border:'none',background:'var(--color-primary)',color:'#fff',fontSize:14,fontWeight:600,cursor:sending||!inviteEmail?'not-allowed':'pointer',opacity:sending||!inviteEmail?0.7:1}}>
              {sending?<Loader2 size={14} className="animate-spin"/>:<Send size={14}/>}Inviter
            </button>
          </div>
        </div>
      )}

      {/* Members list */}
      <div style={{borderRadius:16,border:'1px solid var(--card-border)',background:'var(--card-bg)',overflow:'hidden'}}>
        <div style={{padding:'12px 20px',borderBottom:'1px solid var(--card-border)',background:'var(--body-bg)'}}>
          <span style={{fontWeight:600,fontSize:13,color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:'0.05em'}}>Membres</span>
        </div>

        {loading ? (
          <div style={{padding:40,display:'flex',justifyContent:'center'}}>
            <Loader2 size={24} className="animate-spin" style={{color:'var(--color-primary)'}}/>
          </div>
        ) : team.map((member, idx) => {
          const role = ROLES[member.role] || ROLES.member;
          const isMe = member.id === me?.id || member.email === me?.email;
          const isOwner = member.role === 'owner';
          const name = displayName(member);
          const initials = name.slice(0,2).toUpperCase();
          const colors = ['#6D28D9','#2563EB','#059669','#D97706','#DC2626','#0891B2'];
          const bg = colors[idx % colors.length];
          const joined = member.createdAt ? new Date(member.createdAt).toLocaleDateString('fr-FR',{month:'short',year:'numeric'}) : 'Récemment';

          return (
            <div key={member.id} style={{display:'flex',alignItems:'center',gap:14,padding:'14px 20px',borderBottom:'1px solid var(--card-border)',transition:'background .15s'}}
              onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='var(--body-bg)'}
              onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
              <div style={{width:40,height:40,borderRadius:10,background:bg,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:15,flexShrink:0}}>
                {initials}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontWeight:600,fontSize:14,color:'var(--text-primary)'}}>{name}</span>
                  {isMe && <span style={{fontSize:11,padding:'1px 6px',borderRadius:9999,background:'var(--color-primary)',color:'#fff',fontWeight:600}}>Vous</span>}
                </div>
                <div style={{fontSize:12,color:'var(--text-muted)'}}>{member.email} · Rejoint {joined}</div>
              </div>

              <div style={{display:'flex',alignItems:'center',gap:2,padding:'3px 6px',borderRadius:8,background:role.bg}}>
                <span style={{color:role.color,display:'flex'}}>{role.icon}</span>
                <span style={{fontSize:11,fontWeight:600,color:role.color,marginLeft:3}}>{role.label}</span>
              </div>

              {!isOwner && !isMe && (
                <RoleSelect
                  value={member.role}
                  onChange={v=>changeRole(member.id,v)}
                  disabled={changingRoleId===member.id}
                />
              )}

              {!isOwner && !isMe && (
                <button onClick={()=>remove(member.id, member.email)}
                  disabled={removingId===member.id}
                  style={{padding:6,borderRadius:8,background:'none',border:'none',cursor:'pointer',color:'#EF4444',display:'flex',alignItems:'center',opacity:removingId===member.id?0.5:1}}>
                  {removingId===member.id?<Loader2 size={14} className="animate-spin"/>:<Trash2 size={14}/>}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
