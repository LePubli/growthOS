'use client';
import { useState } from 'react';
import { Users, Plus, Mail, Trash2, Crown, Shield, User, Send } from 'lucide-react';

const ROLES = { owner:{label:'Owner',color:'bg-purple-50 text-purple-700',icon:<Crown className="w-3.5 h-3.5"/>}, admin:{label:'Admin',color:'bg-blue-50 text-blue-700',icon:<Shield className="w-3.5 h-3.5"/>}, member:{label:'Membre',color:'bg-gray-100 text-gray-600',icon:<User className="w-3.5 h-3.5"/>} };
const MOCK_TEAM = [{ id:'1',name:'Admin',email:'admin@le-publicitaire.fr',role:'owner',status:'active',joinedAt:'Jan 2026' }];

export default function SettingsTeamPage() {
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
    <div className="min-h-screen bg-gray-50 p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Équipe</h1>
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
        <h2 className="font-semibold text-gray-900 mb-4">Inviter un membre</h2>
        <div className="flex gap-3">
          <div className="relative flex-1"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@example.com" className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
          <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
            <option value="member">Membre</option><option value="admin">Admin</option>
          </select>
          <button onClick={invite} disabled={sending||!inviteEmail} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
            <Send className="w-4 h-4" /> Inviter
          </button>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200"><tr>{['Membre','Rôle','Statut','Rejoint le',''].map(h => <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {team.map(m => {
              const role = (ROLES as any)[m.role]||ROLES.member;
              return (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-teal-600 flex items-center justify-center text-white text-sm font-bold">{m.name[0].toUpperCase()}</div><div><div className="text-sm font-medium text-gray-900">{m.name}</div><div className="text-xs text-gray-400">{m.email}</div></div></div></td>
                  <td className="px-5 py-4"><span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium w-fit ${role.color}`}>{role.icon}{role.label}</span></td>
                  <td className="px-5 py-4"><span className={`text-xs px-2 py-1 rounded-full ${m.status==='active'?'bg-green-50 text-green-600':'bg-amber-50 text-amber-600'}`}>{m.status==='active'?'Actif':'En attente'}</span></td>
                  <td className="px-5 py-4 text-sm text-gray-500">{m.joinedAt}</td>
                  <td className="px-5 py-4">{m.role!=='owner' && <button onClick={() => setTeam(t=>t.filter(x=>x.id!==m.id))} className="text-gray-300 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
