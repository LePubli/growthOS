import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import {
  User, Save, Loader2, Camera, Mail, Phone, Globe, Building2,
  ArrowLeft, CheckCircle, Lock, Eye, EyeOff, AlertCircle,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

const AVATAR_COLORS = [
  '#6D28D9','#2563EB','#059669','#D97706','#DC2626','#7C3AED','#0891B2','#BE185D',
];

function Field({ label, value, onChange, type='text', placeholder='', textarea=false, disabled=false }:
  { label:string; value:string; onChange:(v:string)=>void; type?:string; placeholder?:string; textarea?:boolean; disabled?:boolean }) {
  const base: React.CSSProperties = {
    width:'100%', padding:'10px 12px', border:'1px solid var(--card-border)',
    borderRadius:10, fontSize:14, background: disabled ? 'var(--body-bg)' : 'var(--body-bg)',
    color:'var(--text-primary)', outline:'none', boxSizing:'border-box',
    opacity: disabled ? 0.6 : 1,
  };
  return (
    <div style={{marginBottom:14}}>
      <label style={{display:'block',fontSize:13,fontWeight:500,color:'var(--text-secondary)',marginBottom:5}}>{label}</label>
      {textarea
        ? <textarea value={value} onChange={e=>onChange(e.target.value)} rows={3} placeholder={placeholder} disabled={disabled}
            style={{...base,resize:'vertical'}}/>
        : <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} disabled={disabled} style={base}/>
      }
    </div>
  );
}

export default function ProfilePage() {
  const [, navigate] = useLocation();
  const { user, setUser } = useAuthStore();

  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: '',
    company: '',
    website: '',
    bio: '',
  });
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [pwForm, setPwForm] = useState({ currentPassword:'', newPassword:'', confirm:'' });
  const [showPw, setShowPw] = useState<Record<string,boolean>>({});
  const [savingPw, setSavingPw] = useState(false);
  const [pwSection, setPwSection] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const setPw = (k: string, v: string) => setPwForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    apiClient.get('/users/me').then((data: any) => {
      setForm(f => ({
        ...f,
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        email: data.email || '',
        phone: data.phone || '',
        company: data.company || '',
        website: data.website || '',
        bio: data.bio || '',
      }));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await apiClient.patch('/users/me', {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        company: form.company,
        website: form.website,
        bio: form.bio,
      });
      if (setUser && updated) setUser(updated as any);
      toast.success('Profil enregistré');
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (pwForm.newPassword !== pwForm.confirm) { toast.error('Les mots de passe ne correspondent pas'); return; }
    if (pwForm.newPassword.length < 8) { toast.error('Le mot de passe doit faire au moins 8 caractères'); return; }
    setSavingPw(true);
    try {
      await apiClient.post('/users/me/password', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      toast.success('Mot de passe modifié');
      setPwForm({ currentPassword:'', newPassword:'', confirm:'' });
      setPwSection(false);
    } catch {
      toast.error('Mot de passe actuel incorrect');
    } finally {
      setSavingPw(false);
    }
  };

  const initials = `${form.firstName?.[0] || ''}${form.lastName?.[0] || ''}`.toUpperCase() || form.email?.[0]?.toUpperCase() || 'U';

  return (
    <div className="min-h-screen p-6" style={{background:'var(--body-bg)'}}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}>
        <button onClick={()=>navigate('/settings')}
          style={{padding:8,borderRadius:10,background:'var(--card-bg)',border:'1px solid var(--card-border)',cursor:'pointer',color:'var(--text-secondary)',display:'flex',alignItems:'center'}}>
          <ArrowLeft size={18}/>
        </button>
        <h1 style={{fontSize:22,fontWeight:700,color:'var(--text-primary)',margin:0}}>Profil</h1>
      </div>

      <div style={{maxWidth:580}}>
        {/* Infos personnelles */}
        <div style={{borderRadius:16,border:'1px solid var(--card-border)',background:'var(--card-bg)',padding:24,marginBottom:16}}>
          <h2 style={{fontWeight:600,fontSize:15,color:'var(--text-primary)',marginBottom:20}}>Informations personnelles</h2>

          {/* Avatar */}
          <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:24}}>
            <div style={{position:'relative',flexShrink:0}}>
              <div style={{width:72,height:72,borderRadius:16,background:avatarColor,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:28}}>
                {initials}
              </div>
              <div style={{position:'absolute',bottom:-4,right:-4,display:'flex',gap:2}}>
                {AVATAR_COLORS.slice(0,4).map(c=>(
                  <button key={c} onClick={()=>setAvatarColor(c)}
                    style={{width:14,height:14,borderRadius:'50%',background:c,border:avatarColor===c?'2px solid var(--card-bg)':'none',cursor:'pointer',padding:0}}/>
                ))}
              </div>
            </div>
            <div>
              <div style={{fontWeight:600,fontSize:16,color:'var(--text-primary)'}}>{form.firstName} {form.lastName}</div>
              <div style={{fontSize:13,color:'var(--text-muted)'}}>{form.email}</div>
              <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>Rôle : {user?.role || 'member'}</div>
            </div>
          </div>

          {loading ? (
            <div style={{display:'flex',alignItems:'center',gap:8,color:'var(--text-muted)',padding:'20px 0'}}>
              <Loader2 size={16} className="animate-spin"/><span style={{fontSize:14}}>Chargement...</span>
            </div>
          ) : (
            <>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <Field label="Prénom" value={form.firstName} onChange={v=>set('firstName',v)} placeholder="Jean"/>
                <Field label="Nom" value={form.lastName} onChange={v=>set('lastName',v)} placeholder="Dupont"/>
              </div>
              <Field label="Email" value={form.email} onChange={()=>{}} type="email" placeholder="jean@acme.fr" disabled/>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <Field label="Téléphone" value={form.phone} onChange={v=>set('phone',v)} placeholder="+33 6 12 34 56 78"/>
                <Field label="Entreprise" value={form.company} onChange={v=>set('company',v)} placeholder="Acme SAS"/>
              </div>
              <Field label="Site web" value={form.website} onChange={v=>set('website',v)} placeholder="https://acme.fr"/>
              <Field label="Bio" value={form.bio} onChange={v=>set('bio',v)} placeholder="Décrivez-vous en quelques mots..." textarea/>

              <button onClick={save} disabled={saving}
                style={{display:'flex',alignItems:'center',gap:8,padding:'10px 20px',borderRadius:10,border:'none',background:'var(--color-primary)',color:'#fff',fontSize:14,fontWeight:600,cursor:saving?'not-allowed':'pointer',opacity:saving?0.7:1}}>
                {saving?<><Loader2 size={14} className="animate-spin"/>Enregistrement...</>:<><Save size={14}/>Sauvegarder</>}
              </button>
            </>
          )}
        </div>

        {/* Mot de passe */}
        <div style={{borderRadius:16,border:'1px solid var(--card-border)',background:'var(--card-bg)',padding:24}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:pwSection?20:0}}>
            <div>
              <h2 style={{fontWeight:600,fontSize:15,color:'var(--text-primary)',margin:'0 0 2px'}}>Mot de passe</h2>
              <p style={{fontSize:13,color:'var(--text-muted)',margin:0}}>Modifiez votre mot de passe de connexion</p>
            </div>
            <button onClick={()=>setPwSection(v=>!v)}
              style={{padding:'8px 14px',border:'1px solid var(--card-border)',borderRadius:10,background:'var(--body-bg)',color:'var(--text-secondary)',fontSize:13,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
              <Lock size={13}/>{pwSection?'Annuler':'Modifier'}
            </button>
          </div>

          {pwSection && (
            <div>
              {['currentPassword','newPassword','confirm'].map(k=>{
                const labels: Record<string,string> = { currentPassword:'Mot de passe actuel', newPassword:'Nouveau mot de passe (min. 8 car.)', confirm:'Confirmer le nouveau mot de passe' };
                const v = (pwForm as any)[k];
                return (
                  <div key={k} style={{marginBottom:12}}>
                    <label style={{display:'block',fontSize:13,fontWeight:500,color:'var(--text-secondary)',marginBottom:5}}>{labels[k]}</label>
                    <div style={{position:'relative'}}>
                      <input type={showPw[k]?'text':'password'} value={v} onChange={e=>setPw(k,e.target.value)}
                        style={{width:'100%',padding:'10px 40px 10px 12px',border:'1px solid var(--card-border)',borderRadius:10,fontSize:14,background:'var(--body-bg)',color:'var(--text-primary)',outline:'none',boxSizing:'border-box'}}/>
                      <button onClick={()=>setShowPw(s=>({...s,[k]:!s[k]}))} style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)'}}>
                        {showPw[k]?<EyeOff size={14}/>:<Eye size={14}/>}
                      </button>
                    </div>
                  </div>
                );
              })}
              {pwForm.newPassword && pwForm.confirm && pwForm.newPassword !== pwForm.confirm && (
                <div style={{display:'flex',alignItems:'center',gap:6,color:'#EF4444',fontSize:13,marginBottom:12}}>
                  <AlertCircle size={13}/>Les mots de passe ne correspondent pas
                </div>
              )}
              <button onClick={changePassword} disabled={savingPw||!pwForm.currentPassword||!pwForm.newPassword||!pwForm.confirm}
                style={{display:'flex',alignItems:'center',gap:8,padding:'10px 20px',borderRadius:10,border:'none',background:'var(--color-primary)',color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',opacity:savingPw?0.7:1}}>
                {savingPw?<><Loader2 size={14} className="animate-spin"/>Modification...</>:<><CheckCircle size={14}/>Confirmer</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
