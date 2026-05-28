import { useState } from 'react';
import { Users, Plus, Mail, Trash2, Crown, Shield, User, Send, Loader2 } from 'lucide-react';

const ROLES: Record<string,{label:string;color:string;icon:React.ReactNode}> = {
  owner:  {label:'Owner', color:'bg-purple-50 text-purple-700', icon:<Crown size={12}/>},
  admin:  {label:'Admin', color:'bg-blue-50 text-blue-700',   icon:<Shield size={12}/>},
  member: {label:'Membre',color:'bg-gray-100 text-gray-600',  icon:<User size={12}/>},
};
const MOCK_TEAM = [{ id:'1',name:'Admin',email:'admin@growthos.fr',role:'owner',status:'active',joinedAt:'Jan 2026' }];

export default function TeamPage() {
  const [team, setTeam] = useState(MOCK_TEAM);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [sending, setSending] = useState(false);

  const invite = async () => {
    if (!inviteEmail) return;
    setSending(true);
    await new Promise(r => setTimeout(r, 800));
    setTeam(t => [...t, { id:Date.now().toString(), name:inviteEmail.split('@')[0], email:inviteEmail, role:inviteRole, status:'pending', joinedAt:'En attente' }]);
    setInviteEmail(''); setSending(false);
  };

  return (
    <div className="min-h-screen p-6 max-w-3xl" style={{background:'var(--body-bg)'}}>
      <h1 style={{fontSize:22,fontWeight:700,color:'var(--text-primary)',marginBottom:24}}>Équipe</h1>

      <div style={{borderRadius:16,border:'1px solid var(--card-border)',background:'var(--card-bg)',padding:24,marginBottom:16}}>
        <h2 style={{fontWeight:600,fontSize:15,color:'var(--text-primary)',marginBottom:16}}>Inviter un membre</h2>
        <div style={{display:'flex',gap:12}}>
          <div style={{position:'relative',flex:1}}>
            <Mail size={14} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)'}}/>
            <input value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&invite()} placeholder="email@example.com"
              style={{width:'100%',paddingLeft:36,paddingRight:12,paddingTop:10,paddingBottom:10,border:'1px solid var(--card-border)',borderRadius:10,fontSize:14,background:'var(--body-bg)',color:'var(--text-primary)',outline:'none',boxSizing:'border-box'}}/>
          </div>
          <select value={inviteRole} onChange={e=>setInviteRole(e.target.value)}
            style={{padding:'10px 12px',border:'1px solid var(--card-border)',borderRadius:10,fontSize:14,background:'var(--body-bg)',color:'var(--text-primary)',outline:'none'}}>
            <option value="member">Membre</option><option value="admin">Admin</option>
          </select>
          <button onClick={invite} disabled={sending||!inviteEmail}
            style={{display:'flex',alignItems:'center',gap:6,padding:'10px 16px',borderRadius:10,border:'none',background:'var(--color-primary)',color:'#fff',fontSize:14,fontWeight:600,cursor:sending||!inviteEmail?'not-allowed':'pointer',opacity:sending||!inviteEmail?0.7:1}}>
            {sending?<Loader2 size={14} className="animate-spin"/>:<Send size={14}/>}Inviter
          </button>
        </div>
      </div>

      <div style={{borderRadius:16,border:'1px solid var(--card-border)',background:'var(--card-bg)',overflow:'hidden'}}>
        <div style={{padding:'12px 20px',borderBottom:'1px solid var(--card-border)',display:'flex',justifyContent:'space-between'}}>
          <span style={{fontWeight:600,fontSize:14,color:'var(--text-primary)'}}>{team.length} membre{team.length>1?'s':''}</span>
        </div>
        {team.map(member=>{
          const role = ROLES[member.role]||ROLES.member;
          return (
            <div key={member.id} style={{display:'flex',alignItems:'center',gap:12,padding:'14px 20px',borderBottom:'1px solid var(--card-border)'}}>
              <div style={{width:36,height:36,borderRadius:8,background:'var(--color-primary)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:14,flexShrink:0}}>
                {member.name[0].toUpperCase()}
              </div>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:14,color:'var(--text-primary)'}}>{member.name}</div>
                <div style={{fontSize:12,color:'var(--text-muted)'}}>{member.email} · Rejoint {member.joinedAt}</div>
              </div>
              <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${role.color}`}>{role.icon}{role.label}</span>
              <span style={{fontSize:12,padding:'2px 8px',borderRadius:9999,background:member.status==='active'?'#ECFDF5':'#FFF7ED',color:member.status==='active'?'#059669':'#D97706'}}>{member.status}</span>
              {member.role!=='owner'&&(
                <button onClick={()=>setTeam(t=>t.filter(x=>x.id!==member.id))} style={{background:'none',border:'none',cursor:'pointer',color:'#EF4444',padding:4}}>
                  <Trash2 size={14}/>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
